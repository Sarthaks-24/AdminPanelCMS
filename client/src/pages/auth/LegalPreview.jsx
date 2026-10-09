import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthShell from './AuthShell';

export default function LegalPreview() {
  const isPrivacy = useLocation().pathname.endsWith('privacy');
  return (
    <AuthShell eyebrow="Policy preview" title={isPrivacy ? 'Privacy policy' : 'Terms of service'} description="Internal preview for local account-flow testing. These pages are not approved for public registration.">
      {isPrivacy ? (
        <div className="space-y-4 text-sm leading-6 text-t-muted">
          <p><strong className="text-t-text">Account information.</strong> The service stores your email address, a password hash, verification status, and the content and app configuration you add to the dashboard.</p>
          <p><strong className="text-t-text">Messages.</strong> Verification and recovery emails are sent to the address you provide. Email links contain short-lived single-use tokens.</p>
          <p><strong className="text-t-text">Your controls.</strong> Account settings are planned to support data export and account deletion. This preview does not yet state final retention, backup, support, or jurisdiction terms.</p>
          <p><strong className="text-t-text">Before launch.</strong> The operator must approve and publish a complete policy before enabling public signup.</p>
        </div>
      ) : (
        <div className="space-y-4 text-sm leading-6 text-t-muted">
          <p>This dashboard is an internal preview for managing portfolio profile, project, and app data. Invite codes are for the named recipient and should not be shared publicly.</p>
          <p>You are responsible for the content you add and for reviewing what each app publishes. Verify your email before editing account content.</p>
          <p><strong className="text-t-text">Before launch.</strong> These preview terms do not cover final service availability, support, liability, governing law, or dispute handling. The operator must approve and publish complete terms before enabling public signup.</p>
        </div>
      )}
      <Link className="mt-6 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/signup">Back to registration</Link>
    </AuthShell>
  );
}
