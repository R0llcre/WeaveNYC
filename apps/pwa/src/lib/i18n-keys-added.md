# M8 i18n keys added (W3C)

This is an internal audit doc for the W3C M8 pilot readiness i18n expansion.
Delete after final review.

Totals by domain (103 new keys per language, 309 strings total).
After this change the `ChromeMessages` type contains 364 properties per language.

## Settings screen (25)

| key | EN | reason |
| --- | --- | --- |
| settingsTitle | Settings | screen header |
| settingsBackHome | Back to home | header nav action |
| settingsLanguageTitle | Language | section title |
| settingsLanguageHint | Pick the language you want to see in the app. You can change this any time. | explains language picker |
| settingsPrivacyTitle | Privacy | section title |
| settingsPostVisibilityLegend | Who can see new posts you create | fieldset legend |
| settingsVisibilityCommunity | Community only | radio label |
| settingsVisibilityCommunityHint | Only people in the same community see the post. | radio help text |
| settingsVisibilityPublic | Public | radio label |
| settingsVisibilityPublicHint | Anyone in the app can see the post. | radio help text |
| settingsVisibilityAnchor | Anchor only | radio label |
| settingsVisibilityAnchorHint | Only trusted community anchors can see the post. | radio help text |
| settingsLocationPrecisionLegend | How exact to share your location | fieldset legend |
| settingsPrecisionZip | ZIP code | radio label |
| settingsPrecisionZipHint | Share your 5-digit ZIP so we can find nearby resources. | radio help text |
| settingsPrecisionNeighborhood | Neighborhood only | radio label |
| settingsPrecisionNeighborhoodHint | Share only a neighborhood name, not the ZIP. | radio help text |
| settingsLowBandwidthLabel | Low-bandwidth mode | toggle label |
| settingsLowBandwidthHint | Turn on when you have a slow connection. Pictures and live updates are trimmed. | toggle help text |
| settingsSafetyTitle | Safety and trust | section title |
| settingsSafetyCopy | If something feels wrong, stop and check your inbox for the next safe step. | trust section body |
| settingsOpenInbox | Open inbox | cta |
| settingsHelpTitle | Help and feedback | section title |
| settingsHelpReport | Report a problem | link |
| settingsVersion | App version {version} | footer |

## Account section (12)

| key | EN | reason |
| --- | --- | --- |
| settingsAccountTitle | Account | section title |
| settingsAccountLevel | Current level | field label |
| settingsAccountLevelAnonymous | Anonymous | value |
| settingsAccountLevelVerified | Verified | value |
| settingsAccountLevelAnchor | Anchor | value |
| settingsAccountLevelNone | No session yet | value |
| settingsAccountUserId | User ID: {userId} | field row |
| deleteAccountSummary | Delete your account | disclosure summary |
| deleteAccountBody | We send a code to confirm... | explains 30-day purge |
| deleteAccountReasonLabel | Tell us why (optional) | form label |
| deleteAccountReasonPlaceholder | Share a short reason... | textarea placeholder |
| deleteAccountConfirmLabel | I understand... | checkbox label |

## Delete reason options (5)

| key | EN | reason |
| --- | --- | --- |
| deleteReasonNoLonger | I no longer need WeaveNYC | radio option |
| deleteReasonPrivacy | I want more privacy | radio option |
| deleteReasonMoving | I am moving away | radio option |
| deleteReasonSafety | I have a safety concern | radio option |
| deleteReasonOther | Another reason | radio option |

## Delete flow states (15)

| key | EN | reason |
| --- | --- | --- |
| deleteRequestButton | Start deletion | initial submit |
| deleteRequestSending | Sending code... | in-flight state |
| deleteOtpSent | We sent a code... | confirmation step copy |
| deleteOtpCodeLabel | Confirmation code | input label |
| deleteOtpVerifyButton | Confirm delete | verify submit |
| deleteOtpVerifying | Checking code... | in-flight state |
| deleteOtpResend | Send a new code | resend action |
| deleteOtpInvalid | That code did not work... | error |
| deleteScheduled | Your account is now hidden... | success state |
| deleteScheduledPurge | Your data will be permanently removed on {purgeDate}. | purge date line |
| deleteUndeleteLink | Undo deletion | link |
| deleteLastAnchorError | You are the only anchor left... | specific 409 error |
| deleteAuthError | Please sign in again... | 401 error |
| deleteGenericError | Something went wrong... | generic fallback |
| undeleteSuccess | Welcome back... | after undelete |

## Recovery code flow (8)

