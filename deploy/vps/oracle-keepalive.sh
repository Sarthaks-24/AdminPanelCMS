#!/usr/bin/env bash
# Keeps an Oracle Cloud Always Free VM from being reclaimed as idle.
#
# Oracle reclaims an Always Free instance when, over 7 days, ALL of these stay under 20%:
# CPU (95th percentile), network, and memory (A1 shapes only). Keeping CPU above 20% is enough.
# This burns a fixed share of every core at the lowest priority, so the app always wins the CPU.
#
#   sudo bash deploy/vps/oracle-keepalive.sh install     # install + start as a service (survives reboots)
#   sudo bash deploy/vps/oracle-keepalive.sh uninstall   # stop and remove it
#   bash deploy/vps/oracle-keepalive.sh status           # is it running, and current CPU use
#
# KEEPALIVE_PERCENT (default 30) sets the share of each core it uses. Keep it at 25 or more:
# the real load lands a few points under the target.
set -euo pipefail

PERCENT="${KEEPALIVE_PERCENT:-30}"
NAME=oracle-keepalive
BIN=/usr/local/bin/$NAME
UNIT=/etc/systemd/system/$NAME.service

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }; }

do_run() {
  if ! [[ "$PERCENT" =~ ^[0-9]+$ ]] || [ "$PERCENT" -lt 1 ] || [ "$PERCENT" -gt 90 ]; then
    echo "KEEPALIVE_PERCENT must be 1-90, got '$PERCENT'." >&2; exit 1
  fi
  local cores busy idle
  cores=$(nproc)
  busy=$(awk -v p="$PERCENT" 'BEGIN { printf "%.2f", p / 100 }')
  idle=$(awk -v p="$PERCENT" 'BEGIN { printf "%.2f", 1 - p / 100 }')
  echo "Keeping $cores core(s) at ~$PERCENT% (lowest priority)."
  trap 'trap - INT TERM; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM
  for _ in $(seq "$cores"); do
    # Each second: spin for $busy s, then sleep for the rest.
    ( while :; do timeout "$busy" sh -c 'while :; do :; done' || true; sleep "$idle"; done ) &
  done
  wait
}

do_install() {
  need_root
  command -v systemctl >/dev/null || { echo "systemd is required." >&2; exit 1; }
  install -m 755 "$0" "$BIN"
  cat > "$UNIT" <<EOF
[Unit]
Description=Keep Oracle Always Free VM above the idle-reclaim threshold
After=network-online.target

[Service]
Environment=KEEPALIVE_PERCENT=$PERCENT
ExecStart=$BIN run
Restart=always
RestartSec=10
# Lowest priority: yields to Docker, the API and Caddy whenever they need the CPU.
Nice=19
CPUWeight=1
CPUSchedulingPolicy=idle
IOSchedulingClass=idle
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$NAME"
  # Docker brings the app containers back after a reboot only if Docker itself starts on boot.
  systemctl enable docker >/dev/null 2>&1 || true
  echo "Installed. Check it with: bash $0 status"
}

do_uninstall() {
  need_root
  systemctl disable --now "$NAME" 2>/dev/null || true
  rm -f "$UNIT" "$BIN"
  systemctl daemon-reload
  echo "Removed."
}

do_status() {
  systemctl --no-pager status "$NAME" | head -n 5 || true
  # Whole-machine CPU busy % over 5 seconds, from /proc/stat.
  read -r _ a b c d e f g _ < /proc/stat; t1=$((a+b+c+d+e+f+g)); i1=$((d+e))
  sleep 5
  read -r _ a b c d e f g _ < /proc/stat; t2=$((a+b+c+d+e+f+g)); i2=$((d+e))
  echo "CPU in use (last 5 s): $(( 100 * ((t2-t1) - (i2-i1)) / (t2-t1) ))%  (Oracle's line: 20%)"
}

case "${1:-}" in
  run) do_run ;;
  install) do_install ;;
  uninstall) do_uninstall ;;
  status) do_status ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
