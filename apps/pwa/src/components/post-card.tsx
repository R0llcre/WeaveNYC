'use client';

import Link from 'next/link';

import { getCategoryLabel, getPostPrivacyLabel, getPostStatusLabel, getPostTypeLabel } from '@/lib/i18n';
import type { PostSummary, SupportedLanguage } from '@/lib/types';

type PostCardProps = {
  language: SupportedLanguage;
  post: PostSummary;
  href?: string;
};

export function PostCard({ language, post, href }: PostCardProps) {
  const content = (
    <article className="post-card">
      <div className="post-card__meta">
        <span className="meta-chip">{getPostTypeLabel(language, post.post_type)}</span>
        <span className="meta-chip">{getCategoryLabel(language, post.category)}</span>
        <span className="meta-chip">{getPostPrivacyLabel(language, post.privacy)}</span>
        <span className="meta-chip">{getPostStatusLabel(language, post.status)}</span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
      <p className="resource-card__subtle">
        {post.location_zip} · {new Date(post.expires_at).toLocaleString()}
      </p>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link className="post-card__link" href={href}>
      {content}
    </Link>
  );
}