| key | EN | reason |
| --- | --- | --- |
| recoveryCodeTitle | Recovery code | title (settings + anchor admin) |
| recoveryCodeHelp | Lost access... | explanation |
| recoveryCodeInputLabel | Recovery code | input label |
| recoveryCodeInputPlaceholder | Enter your 12-character code | placeholder |
| recoveryCodeSubmit | Use recovery code | submit |
| recoveryCodeInvalid | That code is not valid... | 400/403 error |
| recoveryCodeRateLimit | Too many tries... | 429 error |
| recoveryCodeSuccess | Recovery code accepted... | success |

## Onboarding language screen (8)

| key | EN | reason |
| --- | --- | --- |
| onboardingStepLanguage | Step 1 of 2: Language | stepper |
| onboardingLanguageTitle | Pick your language | title |
| onboardingLanguageHint | Choose the language... | body |
| onboardingLanguageContinueEn | Continue in English | button |
| onboardingLanguageContinueEs | Continuar en espanol | button (always in target language) |
| onboardingLanguageContinueZh | Continue in Chinese | button |
| onboardingLanguageAlreadyDone | Language is already set. | skip state |
| onboardingGoToSettings | Open Settings | cta |

## Onboarding location screen (12)

| key | EN | reason |
| --- | --- | --- |
| onboardingStepLocation | Step 2 of 2: Location | stepper |
| onboardingLocationTitle | Where are you looking for help? | title |
| onboardingLocationHint | We use your ZIP... | body |
| onboardingLocationZipLabel | ZIP code | input label |
| onboardingLocationZipPlaceholder | 11373 | Queens 113xx pilot default |
| onboardingLocationZipInvalid | Please enter a valid 5-digit ZIP. | validation |
| onboardingLocationSubmit | Save and continue | primary button |
| onboardingLocationUseDevice | Use my device location | secondary button |
| onboardingLocationDeviceBlocked | Location is blocked... | browser-blocked error |
| onboardingLocationDeviceDenied | Location permission was turned off. | user-denied error |
| onboardingLocationDevicePending | Asking your device for location... | loading |
| onboardingLocationPrivacyNote | Your location stays on this device... | privacy disclosure |

## Errors / empty states / banners (18)

| key | EN | reason |
| --- | --- | --- |
| errorGeneric | Something went wrong... | fallback |
| errorNetwork | Cannot reach the network. | offline-ish |
| errorUnauthorized | Please sign in again to continue. | 401 |
| errorRateLimit | Too many tries... | 429 |
| emptyNoResults | No results matched... | empty list |
| emptyNoPosts | No posts here yet. | feed empty |
| emptyNoConversations | No conversations yet. | chat list empty |
| emptyNoReports | No reports in the queue right now. | moderation empty |
| bannerPilotMode | WeaveNYC is in early pilot... | global pilot banner |
| bannerStagingNotice | You are using the staging build. | staging env banner |
| bannerOfflineHint | You are offline. | offline banner |
| bannerSessionExpired | Your session timed out. | session banner |
| bannerAccountDeleted | This account is scheduled for deletion. | post-delete banner |
| buttonRetry | Try again | shared button |
| buttonCancel | Cancel | shared button |
| buttonContinue | Continue | shared button |
| buttonClose | Close | shared button |
| buttonLearnMore | Learn more | shared button |

## Translation decisions

- Spanish is deliberately NYC community Spanish: "tú" form, "ZIP" kept (not "código postal"
  which is a Iberian/formal register most bilingual NYC Spanish speakers do not use for
  5-digit US postal codes), "inbox" kept as a borrowed term aligned with existing keys.
- Chinese targets elderly neighbors in Queens/Brooklyn Chinatowns: plain 普通话, uses 邮编
  (not 邮政编码), 登录 (not 登入), friendly tone ("你" second person throughout, no 您),
  no 文言 or bureaucratic constructs. "App" and "inbox" kept as loanwords since M2+
  copy already uses them consistently.
- "Anchor" stays untranslated in ES and ZH - it is the product term and matches the
  existing pattern (sessionAnchor, postsGroup labels, moderation copy).
- {placeholder} interpolation style matches existing keys (resultCount, sessionIdChip, etc.).
- The new `onboardingLanguageContinueEs` label is written in Spanish even within the EN
  and ZH bundles, because that button is shown to a user who is choosing the Spanish UI
  and needs to recognize it. Same pattern for EN / ZH continue buttons.

## Success criteria verified

- pnpm typecheck clean (pwa only)
- vitest: i18n.test.ts added covering key drift, empty strings, HTML/template syntax,
  placeholder consistency.
- All three languages have identical key sets.
