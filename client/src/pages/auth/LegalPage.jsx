import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthShell from './AuthShell';
import { SITE } from '../../content/site';

// Keep these in step with server/lib/legal.js. Bump a version whenever the matching text changes,
// including when a fact in SITE.legal changes.
export const TERMS_VERSION = '2026-10-12';
export const PRIVACY_VERSION = '2026-10-12';

// Every operator fact comes from SITE.legal (src/content/site.js), the one place the owner fills them in.
const { operator: OPERATOR, jurisdiction: JURISDICTION, abuseEmail: ABUSE_EMAIL, privacyEmail: PRIVACY_EMAIL,
  securityEmail: SECURITY_EMAIL, hostingProvider: HOSTING_PROVIDER, backupProvider: BACKUP_PROVIDER, logSink: LOG_SINK } = SITE.legal;
const SUPPORT_EMAIL = SITE.support.email;

const h2 = 'mt-8 text-base font-semibold text-t-text';
const p = 'mt-3 text-sm leading-6 text-t-muted';
const ul = 'mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-t-muted';

function Terms() {
  return (
    <div>
      <p className={p}>These Terms of Service (the “Terms”) are an agreement between you and {OPERATOR} (“we”, “us”, the “Operator”), who runs {SITE.name} (the “Service”). By creating an account or using the Service you accept these Terms. If you do not agree, do not use the Service.</p>

      <h2 className={h2}>1. What the Service is</h2>
      <p className={p}>The Service lets you store professional profile content (profile, résumé link, social links, skills, projects, experience, education and certifications), define one or more “Apps” that each see a chosen subset of that content, and read that subset over an HTTP API using keys you create. It is offered as a hosted service run by a single operator.</p>

      <h2 className={h2}>2. Beta service, no SLA</h2>
      <p className={p}>The Service is in beta. It is provided on a best-effort basis, “as is” and “as available”, with no uptime, latency, support or data-durability commitment. We may change limits, features and the API with notice where practical, and we may suspend or shut down the Service. Removals or renames of API fields will be announced in advance where reasonably possible; additive changes may ship at any time.</p>
      <p className={p}>The Service is free during the beta. If a paid plan is ever introduced it will be announced at least 30 days in advance, and nothing you have already stored will be charged for retroactively.</p>

      <h2 className={h2}>3. Your account</h2>
      <ul className={ul}>
        <li>You must be at least 16 years old, provide a valid email address that you control, and keep your password confidential. You are responsible for everything done with your account and your API keys.</li>
        <li>One person per account. You may create several Apps and keys inside it.</li>
        <li>Tell us promptly at <span className="text-t-text">{ABUSE_EMAIL}</span> if you believe your account or a key has been compromised.</li>
      </ul>

      <h2 className={h2}>4. Your content</h2>
      <ul className={ul}>
        <li>You keep all rights to the content you store. You grant us a non-exclusive, worldwide licence to host, store, copy and transmit it only as needed to run the Service for you, including serving it to the Apps and keys you configure, making backups and showing it in your dashboard.</li>
        <li>You are responsible for the content and for what each App exposes. Anything published through a publishable key may be read by anyone who obtains that key; the origin allowlist limits browsers, not other software.</li>
        <li>You confirm you have the rights needed to store and publish your content and that it does not infringe anyone else’s rights.</li>
      </ul>

      <h2 className={h2}>5. Acceptable use</h2>
      <p className={p}>You agree not to use the Service, or let it be used, to:</p>
      <ul className={ul}>
        <li>store or publish content that is unlawful, defamatory, harassing, hateful, sexually explicit, or that infringes intellectual-property, privacy or publicity rights;</li>
        <li>impersonate another person or organisation, or publish someone else’s personal data without their permission;</li>
        <li>distribute malware, phishing material, or links to either; or use the Service as a host for spam, fraud or scams;</li>
        <li>probe, scan, overload or otherwise interfere with the Service, other accounts, or the rate limits and quotas (including by guessing invite codes, keys or links, or by automating signups);</li>
        <li>resell the Service, share one account between several people, or create accounts for others without their consent;</li>
        <li>circumvent limits, security measures or suspension.</li>
      </ul>
      <p className={p}>Report abuse to <span className="text-t-text">{ABUSE_EMAIL}</span>. We may remove content, suspend or delete accounts, revoke keys and rate-limit traffic that we reasonably believe breaches these Terms, with or without notice depending on severity. We will normally tell you why.</p>

      <h2 className={h2}>6. Limits and fair use</h2>
      <p className={p}>Free accounts are subject to published limits, currently 10 Apps, 100 items per content section, 2 live keys per App, per-key and per-account request rates, and a daily email budget shared by all users. Requests beyond the limits are refused with an error, not silently dropped. We may adjust the limits to keep the Service working for everyone.</p>

      <h2 className={h2}>7. API keys</h2>
      <p className={p}>Secret keys are shown once and are meant for servers and build steps. Publishable keys are intended for browsers and are not secret. You may revoke any key at any time; revocation takes effect on the next request.</p>

      <h2 className={h2}>8. Export, deletion and suspension</h2>
      <ul className={ul}>
        <li>You can export all your data as JSON and delete your account from <strong className="text-t-text">Account</strong> in the dashboard at any time. Deletion is immediate for sign-in and the API; stored data is removed by a cleanup job and leaves backups within 30 days.</li>
        <li>Accounts that never verify their email address are removed automatically after 48 hours.</li>
        <li>If we suspend your account for a suspected breach, sign-in and all keys stop working at once. You may contact us to contest the decision; we may delete suspended accounts after 30 days.</li>
      </ul>

      <h2 className={h2}>9. Disclaimers and liability</h2>
      <p className={p}>To the fullest extent permitted by law, the Service is provided without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We are not liable for lost profits, lost data, business interruption or any indirect, incidental, special or consequential damages arising from the Service, and our total liability for any claim is limited to the greater of the amount you paid us in the preceding 12 months and 50 units of the currency of {JURISDICTION}. Nothing in these Terms excludes liability that cannot be excluded by law.</p>

      <h2 className={h2}>10. Changes to these Terms</h2>
      <p className={p}>We may update these Terms. The version date at the top of this page changes when we do, and material changes will be announced by email and in the <Link className="text-t-accent hover:underline" to="/docs/changelog">changelog</Link> at least 14 days before they take effect. Continuing to use the Service after that date means you accept the new Terms.</p>

      <h2 className={h2}>11. Governing law</h2>
      <p className={p}>These Terms are governed by the laws of {JURISDICTION}, and its courts have exclusive jurisdiction over any dispute, without prejudice to mandatory consumer-protection rules in your country of residence.</p>

      <h2 className={h2}>12. Contact</h2>
      <p className={p}>{OPERATOR}, {JURISDICTION} · support: <span className="text-t-text">{SUPPORT_EMAIL}</span> · abuse and takedown requests: <span className="text-t-text">{ABUSE_EMAIL}</span> · privacy requests: <span className="text-t-text">{PRIVACY_EMAIL}</span> · security reports: <span className="text-t-text">{SECURITY_EMAIL}</span>.</p>
    </div>
  );
}

