'use client';

/**
 * M8.5 W2B — `/me/danger` placeholder.
 *
 * The real account-delete flow (request code → confirm → undo) lands in
 * Wave 3 as part of the Me hub. For now we only register the route so
 * sibling agents can link here without 404s.
 */
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { PageHeader } from '@/components/ui/PageHeader';

export default function MeDangerPage() {
  const t = useTranslations();
  const title = t('meDangerTitle');

  useEffect(() => {
    document.title = `${title} \u2014 WeaveNYC`;
  }, [title]);

  return (
    <div className="page-content" data-screen="me-danger">
      <PageHeader title={title} backHref="/me" />
      <p>Delete account — W2</p>
    </div>
  );
}
