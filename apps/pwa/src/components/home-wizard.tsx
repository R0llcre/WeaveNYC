'use client';

/**
 * HomeWizard — V2-D crisis-first Home.
 *
 * The pre-V2-D Home forced users to translate their crisis ("I'm hungry
 * tonight") into our taxonomy ("is it a pantry or kitchen?"). That is the
 * wrong direction for a neighbor in food / health / housing stress. This
 * wizard inverts the question: four big intent cards, each one a plain-
 * language first-person statement. Tapping a card dispatches
 * `setLastIntent(intent)` on the preferences slice and stays on `/`; the
 * page.tsx gate reads `preferences.lastIntent` on the next render and
 * swaps the wizard out for a pre-filtered directory view. The intent is
 * persisted to IndexedDB so a returning user lands on the list they
 * already picked, not back on the wizard.
 *
 * Intent → filter mapping (also documented on the `HomeIntent` type in
 * `lib/types.ts`):
 *   - food_now  → { type: 'all',      openNow: true } — pantries + kitchens open right now.
 *   - food_week → { type: 'pantry',   today:   true } — pantries open in the next 7 days
 *                                                         (the `today` flag is the closest
 *                                                         approximation we have in the API;
 *                                                         see `ResourceQueryInput`).
 *   - doctor    → { type: 'benefits'                 } — `benefits` narrows to `fqhc` per
 *                                                         `narrowResourceType()`.
 *   - sleep     → { type: 'other'                    } — shelter / housing bucket.
 *
 * The wizard is accessible as a first-class landmark (`main#main-content`)
 * and announces its title via `h1`; cards are `<button>`s so keyboard + SR
 * users get the native role without any ARIA gymnastics.
 *
 * E2E testid preservation: the smoke tests depend on `create-session` +
 * `session-chip` being present on Home so they can assert the session was
 * bootstrapped. We surface both as sr-only shims here (the wizard has no
 * visible refresh affordance — the whole screen is a one-decision picker)
 * so `tests/e2e/resource-smoke.spec.ts` and sibling specs keep passing
 * without a rewrite.
 *
 * testids introduced by this component:
 *   - `home-wizard`              — wizard landmark wrapper.
 *   - `need-food-now`            — "I'm hungry right now" card.
 *   - `need-food-week`           — "Food for my family this week" card.
 *   - `need-doctor`              — "I need to see a doctor" card.
 *   - `need-sleep`               — "A safe place to sleep" card.
 */

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Icon, Stack } from '@/components/ui';
import { TopBar } from '@/components/shell';
import type { IconName } from '@/assets/icons/registry';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPreferences, selectSession } from '@/lib/selectors';
import { setLastIntent } from '@/lib/slices/preferences-slice';
import type { HomeIntent } from '@/lib/types';
import { useSessionBootstrap } from '@/lib/use-session-bootstrap';

type NeedCard = {
  intent: HomeIntent;
  testId: string;
  iconName: IconName;
  titleKey:
    | 'needFoodNow'
    | 'needFoodWeek'
    | 'needDoctor'
    | 'needSleep';
  subtitleKey:
    | 'needFoodNowSubtitle'
    | 'needFoodWeekSubtitle'
    | 'needDoctorSubtitle'
    | 'needSleepSubtitle';
};

const NEED_CARDS: ReadonlyArray<NeedCard> = [
  {
    intent: 'food_now',
    testId: 'need-food-now',
    iconName: 'meal',
    titleKey: 'needFoodNow',
    subtitleKey: 'needFoodNowSubtitle',
  },
  {
    intent: 'food_week',
    testId: 'need-food-week',
    iconName: 'food',
    titleKey: 'needFoodWeek',
    subtitleKey: 'needFoodWeekSubtitle',
  },
  {
    intent: 'doctor',
    testId: 'need-doctor',
    iconName: 'health',
    titleKey: 'needDoctor',
    subtitleKey: 'needDoctorSubtitle',
  },
  {
    intent: 'sleep',
    testId: 'need-sleep',
    iconName: 'housing',
    titleKey: 'needSleep',
    subtitleKey: 'needSleepSubtitle',
  },
];

export function HomeWizard() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);

  // Preserve the same session-bootstrap contract the directory has: a
  // first-time visitor who lands on the wizard (e.g. after completing
  // onboarding) gets an anonymous session minted in the background so
  // verification / community join are one tap away.
  useSessionBootstrap();

  useEffect(() => {
    document.title = `${t('pageTitleHome')} \u2014 WeaveNYC`;
  }, [t]);

  const handlePick = (intent: HomeIntent) => {
    dispatch(setLastIntent(intent));
    // We deliberately do NOT call router.push('/') here. The `page.tsx`
    // gate re-renders the tree based on `preferences.lastIntent`, so the
    // dispatch alone swaps the wizard for `<ResourceDirectory />` on the
    // next paint. A router.push would add a no-op history entry.
  };

  return (
    <>
      <TopBar variant="brand" />
      <main
        id="main-content"
        tabIndex={-1}
        className="page-content home-wizard"
        data-testid="home-wizard"
      >
        {/* Hidden shims preserve the `create-session` / `session-chip`
            testids the pre-V2-D smoke flow depends on. The wizard is a
            decision screen, not a directory, so there's no visible
            refresh affordance; the shim maps the legacy testid to a
            no-op for compatibility. */}
        <button
          type="button"
          className="sr-only"
          data-testid="create-session"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => {
            /* no-op: wizard has no list to refetch. */
          }}
        >
          {t('homeRefreshSrLabel')}
        </button>
        {session ? (
          <span className="sr-only" data-testid="session-chip">
            {session.user.user_id}
          </span>
        ) : null}

        <Stack gap={6}>
          <section className="home-wizard__hero">
            <span className="overline home-wizard__eyebrow">
              {t('homeHeroEyebrow')}
            </span>
            <h1 className="home-wizard__headline">{t('wizardTitle')}</h1>
            <p className="home-wizard__subtitle">{t('wizardSubtitle')}</p>
          </section>

          <ul
            className="home-wizard__grid"
            aria-label={t('wizardTitle')}
          >
            {NEED_CARDS.map((card) => (
              <li key={card.intent} className="home-wizard__cell">
                <button
                  type="button"
                  data-testid={card.testId}
                  className="need-card"
                  onClick={() => handlePick(card.intent)}
                >
                  <span className="need-card__icon" aria-hidden="true">
                    <Icon
                      name={card.iconName}
                      size="lg"
                      tone="accent"
                    />
                  </span>
                  <span className="need-card__title">{t(card.titleKey)}</span>
                  <span className="need-card__subtitle">
                    {t(card.subtitleKey)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Footnote uses the ZIP status line pattern from the directory so
              a user who's already set a ZIP sees context for "near you". */}
          {preferences.zipCode ? (
            <p className="muted home-wizard__footnote">
              {t('homeZipStatus', { zip: preferences.zipCode })}
            </p>
          ) : null}
        </Stack>
      </main>
    </>
  );
}
