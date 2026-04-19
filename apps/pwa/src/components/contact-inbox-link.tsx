'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui';
import { useAppSelector, useContactRequestsInbox } from '@/lib/hooks';
import { selectIsVerified, selectSession } from '@/lib/selectors';

type ContactInboxLinkProps = {
  className?: string;
};

export function ContactInboxLink({ className }: ContactInboxLinkProps) {
  const t = useTranslations();
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const inboxQuery = useContactRequestsInbox(session?.access_token, { limit: 10 }, isVerified, 20_000);
  const pendingCount =
    isVerified && inboxQuery.data
      ? inboxQuery.data.items.filter((item) => item.status === 'pending').length
      : 0;

  if (!isVerified) {
    return null;
  }

  // Pending-count badge lives in the Button's trailingIcon slot so the atom
  // renders the label + badge consistently with the rest of the PWA's button
  // semantics (aria-hidden wrapper around the numeric chip). The visual
  // `button--with-badge` rule still applies via className override.
  return (
    <Button
      as="a"
      variant="secondary"
      href="/inbox/?view=requests"
      className={className ?? 'button--with-badge'}
      trailingIcon={
        pendingCount > 0 ? <span className="inbox-badge">{pendingCount}</span> : undefined
      }
    >
      {t('inboxTitle')}
    </Button>
  );
}
