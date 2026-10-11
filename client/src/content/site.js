// Every fact about the service that a visitor, a legal page or a support message quotes lives here,
// so the owner fills each one in exactly once.
//
// OWNER: the bracketed values below are placeholders. `npm run check:launch` fails while any of them
// remains; replace them (and the same domain in index.html, public/_headers,
// public/.well-known/security.txt and SECURITY.md) before the first invite goes out.

// The public host of the site, without scheme or path, e.g. `portfoliocontrol.dev`.
const DOMAIN = '[your-domain]';

export const SITE = {
  // The single source of the product name. index.html carries a static copy for crawlers.
  name: 'Portfolio Control',
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  // Names the category first, so a visitor knows what kind of thing this is before anything else.
  category: 'Your portfolio content, as an API',
  // The one honest sentence. Everything on the landing page is evidence for it.
  claim: 'One content pool.',
  mechanism: 'Every site you build reads only the slice you grant it.',
  // What it costs and what you keep, in one line under the hero and in the footer.
  status: 'Free during the beta · read-only JSON API · export or delete your data any time',
  // The public uptime page (an external monitor on /readyz). Empty hides the footer link.
  statusUrl: '',

  support: {
    // The one address every "contact support" message points at.
    email: `support@${DOMAIN}`,
  },

  // Facts the Terms and Privacy Policy quote. Changing any of them changes the legal text, so bump
  // TERMS_VERSION / PRIVACY_VERSION in src/pages/auth/LegalPage.jsx and server/lib/legal.js together.
  legal: {
    // The person or registered business that runs the service and is party to the Terms.
    operator: '[Operator legal name]',
    // The country (or state) whose law governs the Terms.
    jurisdiction: '[Jurisdiction]',
    abuseEmail: `abuse@${DOMAIN}`,
    privacyEmail: `privacy@${DOMAIN}`,
    securityEmail: `security@${DOMAIN}`,
    // Who runs the API and dashboard servers (and so sees request logs).
    hostingProvider: '[Hosting provider]',
    // Where the encrypted off-host backups are stored.
    backupProvider: '[Backup storage provider]',
    // Where request logs are shipped and retained.
    logSink: '[Log provider]',
  },
};

/** `mailto:` link to support, optionally with a subject line. */
export const supportMailto = (subject) => `mailto:${SITE.support.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