function Privacy() {
  return (
    <div>
      <p className={p}>This policy explains what {OPERATOR} (“we”, the “Operator”) collects when you use {SITE.name} (the “Service”), why, how long we keep it, and what you can do about it. We are the data controller for your account data.</p>

      <h2 className={h2}>1. What we collect</h2>
      <ul className={ul}>
        <li><strong className="text-t-text">Account data:</strong> your email address, a salted hash of your password (never the password itself), when you verified your email, the versions and times of the Terms and Privacy Policy you accepted, your account status and role.</li>
        <li><strong className="text-t-text">Your content:</strong> everything you enter in the dashboard: profile, résumé link, social links, skills, projects, experience, education, certifications. Some of it is personal data about you (and possibly about people you name, such as teammates).</li>
        <li><strong className="text-t-text">App configuration:</strong> the Apps you create, which content each one exposes, allowed origins, and hashed API keys with their prefix, label and last-use time.</li>
        <li><strong className="text-t-text">Technical logs:</strong> for every request to the dashboard and the API, the IP address, request path, status, timing, a request id and, when authenticated, the account, App or key id. Logs are kept for about 30 days.</li>
        <li><strong className="text-t-text">Email events:</strong> which transactional emails we sent you and whether sending failed.</li>
      </ul>
      <p className={p}>We use no analytics, advertising or tracking scripts, on the public site or in the dashboard, and the site’s typefaces are served from our own servers. The only cookie is the session cookie that keeps you signed in.</p>

      <h2 className={h2}>2. Why we use it</h2>
      <ul className={ul}>
        <li>to run the Service you asked for: sign you in, store your content, serve it to your Apps, and send verification and password-reset email (performance of a contract);</li>
        <li>to keep the Service secure and fair: rate limiting, abuse detection, suspension, incident investigation (legitimate interest);</li>
        <li>to meet legal obligations, such as responding to lawful requests.</li>
      </ul>
      <p className={p}>We do not sell your data, use it for advertising, or use it to train machine-learning models. We only email you about your account (verification, password reset, key expiry, security or Terms changes).</p>

      <h2 className={h2}>3. Who can see your content</h2>
      <p className={p}>Content is private to your account until you expose it through an App and a key. Anyone holding a key for an App can read exactly the content that App is configured to show, nothing else. Drafts are never served through the API. The Operator can access stored data for support, abuse handling and backups, and does so only when needed.</p>

      <h2 className={h2}>4. Sub-processors</h2>
      <ul className={ul}>
        <li><strong className="text-t-text">MongoDB Atlas</strong> (MongoDB, Inc.) hosts the database that stores your account, content and configuration.</li>
        <li><strong className="text-t-text">Resend</strong> (Resend, Inc.) delivers transactional email; it receives your email address and the message content.</li>
        <li><strong className="text-t-text">{HOSTING_PROVIDER}</strong> runs the API and dashboard servers and therefore processes request logs, including IP addresses.</li>
        <li><strong className="text-t-text">{LOG_SINK}</strong> stores request logs (including IP addresses) for about 30 days.</li>
        <li>Encrypted backups are stored with <strong className="text-t-text">{BACKUP_PROVIDER}</strong>; the provider cannot read them.</li>
      </ul>
      <p className={p}>Data may be processed in the countries where these providers operate, which may be outside your own. We rely on their standard contractual safeguards.</p>

      <h2 className={h2}>5. Retention</h2>
      <ul className={ul}>
        <li>Account data and content: for as long as your account exists.</li>
        <li>Accounts that never verify their email address are deleted automatically after 48 hours.</li>
        <li>When you delete your account, sign-in and the API stop immediately, stored data is removed by a cleanup job shortly afterwards, and deleted data leaves backups within 30 days.</li>
        <li>Request logs: about 30 days. Security-event records (sign-in failures, suspensions): up to 12 months.</li>
        <li>Verification and reset links expire after 24 hours and 1 hour respectively and are single-use.</li>
      </ul>

      <h2 className={h2}>6. Your rights and controls</h2>
      <ul className={ul}>
        <li>You can export all your data as JSON and delete your account from <strong className="text-t-text">Account</strong> in the dashboard at any time, without asking us.</li>
        <li>You can change your content, your password and your Apps yourself in the dashboard.</li>
        <li>Depending on where you live you may also have rights to access, correct, restrict or object to processing, to data portability, and to complain to a supervisory authority. Write to <span className="text-t-text">{PRIVACY_EMAIL}</span>; we answer within 30 days.</li>
      </ul>

      <h2 className={h2}>7. Security</h2>
      <p className={p}>Passwords are hashed with bcrypt. API keys and email links are stored only as hashes. The dashboard uses an HTTP-only session cookie and requires HTTPS in production. Backups are encrypted before leaving the server. No system is perfectly secure; if we learn of a breach affecting your data we will tell you by email without undue delay.</p>

      <h2 className={h2}>8. Children</h2>
      <p className={p}>The Service is not directed at children under 16, and we do not knowingly collect their data. If you believe a child has created an account, contact <span className="text-t-text">{PRIVACY_EMAIL}</span> and we will remove it.</p>

      <h2 className={h2}>9. Changes to this policy</h2>
      <p className={p}>The version date at the top of this page changes when the policy does. Material changes are announced by email and in the <Link className="text-t-accent hover:underline" to="/docs/changelog">changelog</Link> at least 14 days before they apply.</p>

      <h2 className={h2}>10. Contact</h2>
      <p className={p}>{OPERATOR}, {JURISDICTION} · <span className="text-t-text">{PRIVACY_EMAIL}</span> · abuse reports: <span className="text-t-text">{ABUSE_EMAIL}</span> · security reports: <span className="text-t-text">{SECURITY_EMAIL}</span>.</p>
    </div>
  );
}

export default function LegalPage() {
  const isPrivacy = useLocation().pathname.endsWith('privacy');
  const version = isPrivacy ? PRIVACY_VERSION : TERMS_VERSION;
  return (
    <AuthShell wide eyebrow="Legal" title={isPrivacy ? 'Privacy Policy' : 'Terms of Service'}>
      <p className="text-xs text-t-dim">Version {version}</p>
      {isPrivacy ? <Privacy /> : <Terms />}
      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link className="font-medium text-t-accent hover:underline" to={isPrivacy ? '/legal/terms' : '/legal/privacy'}>{isPrivacy ? 'Read the Terms of Service' : 'Read the Privacy Policy'}</Link>
        <Link className="font-medium text-t-accent hover:underline" to="/">Back to the home page</Link>
      </div>
    </AuthShell>
  );
}
