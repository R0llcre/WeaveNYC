'use client';

/**
 * M8.5 W3C — `/me` tab hub.
 *
 * Route file is a thin client shell that delegates to `<MeScreen>`. All
 * render logic (user identity card, language / privacy / verify / account
 * sections, danger zone) lives in the component so it can be imported
 * directly by tests without spinning up the Next.js App Router context.
 */
import { MeScreen } from '@/components/me-screen';

export default function MePage() {
  return <MeScreen />;
}
