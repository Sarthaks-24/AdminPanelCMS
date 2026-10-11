// Every fact about the service that a visitor, a legal page or a support message quotes lives here,
// so the owner fills each one in exactly once.
//
// The deploy-specific facts are build inputs, not code: set the VITE_SITE_* variables in client/.env
// or the host's build settings (see client/.env.example). vite.config.js validates them, and a prod
// build without VITE_SITE_DOMAIN, VITE_SITE_OPERATOR and VITE_SITE_JURISDICTION fails. In dev and in
// tests the unset ones show as bracketed placeholders, which `npm run check:launch` reports.
const input = (value, placeholder) => (typeof value === 'string' && value.trim()) || placeholder;

// The public host of the site, without scheme or path, e.g. `portfoliocontrol.dev`.
const DOMAIN = input(import.meta.env.VITE_SITE_DOMAIN, '[your-domain]');

export const SITE = {
  // The product name (VITE_SITE_NAME). index.html gets the same value through %SITE_NAME%.
  name: input(import.meta.env.VITE_SITE_NAME, 'Portfolio Control'),
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  // Names the category first, so a visitor knows what kind of thing this is before anything else.
  category: 'Your portfolio content, as an API',
  // The one honest sentence. Everything on the landing page is evidence for it.
  claim: 'One content pool.',
  mechanism: 'Every site you build reads only the slice you grant it.',
  // What it costs and what you keep, in one line under the hero and in the footer.
  status: 'Free during the beta · read-only JSON API · export or delete your data any time',
  // The public uptime page (an external monitor on /readyz), VITE_SITE_STATUS_URL. Empty hides the footer link.
  statusUrl: input(import.meta.env.VITE_SITE_STATUS_URL, ''),

  support: {
    // The one address every "contact support" message points at.
    email: input(import.meta.env.VITE_SITE_SUPPORT_EMAIL, `support@${DOMAIN}`),
  },

  // Facts the Terms and Privacy Policy quote. Changing any of them changes the legal text, so bump
  // the versions in server/contract/legal.json (read by both LegalPage.jsx and server/lib/legal.js).
  legal: {
    // The person or registered business that runs the service and is party to the Terms.
    operator: input(import.meta.env.VITE_SITE_OPERATOR, '[Operator legal name]'),
    // The country (or state) whose law governs the Terms.
    jurisdiction: input(import.meta.env.VITE_SITE_JURISDICTION, '[Jurisdiction]'),
    abuseEmail: `abuse@${DOMAIN}`,
    privacyEmail: `privacy@${DOMAIN}`,
    securityEmail: `security@${DOMAIN}`,
    // Who runs the API and dashboard servers (and so sees request logs).
    hostingProvider: input(import.meta.env.VITE_SITE_HOSTING_PROVIDER, '[Hosting provider]'),
    // Where the encrypted off-host backups are stored.
    backupProvider: input(import.meta.env.VITE_SITE_BACKUP_PROVIDER, '[Backup storage provider]'),
    // Where request logs are shipped and retained.
    logSink: input(import.meta.env.VITE_SITE_LOG_PROVIDER, '[Log provider]'),
  },
};

/** `mailto:` link to support, optionally with a subject line. */
export const supportMailto = (subject) => `mailto:${SITE.support.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
