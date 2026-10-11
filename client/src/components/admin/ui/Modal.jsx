import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog primitive for the dashboard.
 *
 * - role="dialog", aria-modal, aria-labelledby (the title) and aria-describedby when a description is given
 * - focus moves in on open (initialFocusRef, else the first focusable control, else the panel) and returns on close
 * - Tab is trapped inside; Escape closes, or explains why it can't when `closeBlocked` is a string
 * - everything else in <body> gets `inert` while the dialog is open, and the page stops scrolling behind it
 * - the panel is capped at 90dvh and scrolls inside itself, so the footer never leaves the screen
 */
export default function Modal({ title, description, onClose, closeBlocked = false, initialFocusRef, children, footer, size = 'md', icon: Icon, closeLabel = 'Close' }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const [blockedNotice, setBlockedNotice] = useState('');

  function attemptClose() {
    if (closeBlocked) {
      setBlockedNotice(typeof closeBlocked === 'string' ? closeBlocked : 'Finish the step above before closing.');
      return;
    }
    onClose();
  }

  // Focus in, trap, restore; inert siblings; scroll lock.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const root = panel?.parentElement;
    const siblings = Array.from(document.body.children).filter((node) => node !== root);
    siblings.forEach((node) => { if (!node.hasAttribute('inert')) { node.setAttribute('inert', ''); node.dataset.modalInert = '1'; } });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target = initialFocusRef?.current || panel?.querySelector(FOCUSABLE) || panel;
    window.requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));

    return () => {
      siblings.forEach((node) => { if (node.dataset.modalInert) { node.removeAttribute('inert'); delete node.dataset.modalInert; } });
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({ preventScroll: true });
    };
    // Runs once per open; the refs are stable for the dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      attemptClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter((node) => node.offsetParent !== null || node === document.activeElement);
    if (focusable.length === 0) { event.preventDefault(); panelRef.current.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const width = size === 'lg' ? 'max-w-3xl' : size === 'sm' ? 'max-w-md' : 'max-w-2xl';

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-t-bg/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) attemptClose(); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex max-h-[90dvh] w-full ${width} flex-col overflow-hidden rounded-lg border border-t-border-hi bg-t-surface shadow-2xl outline-none`}
        style={{ overscrollBehavior: 'contain' }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-t-border p-5">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-t-accent" />}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-t-text">{title}</h2>
              {description && <p id={descriptionId} className="mt-1 text-sm text-t-muted">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={attemptClose} aria-label={closeLabel} className="-m-2 shrink-0 rounded p-2 text-t-muted hover:bg-t-surface-hi hover:text-t-text"><X size={16} aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5" style={{ overscrollBehavior: 'contain' }}>
          {children}
        </div>
        {(footer || blockedNotice) && (
          <footer className="border-t border-t-border p-4">
            {blockedNotice && <p role="status" aria-live="polite" className="mb-3 text-sm text-t-warn">{blockedNotice}</p>}
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A yes/no dialog that names the consequence. Replaces window.confirm. */
export function ConfirmDialog({ title, consequence, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel, busy = false, danger = true }) {
  const cancelRef = useRef(null);
  return (
    <Modal title={title} description={consequence} onClose={onCancel} initialFocusRef={cancelRef} size="sm" footer={
      <div className="flex justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={onCancel} className="rounded border border-t-border-hi px-4 py-2 text-sm text-t-text hover:bg-t-surface-hi">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-60 ${danger ? 'bg-t-danger text-t-bg hover:opacity-90' : 'bg-t-accent text-t-on-accent hover:bg-t-accent-br'}`}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    }>
      <p className="text-sm text-t-muted">This can’t be undone.</p>
    </Modal>
  );
}
