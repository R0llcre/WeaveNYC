'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useAppSelector, useContactRequestsInbox } from '@/lib/hooks';

type ContactInboxLinkProps = {
  className?: string;
};

export function ContactInboxLink({ className }: ContactInboxLinkProps) {
  const t = useTranslations();
  const session = useAppSelector((state) => state.auth.session);
  const isVerified = session?.user.level === 'verified' || session?.user.level === 'anchor';
  const inboxQuery = useContactRequestsInbox(session?.access_token, { limit: 10 }, isVerified, 20_000);
  const pendingCount =
    isVerified && inboxQuery.data
      ? inboxQuery.data.items.filter((item) => item.status === 'pending').length
      : 0;

  if (!isVerified) {
    return null;
  }

  return (
    <Link className={className ?? 'button button--secondary button--with-badge'} href="/inbox?view=requests">
      <span>{t('inboxTitle')}</span>
      {pendingCount > 0 ? <span className="button__badge">{pendingCount}</span> : null}
    </Link>
  );
}
