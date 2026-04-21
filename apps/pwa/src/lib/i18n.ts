import type { PreferencesState, ResourceFilterType, SupportedLanguage, UserLevel } from '@/lib/types';

type ChromeMessages = {
  brand: string;
  devLink: string;
  heroEyebrow: string;
  heroTitle: string;
  heroCopy: string;
  sessionAnonymous: string;
  sessionVerified: string;
  sessionAnchor: string;
  createSession: string;
  creatingSession: string;
  sessionReady: string;
  goVerify: string;
  onboardingTitle: string;
  onboardingCopy: string;
  searchTitle: string;
  zipLabel: string;
  zipPlaceholder: string;
  zipValidation: string;
  seeNearby: string;
  refreshNearby: string;
  filtersOpenNow: string;
  filtersToday: string;
  filtersType: string;
  filtersAll: string;
  lowBandwidth: string;
  resultTitle: string;
  resultCount: string;
  sampleMode: string;
  noResults: string;
  resourceEmptyTitle: string;
  resourceEmptyBody: string;
  resourceEmptyTryAgain: string;
  resourceLoadingList: string;
  resourceLoadError: string;
  detailCta: string;
  call: string;
  directions: string;
  bookmarked: string;
  save: string;
  sessionIdChip: string;
  zipChip: string;
  /** DEPRECATED: duplicate of resourceCardDistanceMiles; migrate consumers then remove. */
  distanceMiles: string;
  anonymousSessionError: string;
  verifyTitle: string;
  verifyCopy: string;
  otpTab: string;
  magicLinkTab: string;
  phoneLabel: string;
  emailLabel: string;
  codeLabel: string;
  tokenLabel: string;
  verifyNeedsSession: string;
  verifyError: string;
  sendCode: string;
  verifyCode: string;
  sendLink: string;
  useDemoLink: string;
  demoCodeLabel: string;
  demoTokenLabel: string;
  verificationDone: string;
  backHome: string;
  // M8.5 W5C — /me/verify redesign keys
  verifyOverline: string;
  verifySectionChoose: string;
  verifySectionCode: string;
  verifyBenefitsTitle: string;
  verifyBenefit1: string;
  verifyBenefit2: string;
  verifyBenefit3: string;
  verifyMethodHelper: string;
  verifyCodeSentTitle: string;
  verifyCodeSentBody: string;
  verifyResendCode: string;
  verifySuccessTitle: string;
  verifySuccessSubtitle: string;
  verifySuccessCta: string;
  verifyBackToMe: string;
  hoursTitle: string;
  sourceTitle: string;
  notesTitle: string;
  languagesTitle: string;
  debugTitle: string;
  resourceLoading: string;
  resourceNotFound: string;
  closedLabel: string;
  notListed: string;
  noAdditionalNotes: string;
  homeCommunityCopy: string;
  homeCommunityReady: string;
  joinCommunityCta: string;
  requestHelpCta: string;
  offerHelpCta: string;
  communityTitle: string;
  communityCopy: string;
  communityAnnouncementsHeading: string;
  communityAnnouncementsCopy: string;
  communityAnnouncementsBannerLabel: string;
  communityAnnouncementsListHeading: string;
  communityAnnouncementsEmpty: string;
  communityAnnouncementsMoreEmpty: string;
  communityAnnouncementsNoCommunity: string;
  communityAnnouncementsPinnedLabel: string;
  communityFeedHeading: string;
  communityNoMembership: string;
  p2pSyncTitle: string;
  p2pSyncCopy: string;
  p2pEnableAction: string;
  p2pDisableAction: string;
  p2pSyncNowAction: string;
  p2pTransportLabel: string;
  p2pTransportBootstrap: string;
  p2pTransportMdnsDemo: string;
  p2pPeerCountLabel: string;
  p2pPeerCountValue: string;
  p2pLastSyncLabel: string;
  p2pNoSyncYet: string;
  p2pPeerIdLabel: string;
  p2pPeerIdPending: string;
  p2pOfflineMode: string;
  p2pMdnsToggle: string;
  p2pMdnsToggleCopy: string;
  p2pCacheBadge: string;
  p2pLiveRefreshDelayed: string;
  postsOfflineFallback: string;
  announcementsOfflineFallback: string;
  p2pPhase_disabled: string;
  p2pPhase_connecting: string;
  p2pPhase_ready: string;
  p2pPhase_degraded: string;
  p2pPhase_offline: string;
  // P6 UX — mapped error strings by errorCategory + retry actions
  p2pError_auth: string;
  p2pError_forbidden: string;
  p2pError_network: string;
  p2pError_server: string;
  p2pError_unknown: string;
  p2pRetrySyncAction: string;
  p2pRetrySignInAction: string;
  p2pStatusLiveUpdate: string;
  // P6 UX — Settings → Privacy → Community sync subsection
  settingsP2PSectionTitle: string;
  settingsP2PSectionCopy: string;
  settingsP2PPhaseLabel: string;
  settingsP2PNotInCommunity: string;
  settingsP2PLearnMore: string;
  p2pExplainerBody: string;
  // P6 UX — onboarding disclosure (join-community)
  joinP2PDisclosureCopy: string;
  joinP2PDisclosureSettingsLink: string;
  // P6 UX — delete account P2P peer-cache notice
  deleteAccountP2PNotice: string;
  // P6 UX — home offline last-refreshed timestamp
  homeLastRefreshedLabel: string;
  communityTab: string;
  publicTab: string;
  currentCommunityLabel: string;
  joinTitle: string;
  joinCopy: string;
  joinNeedsSession: string;
  joinInviteMode: string;
  joinInviteModeDescription: string;
  joinInviteHeading: string;
  joinQrMode: string;
  joinQrModeDescription: string;
  joinQrHeading: string;
  inviteCodeLabel: string;
  qrTokenLabel: string;
  resolveCommunityAction: string;
  clearJoinPreview: string;
  confirmJoinAction: string;
  joinStepsAriaLabel: string;
  joinModePickerHeading: string;
  joinStep1Label: string;
  joinStep2Label: string;
  joinStep3Label: string;
  joinInvalidCodeTitle: string;
  joinInvalidCodeBody: string;
  joinStartOver: string;
  joinCodeExpiredTitle: string;
  joinCodeExpiredBody: string;
  qrScanCamera: string;
  qrScanUpload: string;
  qrCapture: string;
  qrUnsupported: string;
  composeTitle: string;
  composeCopy: string;
  composeNeedsCommunity: string;
  composeNeedsVerified: string;
  composeStepType: string;
  composeStepCompose: string;
  composeStepPreview: string;
  composerStep1Label: string;
  composerStep2Label: string;
  composerStep3Label: string;
  composerValidationTitle: string;
  composerValidationEmptyTitle: string;
  composerValidationLongTitle: string;
  composerValidationEmptyBody: string;
  composerValidationLongBody: string;
  composerValidationNoCategory: string;
  composerValidationNoZip: string;
  composerValidationExpired: string;
  composerBackToEdit: string;
  composeCurrentCommunity: string;
  composeTitleLabel: string;
  composeBodyLabel: string;
  composeExpiresLabel: string;
  composePrivacyLabel: string;
  composeContactChat: string;
  composeContactText: string;
  composePublishAction: string;
  speechBrowserAction: string;
  speechFallbackAction: string;
  speechBrowserError: string;
  postsLoading: string;
  postsEmpty: string;
  postDetailTitle: string;
  postEditAction: string;
  postCloseAction: string;
  postCloseConfirmTitle: string;
  postCloseConfirmCta: string;
  postDeleteAction: string;
  postContactAction: string;
  postReported: string;
  loadingLabel: string;
  reportPost: string;
  myPostsTitle: string;
  myPostsCopy: string;
  postsGroup_active: string;
  postsGroup_pending_review: string;
  postsGroup_closed: string;
  postsGroup_removed: string;
  postsEmptyGroup: string;
  seeActionPlans: string;
  matchTitle: string;
  matchCopy: string;
  matchLoading: string;
  matchUnavailable: string;
  matchOwnerOnly: string;
  matchNeedsActiveRequest: string;
  matchRefreshAction: string;
  matchRefreshStatus: string;
  matchFreshResults: string;
  matchStaleResults: string;
  matchNoMoreRefreshes: string;
  matchNoResults: string;
  matchContactAction: string;
  matchOpenPost: string;
  matchOfficialFallback: string;
  matchContactReady: string;
  matchContinueIntent: string;
  matchClearIntent: string;
  matchContactPending: string;
  matchGoInbox: string;
  inboxTitle: string;
  inboxCopy: string;
  inboxBackHome: string;
  inboxAllTab: string;
  inboxRequestsTab: string;
  inboxChatsTab: string;
  inboxViewLabel: string;
  inboxViewHeading: string;
  inboxViewCopy: string;
  inboxRequestsTitle: string;
  inboxRequestsCopy: string;
  inboxRequestsEmpty: string;
  inboxChatsTitle: string;
  inboxChatsCopy: string;
  /** DEPRECATED: duplicate of emptyStateInboxTitle/Subtitle; migrate consumers then remove. */
  inboxChatsEmpty: string;
  inboxRefresh: string;
  inboxPendingCount: string;
  inboxUnreadCount: string;
  inboxCreated: string;
  inboxExpires: string;
  inboxAccept: string;
  inboxReject: string;
  inboxRelatedPost: string;
  inboxOpenThread: string;
  inboxPendingPreview: string;
  inboxUnreadBadge: string;
  inboxExpiresAt: string;
  inboxFromPost: string;
  inboxNeedsSession: string;
  inboxNeedsVerified: string;
  inboxVerifyAction: string;
  contactInboxTitle: string;
  contactInboxCopy: string;
  /** DEPRECATED: duplicate of emptyStateInboxTitle/Subtitle; migrate consumers then remove. */
  contactInboxEmpty: string;
  contactInboxRefresh: string;
  contactInboxCreated: string;
  contactInboxExpires: string;
  contactInboxAccept: string;
  contactInboxReject: string;
  contactInboxRelatedPost: string;
  /** DEPRECATED: duplicate of contactInboxTitle/inboxTitle; migrate consumers then remove. */
  chatInboxTitle: string;
  chatInboxCopy: string;
  /** DEPRECATED: duplicate of emptyStateInboxTitle/Subtitle; migrate consumers then remove. */
  chatInboxEmpty: string;
  chatInboxRefresh: string;
  chatInboxUnreadCount: string;
  chatInboxPendingCount: string;
  chatInboxConversationsTitle: string;
  chatInboxConversationsCopy: string;
  chatInboxPendingPreview: string;
  chatInboxUnreadBadge: string;
  chatInboxExpiresAt: string;
  chatInboxFromPost: string;
  chatInboxOpenThread: string;
  chatThreadTitle: string;
  chatThreadCopy: string;
  chatThreadLoading: string;
  chatThreadStatusLive: string;
  chatThreadDetailsTitle: string;
  chatThreadDetailsCopy: string;
  chatThreadSafetyTitle: string;
  chatThreadSafetyCopy: string;
  chatThreadQuickPhrasesTitle: string;
  chatThreadActionsTitle: string;
  chatThreadReportAction: string;
  chatThreadBlockAction: string;
  chatThreadReportedNotice: string;
  chatThreadBlockedNotice: string;
  chatThreadRelatedTitle: string;
  chatThreadRelatedPostLabel: string;
  chatThreadRelatedPostMissing: string;
  chatThreadMessagesTitle: string;
  chatThreadMessagesCopy: string;
  chatThreadLastSeen: string;
  chatThreadEmpty: string;
  chatThreadYou: string;
  chatThreadSystem: string;
  chatThreadComposerLabel: string;
  chatThreadComposerPlaceholder: string;
  chatThreadComposerHint: string;
  chatThreadSendAction: string;
  chatThreadFallbackAlias: string;
  chatQuickPhraseHello: string;
  chatQuickPhraseTiming: string;
  chatQuickPhrasePublicMeet: string;
  chatQuickPhraseThanks: string;
  // F5: Conversation logic fixes
  conversationAccessDeniedTitle: string;
  conversationAccessDeniedBody: string;
  sendFailedTitle: string;
  sendFailedRetry: string;
  wsReconnecting: string;
  wsDisconnected: string;
  // Settings screen
  settingsTitle: string;
  settingsBackHome: string;
  settingsLanguageTitle: string;
  settingsLanguageHint: string;
  settingsPrivacyTitle: string;
  settingsPostVisibilityLegend: string;
  settingsVisibilityCommunity: string;
  settingsVisibilityCommunityHint: string;
  settingsVisibilityPublic: string;
  settingsVisibilityPublicHint: string;
  settingsVisibilityAnchor: string;
  settingsVisibilityAnchorHint: string;
  settingsLocationPrecisionLegend: string;
  settingsPrecisionZip: string;
  settingsPrecisionZipHint: string;
  settingsPrecisionNeighborhood: string;
  settingsPrecisionNeighborhoodHint: string;
  settingsLowBandwidthLabel: string;
  settingsLowBandwidthHint: string;
  settingsSafetyTitle: string;
  settingsSafetyCopy: string;
  settingsOpenInbox: string;
  settingsHelpTitle: string;
  settingsHelpReport: string;
  settingsVersion: string;
  // Account section
  settingsAccountTitle: string;
  settingsAccountLevel: string;
  settingsAccountLevelAnonymous: string;
  settingsAccountLevelVerified: string;
  settingsAccountLevelAnchor: string;
  settingsAccountLevelNone: string;
  settingsAccountUserId: string;
  deleteAccountSummary: string;
  deleteAccountBody: string;
  deleteAccountReasonLabel: string;
  deleteAccountReasonHint: string;
  deleteAccountReasonPlaceholder: string;
  deleteAccountConfirmLabel: string;
  // Delete reason options
  deleteReasonNoLonger: string;
  deleteReasonPrivacy: string;
  deleteReasonMoving: string;
  deleteReasonSafety: string;
  deleteReasonOther: string;
  // Delete flow states
  deleteRequestButton: string;
  deleteRequestSending: string;
  deleteOtpSent: string;
  deleteOtpCodeLabel: string;
  deleteOtpVerifyButton: string;
  deleteOtpVerifying: string;
  deleteOtpResend: string;
  deleteOtpInvalid: string;
  deleteScheduled: string;
  deleteScheduledPurge: string;
  deleteUndeleteLink: string;
  deleteLastAnchorError: string;
  deleteAuthError: string;
  deleteGenericError: string;
  undeleteSuccess: string;
  undeleteCountdownLong: string;
  undeleteCountdownShort: string;
  undeleteExpired: string;
  undeleteSuccessTitle: string;
  undeleteSuccessBody: string;
  undeleteReverifyCta: string;
  // Recovery code flow (shared with anchor-admin)
  recoveryCodeTitle: string;
  recoveryCodeHelp: string;
  recoveryCodeInputLabel: string;
  recoveryCodeInputPlaceholder: string;
  recoveryCodeSubmit: string;
  recoveryCodeInvalid: string;
  recoveryCodeRateLimit: string;
  recoveryCodeSuccess: string;
  // Onboarding language screen
  onboardingStepLanguage: string;
  onboardingLanguageTitle: string;
  onboardingLanguageHint: string;
  onboardingLanguageContinueEn: string;
  onboardingLanguageContinueEs: string;
  onboardingLanguageContinueZh: string;
  onboardingLanguageAlreadyDone: string;
  onboardingGoToSettings: string;
  // Onboarding location screen
  onboardingStepLocation: string;
  onboardingLocationTitle: string;
  onboardingLocationHint: string;
  onboardingLocationZipLabel: string;
  onboardingLocationZipPlaceholder: string;
  onboardingLocationZipInvalid: string;
  onboardingLocationSubmit: string;
  onboardingLocationUseDevice: string;
  onboardingLocationDeviceBlocked: string;
  onboardingLocationDeviceDenied: string;
  onboardingLocationDevicePending: string;
  onboardingLocationPrivacyNote: string;
  onboardingLocationRecoverHint: string;
  // Errors / empty states / banners
  errorGeneric: string;
  errorNetwork: string;
  errorUnauthorized: string;
  errorRateLimit: string;
  emptyNoResults: string;
  emptyNoPosts: string;
  emptyNoConversations: string;
  emptyNoReports: string;
  bannerPilotMode: string;
  bannerStagingNotice: string;
  bannerOfflineHint: string;
  bannerSessionExpired: string;
  bannerAccountDeleted: string;
  buttonRetry: string;
  buttonCancel: string;
  buttonContinue: string;
  buttonClose: string;
  buttonLearnMore: string;
  // F10 accessibility keys
  skipToContent: string;
  joinCameraLabel: string;
  pageTitleHome: string;
  pageTitleVerify: string;
  pageTitleCommunity: string;
  pageTitleCommunityJoin: string;
  pageTitleResources: string;
  pageTitleResourceDetail: string;
  pageTitlePostNew: string;
  pageTitlePostsMine: string;
  pageTitlePostDetail: string;
  pageTitleMatches: string;
  pageTitleInbox: string;
  pageTitleConversation: string;
  pageTitleSettings: string;
  pageTitleOnboardingLanguage: string;
  pageTitleOnboardingLocation: string;
  // M8.5 PWA Redesign — App shell / tabs
  shellTabHome: string;
  shellTabCommunity: string;
  shellTabPost: string;
  shellTabInbox: string;
  shellTabMe: string;
  shellSkipLink: string;
  shellBackButton: string;
  /**
   * Accessible name for the primary bottom-tab <nav> landmark. Pages like
   * `/community/join` and `/post` render their own step-progress <nav>, so
   * this label lets screen readers distinguish the persistent primary
   * navigation from those per-page secondary navs.
   */
  shellTabbarLabel: string;
  // M8.5 PWA Redesign — Home (one-job discover-nearby)
  homeHeroEyebrow: string;
  homeHeroTitle: string;
  homeHeroSubtitle: string;
  homeHeroSearchPlaceholder: string;
  homeZipStatus: string;
  homeZipChange: string;
  homeEmptyTitle: string;
  homeEmptySubtitle: string;
  homeEmptyCta: string;
  // W3 review fix — distinct empty-state copy for "no ZIP" vs "no results"
  homeNoZipTitle: string;
  homeNoZipSubtitle: string;
  homeNoZipCta: string;
  homeNoResultsTitle: string;
  homeNoResultsSubtitle: string;
  homeNoResultsCta: string;
  homeLoadingLabel: string;
  homeFilterAll: string;
  homeFilterFood: string;
  homeFilterMeal: string;
  homeFilterFresh: string;
  homeFilterHealth: string;
  homeFilterHousing: string;
  homeResultsCount: string;
  // M8.5 PWA Redesign — Me hub (aggregates settings + verify + language + danger)
  meTitle: string;
  meSignedInAs: string;
  meNotSignedIn: string;
  meSectionAccount: string;
  meSectionLanguage: string;
  meSectionPrivacy: string;
  meSectionVerify: string;
  meSectionDanger: string;
  meActionSignOut: string;
  meActionChangeLanguage: string;
  meActionVerifyIdentity: string;
  meActionDeleteAccount: string;
  meVerifyStatusVerified: string;
  meVerifyStatusUnverified: string;
  meVerifyHelper: string;
  meDangerTitle: string;
  meDangerSubtitle: string;
  meDangerCta: string;
  meDeleteStep1Title: string;
  meDeleteStep1Subtitle: string;
  meDeleteStep1Cta: string;
  meDeleteStep2Title: string;
  meDeleteStep2CodePrompt: string;
  meDeleteStep2Reason: string;
  meDeleteStep2Cta: string;
  meDeleteUndoBanner: string;
  meDeleteUndoCta: string;
  // M8.5 PWA Redesign — ResourceCard atom
  resourceCardDistanceMeters: string;
  resourceCardDistanceMiles: string;
  resourceCardActionCall: string;
  resourceCardActionDirections: string;
  resourceCardActionBookmark: string;
  resourceCardActionBookmarked: string;
  resourceCardOpenNow: string;
  resourceCardClosedNow: string;
  /**
   * W4 R3 M1 — disambiguates the "open today but not right now" branch of
   * the status tag. Replaces the ambiguous "Today" label so users can
   * distinguish between "closed all day" and "will open later today".
   */
  resourceCardOpensLater: string;
  resourceCardHoursUnknown: string;
  // M8.5 PWA Redesign — Shared EmptyState atom
  emptyStateInboxTitle: string;
  emptyStateInboxSubtitle: string;
  emptyStatePostsTitle: string;
  emptyStatePostsSubtitle: string;
  emptyStatePostsCta: string;
  emptyStateMatchesTitle: string;
  emptyStateMatchesSubtitle: string;
  emptyStateSearchTitle: string;
  emptyStateSearchSubtitle: string;
  emptyStateErrorTitle: string;
  emptyStateErrorSubtitle: string;
  emptyStateErrorCta: string;
  // M8.5 PWA Redesign — Toasts
  toastSaved: string;
  toastSent: string;
  toastCopied: string;
  toastFailed: string;
  toastRetrying: string;
  // M8.5 PWA Redesign — Onboarding takeover flow
  obLangTitle: string;
  obLangSubtitle: string;
  obLangCta: string;
  obLocTitle: string;
  obLocSubtitle: string;
  obLocUseLocation: string;
  obLocZipLabel: string;
  obLocSkip: string;
  obLocCta: string;
  obDoneTitle: string;
  obDoneSubtitle: string;
  obDoneCta: string;
  // Wave 1 R4 additions — pull-to-refresh, bookmark toast, FAB
  toastBookmarkRemoved: string;
  pullToRefreshLabel: string;
  pullToRefreshRelease: string;
  pullToRefreshLoading: string;
  fabPostLabel: string;
  // Wave 4C — Resource Detail redesign (§4 plan)
  resourceDetailEyebrow: string;
  resourceDetailAddressTitle: string;
  resourceDetailPhoneTitle: string;
  resourceDetailWebsiteTitle: string;
  resourceDetailVisitWebsite: string;
  resourceDetailTodayLabel: string;
  resourceDetailShareLabel: string;
  resourceDetailSaveAction: string;
  resourceDetailRemoveAction: string;
  resourceDetailShareCopied: string;
  // M7 closeout — auth verb + UX copy consolidation
  meSignOutHint: string;
  // M8 A1-hardening — "Clear all devices" / revoke-all-sessions action
  meSignOutAllDevicesAction: string;
  meSignOutAllDevicesConfirm: string;
  composePublishing: string;
  deleteRateLimitError: string;
  joinSuccessToast: string;
  communityHeroGreeting: string;
  cameraPermissionDenied: string;
  cameraUnsupportedBrowser: string;
  obLocBack: string;
  // M8.5 — offline write outbox (subway-safe post publish).
  outboxPendingHeading: string;
  outboxPendingHint: string;
  outboxFailedHint: string;
  outboxRetryAction: string;
  outboxDiscardAction: string;
  outboxQueuedToast: string;
  outboxDrainingToast: string;
  // F4-C — chat safety-flag surfacing on rendered messages.
  // Keys follow the existing flat camelCase convention (e.g. `chatSafety*`),
  // which mirrors the rest of `chatThread*`. The server-side enum lives in
  // @weavenyc/shared `messageSafetyFlags` (see packages/shared/src/enums.ts);
  // UI copy is intentionally non-clinical ("Possible phone number") so
  // benign false positives don't scare users away from real conversations.
  chatSafetyHateSpeech: string;
  chatSafetyHarassment: string;
  chatSafetyPhone: string;
  chatSafetyAddress: string;
  chatSafetySsn: string;
  chatSafetyBankAccount: string;
  chatSafetyPassport: string;
  chatSafetyBank: string;
  chatSafetyWire: string;
  chatSafetyCrypto: string;
  chatSafetyGiftCard: string;
  chatSafetyShowAnyway: string;
  chatSafetyHidden: string;
  // F4-C — systemic error.message i18n (replaces raw English backend text
  // leaking into ZH/ES). See apps/pwa/src/lib/error-i18n.ts for mapping.
  // NOTE: `errorGeneric` and `errorNetwork` already exist above (Wave 1
  // error/empty-state block); this wave only adds the keys not already in
  // the bundle. `errorRateLimited` lives alongside the legacy
  // `errorRateLimit` key (still used by settings-screen.tsx#mapDeleteError).
  errorRateLimited: string;
  errorAuth: string;
  errorForbidden: string;
  errorServer: string;
  errorValidation: string;
  errorConflict: string;
  errorNotFound: string;
  // F4-C — shell-level "Loading…" for route Suspense fallbacks.
  shellLoading: string;
  // F4-C — shared Banner/Toast dismiss label (was hardcoded "Dismiss").
  commonDismiss: string;
};

export const messages: Record<SupportedLanguage, ChromeMessages> = {
  en: {
    brand: 'WeaveNYC',
    devLink: 'M0 debug',
    heroEyebrow: 'Nearby resources',
    heroTitle: 'Find nearby food help with a quick, easy start.',
    heroCopy: 'Pick your language, save a ZIP, and see food pantries near you. No sign-up needed to look around. Verify later only if you want to offer help or join a community.',
    sessionAnonymous: 'Looking around',
    sessionVerified: 'Verified neighbor',
    sessionAnchor: 'Community coordinator',
    createSession: 'Start looking',
    creatingSession: 'Getting ready…',
    sessionReady: 'Ready to go',
    goVerify: 'Verify',
    onboardingTitle: 'Start with language and ZIP',
    onboardingCopy: 'Keep it simple: pick the language you read best, save your ZIP, and see nearby help. You can verify or join a community later.',
    searchTitle: 'Nearby resources',
    zipLabel: 'ZIP code',
    zipPlaceholder: '11735',
    zipValidation: 'Enter a valid 5-digit ZIP code.',
    seeNearby: 'See nearby',
    refreshNearby: 'Refresh list',
    filtersOpenNow: 'Open now',
    filtersToday: 'Open today',
    filtersType: 'Type',
    filtersAll: 'All',
    lowBandwidth: 'Low-bandwidth mode',
    resultTitle: 'Official resources near you',
    resultCount: '{count} resources near you',
    sampleMode: 'Showing sample data because the real data is not ready yet.',
    noResults: 'No resources matched the current ZIP and filters.',
    resourceEmptyTitle: 'No results for ZIP {zip}',
    resourceEmptyBody: 'Try a nearby ZIP or clear your location to see all.',
    resourceEmptyTryAgain: 'Change ZIP',
    resourceLoadingList: 'Loading nearby resources…',
    resourceLoadError: 'Unable to load resources.',
    detailCta: 'View details',
    call: 'Call',
    directions: 'Directions',
    bookmarked: 'Saved',
    save: 'Save',
    sessionIdChip: 'User ID: {userId}',
    zipChip: 'ZIP: {zip}',
    distanceMiles: '{distance} mi',
    anonymousSessionError: "Couldn't start. Check your connection.",
    verifyTitle: 'Verify your identity',
    verifyCopy: 'Verify with a text code or an email link. Once verified you can offer help and send messages.',
    otpTab: '6-digit text code',
    magicLinkTab: 'Email link',
    phoneLabel: 'Phone number',
    emailLabel: 'Email address',
    codeLabel: '6-digit code',
    tokenLabel: 'Code from your email',
    verifyNeedsSession: 'Getting ready. One moment…',
    verifyError: "Couldn't verify. Check your number or email.",
    sendCode: 'Send code',
    verifyCode: 'Verify code',
    sendLink: 'Send link',
    useDemoLink: 'Verify link',
    demoCodeLabel: 'Demo code',
    demoTokenLabel: 'Demo code',
    verificationDone: 'You are already verified',
    backHome: 'Back to resources',
    verifyOverline: 'Verify',
    verifySectionChoose: 'Pick how to verify',
    verifySectionCode: 'Enter your code',
    verifyBenefitsTitle: 'Why verify?',
    verifyBenefit1: 'Offer help and reply to requests.',
    verifyBenefit2: 'Send private messages to neighbors.',
    verifyBenefit3: 'Keep your account tied to one person.',
    verifyMethodHelper: 'Choose text message or email.',
    verifyCodeSentTitle: 'Code on the way',
    verifyCodeSentBody: 'Check your messages for a 6-digit code.',
    verifyResendCode: 'Resend code',
    verifySuccessTitle: 'You are verified',
    verifySuccessSubtitle: 'Welcome back. You can now send messages and offer help.',
    verifySuccessCta: 'Back to Me',
    verifyBackToMe: 'Back to Me',
    hoursTitle: 'Weekly hours',
    sourceTitle: 'Source',
    notesTitle: 'Notes',
    languagesTitle: 'Languages',
    debugTitle: 'M0 debug console',
    resourceLoading: 'Loading resource detail…',
    resourceNotFound: 'Resource not found.',
    closedLabel: 'Closed',
    notListed: 'Not listed',
    noAdditionalNotes: 'No additional notes.',
    homeCommunityCopy: 'You can also join a community: ask neighbors for help, offer a hand to others, and see your own posts in one place.',
    homeCommunityReady: 'Community is ready',
    joinCommunityCta: 'Join community',
    requestHelpCta: 'Ask for help',
    offerHelpCta: 'Offer help',
    communityTitle: 'Community',
    communityCopy: 'Join with an invite code or QR code. Switch between community posts and public posts, and keep your own requests and offers in one place.',
    communityAnnouncementsHeading: 'Community announcements',
    communityAnnouncementsCopy: 'Latest updates for {communityName} appear here first.',
    communityAnnouncementsBannerLabel: 'Latest update',
    communityAnnouncementsListHeading: 'Earlier updates',
    communityAnnouncementsEmpty: 'No announcements yet for this community.',
    communityAnnouncementsMoreEmpty: 'No earlier announcements yet.',
    communityAnnouncementsNoCommunity: 'Join or switch to a community to see announcements.',
    communityAnnouncementsPinnedLabel: 'Pinned',
    communityFeedHeading: 'Community feed',
    communityNoMembership: 'Join a community first to unlock community-only requests and offers.',
    p2pSyncTitle: 'Keep community posts on this device',
    p2pSyncCopy: 'Save {communityName} posts and announcements on this phone, so you can still read them if your internet drops.',
    p2pEnableAction: 'Save posts on my device',
    p2pDisableAction: 'Stop saving posts',
    p2pSyncNowAction: 'Update now',
    p2pTransportLabel: 'How it connects',
    p2pTransportBootstrap: 'Main network',
    p2pTransportMdnsDemo: 'Nearby device demo',
    p2pPeerCountLabel: 'Other people online',
    p2pPeerCountValue: '{count} connected',
    p2pLastSyncLabel: 'Last updated',
    p2pNoSyncYet: 'Not saved yet',
    p2pPeerIdLabel: 'This device',
    p2pPeerIdPending: 'Getting a device name…',
    p2pOfflineMode: 'Your phone is offline. We will show saved community posts and announcements until the internet comes back.',
    p2pMdnsToggle: 'Try nearby-device sharing (test only)',
    p2pMdnsToggleCopy: 'Only shows in test builds. The main network is still the normal way.',
    p2pCacheBadge: 'Saved for offline',
    p2pLiveRefreshDelayed: 'Live updates are slow right now. Showing the last saved community posts instead.',
    postsOfflineFallback: 'Showing saved community posts from {updatedAt}.',
    announcementsOfflineFallback: 'Showing saved announcements from {updatedAt}.',
    p2pPhase_disabled: 'Off',
    p2pPhase_connecting: 'Connecting',
    p2pPhase_ready: 'Ready',
    p2pPhase_degraded: 'Weak signal',
    p2pPhase_offline: 'Offline',
    // P6 UX — mapped error copy by errorCategory
    p2pError_auth: 'Sign-in expired — please verify again.',
    p2pError_forbidden: "You're no longer a member of this community.",
    p2pError_network: "Network issue. We'll retry shortly.",
    p2pError_server: 'Community server hiccupped. Trying again…',
    p2pError_unknown: 'Sync hit a snag. Tap Retry to try again.',
    p2pRetrySyncAction: 'Try again',
    p2pRetrySignInAction: 'Sign in again',
    p2pStatusLiveUpdate: 'Posts are up to date',
    // P6 UX — Settings Privacy → Community sync subsection
    settingsP2PSectionTitle: 'Community sync',
    settingsP2PSectionCopy: 'When community sync is on, recent posts and announcements save to this phone so you can read them without internet. Your posts are also shared with other members of the same community on their own devices.',
    settingsP2PPhaseLabel: 'Status',
    settingsP2PNotInCommunity: 'Not in a community yet',
    settingsP2PLearnMore: 'Learn more about community sync',
    p2pExplainerBody: 'Community sync saves posts and announcements from your community on this device so you can open them offline. When you publish a post, a copy is shared with other members of the same community as they open the app. No one outside your community sees your posts this way, and messages never sync to other devices. You can turn this off here at any time.',
    // P6 UX — join-community disclosure (before invite code input)
    joinP2PDisclosureCopy: "When you join, recent posts and announcements save to this device for offline reading, and your posts sync to other community members' devices. You can turn this off in Settings → Privacy.",
    joinP2PDisclosureSettingsLink: 'Open Privacy settings',
    // P6 UX — delete-account peer cache notice (appended to deleteAccountBody)
    deleteAccountP2PNotice: "Posts you've shared to communities may appear on other members' devices for up to a day after deletion while peers' apps refresh.",
    // P6 UX — home offline last-refreshed timestamp
    homeLastRefreshedLabel: 'Last refreshed {time}',
    communityTab: 'Community',
    publicTab: 'Public',
    currentCommunityLabel: 'Current community',
    joinTitle: 'Join a community',
    joinCopy: 'First, type an invite code or scan a QR code. Then check the community and join.',
    joinNeedsSession: 'Getting a session ready so you can join. One moment…',
    joinInviteMode: 'Invite code',
    joinInviteModeDescription: 'Paste a code sent by a community admin.',
    joinInviteHeading: 'Enter your code',
    joinQrMode: 'QR code',
    joinQrModeDescription: 'Scan a printed QR or upload a photo.',
    joinQrHeading: 'Scan to join',
    inviteCodeLabel: 'Invite code',
    qrTokenLabel: 'QR code or scanned text',
    resolveCommunityAction: 'Check code',
    clearJoinPreview: 'Clear',
    confirmJoinAction: 'Join this community',
    joinStepsAriaLabel: 'Steps to join a community',
    joinModePickerHeading: 'Choose a way in',
    joinStep1Label: 'Step 1 of 3: Type the code',
    joinStep2Label: 'Step 2 of 3: Check the community',
    joinStep3Label: 'Step 3 of 3: Join',
    joinInvalidCodeTitle: 'We do not know this invite code',
    joinInvalidCodeBody: 'Please ask your community coordinator for a fresh invite code or QR code.',
    joinStartOver: 'Start over',
    joinCodeExpiredTitle: 'Code is too old',
    joinCodeExpiredBody: 'This invite is no longer good. Please ask for a new code and try again.',
    qrScanCamera: 'Scan with camera',
    qrScanUpload: 'Upload a QR picture',
    qrCapture: 'Read the QR code',
    qrUnsupported: 'This browser cannot read QR codes. Please type the code instead.',
    composeTitle: 'New post',
    composeCopy: 'Choose "ask" or "offer", write your post, and check it before you share. Anyone looking around can ask for help. To offer help, you need to verify.',
    composeNeedsCommunity: 'Join a community first, before you post inside a community.',
    composeNeedsVerified: 'Verify first. Offering help or sensitive posts need a verified identity.',
    composeStepType: 'Choose type',
    composeStepCompose: 'Compose',
    composeStepPreview: 'Preview',
    composerStep1Label: '1. Type',
    composerStep2Label: '2. Compose',
    composerStep3Label: '3. Preview',
    composerValidationTitle: 'Please fix these before publishing',
    composerValidationEmptyTitle: 'Title is required.',
    composerValidationLongTitle: 'Title must be 140 characters or fewer.',
    composerValidationEmptyBody: 'Details are required.',
    composerValidationLongBody: 'Details must be 1000 characters or fewer.',
    composerValidationNoCategory: 'Pick a category.',
    composerValidationNoZip: 'Enter a valid 5-digit ZIP.',
    composerValidationExpired: 'Expiration must be in the future.',
    composerBackToEdit: 'Back to edit',
    composeCurrentCommunity: 'Community',
    composeTitleLabel: 'Title',
    composeBodyLabel: 'Details',
    composeExpiresLabel: 'Expires on',
    composePrivacyLabel: 'Who can see it',
    composeContactChat: 'Chat here in the app',
    composeContactText: 'Text messages are okay',
    composePublishAction: 'Post',
    speechBrowserAction: 'Use my voice (browser)',
    speechFallbackAction: 'Upload a voice recording',
    speechBrowserError: 'Your browser could not listen. Please type instead or upload a voice recording.',
    postsLoading: 'Loading posts…',
    postsEmpty: 'No posts matched this tab yet.',
    postDetailTitle: 'Post detail',
    postEditAction: 'Edit post',
    postCloseAction: 'Close post',
    postCloseConfirmTitle: 'Close this post?',
    postCloseConfirmCta: 'Close post',
    postDeleteAction: 'Delete post',
    postContactAction: 'Contact owner',
    postReported: 'Report sent. Thanks for letting us know.',
    loadingLabel: 'Loading',
    reportPost: 'Report',
    myPostsTitle: 'My posts',
    myPostsCopy: 'Track every active, pending, closed, and removed post you created from this device.',
    postsGroup_active: 'Active',
    postsGroup_pending_review: 'Pending review',
    postsGroup_closed: 'Closed',
    postsGroup_removed: 'Removed',
    postsEmptyGroup: 'Nothing in this state yet.',
    seeActionPlans: 'See action plans',
    matchTitle: '3 ways to get help now',
    matchCopy: 'This page puts nearby neighbors and official places together, so every open request has a clear next step.',
    matchLoading: 'Finding ways to help…',
    matchUnavailable: 'We cannot show options right now.',
    matchOwnerOnly: 'Only the person who posted this request can see these options.',
    matchNeedsActiveRequest: 'Only open requests show help options.',
    matchRefreshAction: 'Show other options',
    matchRefreshStatus: '{used}/{max} options you have swapped',
    matchFreshResults: 'Showing fresh options',
    matchStaleResults: 'Tap "show other options" to see new matches',
    matchNoMoreRefreshes: 'You have swapped all the options for this request.',
    matchNoResults: 'No help options to show yet.',
    matchContactAction: 'Send a message',
    matchOpenPost: 'Open the post',
    matchOfficialFallback: 'Official place',
    matchContactReady: 'Ready to send your message to {title}.',
    matchContinueIntent: 'Send message',
    matchClearIntent: 'Clear',
    matchContactPending: 'Your message was sent. The other person will see it in their messages.',
    matchGoInbox: 'Open my messages',
    inboxTitle: 'Inbox',
    inboxCopy: 'New requests from neighbors and your chats are both here. Answer new requests first, then reply to ongoing chats.',
    inboxBackHome: 'Back to community',
    inboxAllTab: 'All',
    inboxRequestsTab: 'New requests',
    inboxChatsTab: 'Chats',
    inboxViewLabel: 'Showing {view}',
    inboxViewHeading: 'What to show',
    inboxViewCopy: 'Show new requests, show chats, or show both together.',
    inboxRequestsTitle: 'New requests',
    inboxRequestsCopy: 'New requests from neighbors show up here first.',
    inboxRequestsEmpty: 'No new requests right now.',
    inboxChatsTitle: 'Chats',
    inboxChatsCopy: 'Accepted requests and ongoing chats stay here together.',
    inboxChatsEmpty: 'No chats or new requests yet.',
    inboxRefresh: 'Check for new messages',
    inboxPendingCount: '{count} waiting',
    inboxUnreadCount: '{count} unread',
    inboxCreated: 'Sent on',
    inboxExpires: 'Expires',
    inboxAccept: 'Accept',
    inboxReject: 'Reject',
    inboxRelatedPost: 'Open the post',
    inboxOpenThread: 'Open chat',
    inboxPendingPreview: 'New request about {title}',
    inboxUnreadBadge: '{count} new',
    inboxExpiresAt: 'Expires {value}',
    inboxFromPost: 'From post: {title}',
    inboxNeedsSession: 'Tap "Start looking" first, then come back for your messages.',
    inboxNeedsVerified: 'Verify to read and reply.',
    inboxVerifyAction: 'Verify',
    contactInboxTitle: 'My messages',
    contactInboxCopy: 'New requests and chats are together here.',
    contactInboxEmpty: 'No requests or chats yet.',
    contactInboxRefresh: 'Check for new messages',
    contactInboxCreated: 'Sent on',
    contactInboxExpires: 'Expires',
    contactInboxAccept: 'Accept',
    contactInboxReject: 'Decline',
    contactInboxRelatedPost: 'Open the post',
    chatInboxTitle: 'My messages',
    chatInboxCopy: 'New requests and chats are together here.',
    chatInboxEmpty: 'No requests or chats yet.',
    chatInboxRefresh: 'Check for new messages',
    chatInboxUnreadCount: '{count} unread',
    chatInboxPendingCount: '{count} waiting requests',
    chatInboxConversationsTitle: 'Chats',
    chatInboxConversationsCopy: 'Accepted requests and ongoing chats stay here together.',
    chatInboxPendingPreview: 'New request about {title}',
    chatInboxUnreadBadge: '{count} new',
    chatInboxExpiresAt: 'Expires {value}',
    chatInboxFromPost: 'From post: {title}',
    chatInboxOpenThread: 'Open chat',
    chatThreadTitle: 'Chat',
    chatThreadCopy: 'This chat keeps the connection, quick phrases, and safety tools all in one place.',
    chatThreadLoading: 'Loading chat…',
    chatThreadStatusLive: 'Live chat',
    chatThreadDetailsTitle: 'Chat info',
    chatThreadDetailsCopy: 'You can see who is here, use quick phrases, and report a problem without leaving the chat.',
    chatThreadSafetyTitle: 'A safety tip',
    chatThreadSafetyCopy: 'Please do not share your full home address, bank info, or ID numbers here. Only share what you are okay seeing in chat history.',
    chatThreadQuickPhrasesTitle: 'Quick phrases',
    chatThreadActionsTitle: 'Safety',
    chatThreadReportAction: 'Report this chat',
    chatThreadBlockAction: 'Block this person',
    chatThreadReportedNotice: 'Report sent. A community coordinator will take a look.',
    chatThreadBlockedNotice: 'This chat is blocked. You cannot send new messages here.',
    chatThreadRelatedTitle: 'About this chat',
    chatThreadRelatedPostLabel: 'Related post',
    chatThreadRelatedPostMissing: 'This chat is not linked to a post.',
    chatThreadMessagesTitle: 'Messages',
    chatThreadMessagesCopy: 'New messages arrive here. The related post and safety tips stay next to the chat.',
    chatThreadLastSeen: 'Updated {value}',
    chatThreadEmpty: 'No messages yet. Tap a quick phrase below to say hi.',
    chatThreadYou: 'You',
    chatThreadSystem: 'System',
    chatThreadComposerLabel: 'Message',
    chatThreadComposerPlaceholder: 'Type a short, clear message…',
    chatThreadComposerHint: 'Keep it short. Do not share private info until you both agree on a safe next step.',
    chatThreadSendAction: 'Send message',
    chatThreadFallbackAlias: 'The other person',
    chatQuickPhraseHello: 'Hi, I can chat here now.',
    chatQuickPhraseTiming: 'I need about 15 minutes before I can reply.',
    chatQuickPhrasePublicMeet: 'Can we meet in a public place to be safe?',
    chatQuickPhraseThanks: 'Thank you. I am setting up the next step now.',
    // F5: Conversation logic fixes
    conversationAccessDeniedTitle: 'You cannot open this chat',
    conversationAccessDeniedBody: 'Only the two people in this chat can open it. If you think this is a mistake, go back to your messages and open it from there.',
    sendFailedTitle: "Message didn't send",
    sendFailedRetry: 'Try again',
    wsReconnecting: 'Reconnecting…',
    wsDisconnected: "Can't reach the network right now. New messages may take a moment once the connection is back.",
    // Settings screen
    settingsTitle: 'Settings',
    settingsBackHome: 'Back to home',
    settingsLanguageTitle: 'Language',
    settingsLanguageHint: 'Pick the language you want to see in the app. You can change this any time.',
    settingsPrivacyTitle: 'Privacy',
    settingsPostVisibilityLegend: 'Who can see new posts you create',
    settingsVisibilityCommunity: 'Community only',
    settingsVisibilityCommunityHint: 'Only people in the same community see the post.',
    settingsVisibilityPublic: 'Public',
    settingsVisibilityPublicHint: 'Anyone in the app can see the post.',
    settingsVisibilityAnchor: 'Only community coordinator',
    settingsVisibilityAnchorHint: 'Only trusted community coordinators can see the post.',
    settingsLocationPrecisionLegend: 'How exact to share your location',
    settingsPrecisionZip: 'ZIP code',
    settingsPrecisionZipHint: 'Share your 5-digit ZIP so we can find nearby resources.',
    settingsPrecisionNeighborhood: 'Neighborhood only',
    settingsPrecisionNeighborhoodHint: 'Share only a neighborhood name, not the ZIP.',
    settingsLowBandwidthLabel: 'Low-bandwidth mode',
    settingsLowBandwidthHint: 'Turn on when you have a slow connection. Pictures and live updates are trimmed.',
    settingsSafetyTitle: 'Safety and trust',
    settingsSafetyCopy: 'If something feels wrong, stop and open your messages to see what to do next.',
    settingsOpenInbox: 'Open inbox',
    settingsHelpTitle: 'Help and feedback',
    settingsHelpReport: 'Report a problem',
    settingsVersion: 'App version {version}',
    // Account section
    settingsAccountTitle: 'Account',
    settingsAccountLevel: 'Current level',
    settingsAccountLevelAnonymous: 'Looking around',
    settingsAccountLevelVerified: 'Verified neighbor',
    settingsAccountLevelAnchor: 'Community coordinator',
    settingsAccountLevelNone: 'Not started yet',
    settingsAccountUserId: 'User ID: {userId}',
    deleteAccountSummary: 'Delete your account',
    deleteAccountBody: 'We will send you a code to confirm. Once you confirm, your posts and messages are hidden right away. After 30 days, everything is erased for good. You can undo this any time in the next 30 days.',
    deleteAccountReasonLabel: 'Tell us why (optional)',
    deleteAccountReasonHint: 'Sharing a reason is optional. It helps us improve WeaveNYC but never affects the deletion itself.',
    deleteAccountReasonPlaceholder: 'Share a short reason so we can make this better.',
    deleteAccountConfirmLabel: 'I understand my posts and messages will be removed.',
    // Delete reason options
    deleteReasonNoLonger: 'I no longer need WeaveNYC',
    deleteReasonPrivacy: 'I want more privacy',
    deleteReasonMoving: 'I am moving away',
    deleteReasonSafety: 'I have a safety concern',
    deleteReasonOther: 'Another reason',
    // Delete flow states
    deleteRequestButton: 'Start delete',
    deleteRequestSending: 'Sending code…',
    deleteOtpSent: 'We sent a 6-digit code to your phone or email. Please type it below within 10 minutes.',
    deleteOtpCodeLabel: '6-digit code',
    deleteOtpVerifyButton: 'Confirm delete',
    deleteOtpVerifying: 'Checking code…',
    deleteOtpResend: 'Send a new code',
    deleteOtpInvalid: 'That code did not match. Please wait for a new 6-digit code or tap "Send a new code".',
    deleteScheduled: 'Your account is now hidden. You still have 30 days to undo this.',
    deleteScheduledPurge: 'Your data will be erased for good on {purgeDate}.',
    deleteUndeleteLink: 'Bring my account back',
    deleteLastAnchorError: 'You are the only community coordinator left here. Please hand the role to someone else before deleting.',
    deleteAuthError: 'Please sign in again to confirm.',
    deleteGenericError: 'Something did not work. Please check your connection and try again in a minute.',
    undeleteSuccess: 'Welcome back. Your account is active again.',
    undeleteCountdownLong: '{minutes} min {seconds} sec left to bring it back',
    undeleteCountdownShort: 'Less than 1 min left — bring it back now!',
    undeleteExpired: 'Too late to undo',
    undeleteSuccessTitle: 'Account is back',
    undeleteSuccessBody: 'Your account is back. For safety, your phone and email links were cleared. Please sign in again to keep using WeaveNYC.',
    undeleteReverifyCta: 'Verify again',
    // Recovery code flow
    recoveryCodeTitle: 'Backup code',
    recoveryCodeHelp: 'Lost your phone or email? Type a backup code from your community coordinator to sign in again.',
    recoveryCodeInputLabel: 'Backup code',
    recoveryCodeInputPlaceholder: 'Type your 12-letter code',
    recoveryCodeSubmit: 'Use code',
    recoveryCodeInvalid: 'This code is not good, or it was already used. Please ask your community coordinator for a new one.',
    recoveryCodeRateLimit: 'Too many tries. Please wait a few minutes and try again.',
    recoveryCodeSuccess: 'Backup code accepted. You are verified again.',
    // Onboarding language screen
    onboardingStepLanguage: 'Step 1 of 2: Language',
    onboardingLanguageTitle: 'Pick your language',
    onboardingLanguageHint: 'Choose the language you want to see in the app. You can change it later in Settings.',
    // G2: labels stay in target language across all dictionaries
    onboardingLanguageContinueEn: 'Continue in English',
    onboardingLanguageContinueEs: 'Continuar en español',
    onboardingLanguageContinueZh: '继续使用中文',
    onboardingLanguageAlreadyDone: 'Language is already set.',
    onboardingGoToSettings: 'Open Settings',
    // Onboarding location screen
    onboardingStepLocation: 'Step 2 of 2: Where you are',
    onboardingLocationTitle: 'Where are you looking for help?',
    onboardingLocationHint: 'We use your ZIP or neighborhood so we can show food pantries and neighbors near you. We never save your home address.',
    onboardingLocationZipLabel: 'ZIP code',
    onboardingLocationZipPlaceholder: '11373',
    onboardingLocationZipInvalid: 'Please enter a valid 5-digit ZIP.',
    onboardingLocationSubmit: 'Save and continue',
    onboardingLocationUseDevice: 'Use my device location',
    onboardingLocationDeviceBlocked: 'Location is blocked by your browser. You can still enter a ZIP.',
    onboardingLocationDeviceDenied: 'Location permission was turned off. Please enter a ZIP instead.',
    onboardingLocationDevicePending: 'Asking your device for location…',
    onboardingLocationPrivacyNote: 'Your location stays on this device. Only your ZIP is shared when you search.',
    onboardingLocationRecoverHint: 'Type your ZIP to continue.',
    // Errors / empty states / banners
    errorGeneric: 'Something did not work. Please wait a moment and try again.',
    errorNetwork: "Couldn't connect. Check your Wi-Fi or signal.",
    errorUnauthorized: 'You have been signed out. Please sign in again to keep going.',
    errorRateLimit: 'Too many tries. Please wait a minute and try again.',
    emptyNoResults: 'No results for what you are looking for.',
    emptyNoPosts: 'No posts here yet. Please come back later.',
    emptyNoConversations: 'No chats yet. Your chats will show up here.',
    emptyNoReports: 'Nothing to review right now.',
    bannerPilotMode: 'WeaveNYC is brand new. We will keep improving it with you.',
    bannerStagingNotice: 'You are using the test app. Everything here is for testing only.',
    bannerOfflineHint: "Couldn't connect. Some pages will show saved copies.",
    bannerSessionExpired: 'You were signed out. Please sign in again.',
    bannerAccountDeleted: 'This account is set to delete. You can undo it in Settings.',
    buttonRetry: 'Try again',
    buttonCancel: 'Cancel',
    buttonContinue: 'Continue',
    buttonClose: 'Close',
    buttonLearnMore: 'Learn more',
    // F10 accessibility
    skipToContent: 'Skip to main content',
    joinCameraLabel: 'Camera preview for scanning a QR code',
    pageTitleHome: 'Find help near me',
    pageTitleVerify: 'Verify',
    pageTitleCommunity: 'Community',
    pageTitleCommunityJoin: 'Join a community',
    pageTitleResources: 'Nearby help',
    pageTitleResourceDetail: 'Place info',
    pageTitlePostNew: 'New post',
    pageTitlePostsMine: 'My posts',
    pageTitlePostDetail: 'Post',
    pageTitleMatches: 'Help options',
    pageTitleInbox: 'My messages',
    pageTitleConversation: 'Chat',
    pageTitleSettings: 'Settings',
    pageTitleOnboardingLanguage: 'Language',
    pageTitleOnboardingLocation: 'Where you are',
    // M8.5 redesign — app shell
    shellTabHome: 'Home',
    shellTabCommunity: 'Community',
    shellTabPost: 'Post',
    shellTabInbox: 'Inbox',
    shellTabMe: 'Me',
    shellSkipLink: 'Skip to content',
    shellBackButton: 'Back',
    shellTabbarLabel: 'Primary',
    // M8.5 redesign — home
    homeHeroEyebrow: 'Help near you',
    homeHeroTitle: 'Help near you.',
    homeHeroSubtitle: 'Food, health, and housing support, a short walk away.',
    homeHeroSearchPlaceholder: 'Search near a ZIP',
    homeZipStatus: 'Showing results near {zip}',
    homeZipChange: 'Change',
    homeEmptyTitle: 'Nothing nearby yet.',
    homeEmptySubtitle: 'Try a wider search or a different ZIP.',
    homeEmptyCta: 'Change ZIP',
    // W3 review fix — distinct empty-state copy
    homeNoZipTitle: 'Set your ZIP',
    homeNoZipSubtitle: "We'll show help within walking distance.",
    homeNoZipCta: 'Add ZIP',
    homeNoResultsTitle: 'Nothing nearby',
    homeNoResultsSubtitle: 'Try a different filter or ZIP.',
    homeNoResultsCta: 'Change ZIP',
    homeLoadingLabel: 'Finding places…',
    homeFilterAll: 'All',
    homeFilterFood: 'Food',
    homeFilterMeal: 'Meals',
    homeFilterFresh: 'Fresh',
    homeFilterHealth: 'Health',
    homeFilterHousing: 'Housing',
    homeResultsCount: '{count} nearby',
    // M8.5 redesign — Me hub
    meTitle: 'Me',
    meSignedInAs: 'Verified as {name}',
    meNotSignedIn: 'Looking around',
    meSectionAccount: 'Account',
    meSectionLanguage: 'Language',
    meSectionPrivacy: 'Privacy',
    meSectionVerify: 'Verify',
    meSectionDanger: 'Danger zone',
    meActionSignOut: 'Clear this device',
    meActionChangeLanguage: 'Change language',
    meActionVerifyIdentity: 'Verify identity',
    meActionDeleteAccount: 'Delete account',
    meVerifyStatusVerified: 'Verified',
    meVerifyStatusUnverified: 'Not verified',
    meVerifyHelper: 'Verify to offer help and send messages.',
    meDangerTitle: 'Danger zone',
    meDangerSubtitle: 'Once deleted, your posts and messages are gone after 30 days.',
    meDangerCta: 'Delete account',
    meDeleteStep1Title: 'Delete account?',
    meDeleteStep1Subtitle: "We'll send a code to confirm. You can undo for 30 days.",
    meDeleteStep1Cta: 'Start delete',
    meDeleteStep2Title: 'Confirm delete',
    meDeleteStep2CodePrompt: 'Enter the 6-digit code we sent.',
    meDeleteStep2Reason: 'Reason (optional)',
    meDeleteStep2Cta: 'Confirm delete',
    meDeleteUndoBanner: 'Account scheduled to delete. You can undo for 30 days.',
    meDeleteUndoCta: 'Undo',
    // M8.5 redesign — ResourceCard atom
    resourceCardDistanceMeters: '{distance} m',
    resourceCardDistanceMiles: '{distance} mi',
    resourceCardActionCall: 'Call',
    resourceCardActionDirections: 'Directions',
    resourceCardActionBookmark: 'Save',
    resourceCardActionBookmarked: 'Saved',
    resourceCardOpenNow: 'Open now',
    resourceCardClosedNow: 'Closed',
    resourceCardOpensLater: 'Opens later today',
    resourceCardHoursUnknown: 'Hours not listed',
    // M8.5 redesign — EmptyState atom (shared)
    emptyStateInboxTitle: 'No messages yet.',
    emptyStateInboxSubtitle: 'New requests and chats land here.',
    emptyStatePostsTitle: 'Nothing here yet.',
    emptyStatePostsSubtitle: 'Start a post to ask for help or offer a hand.',
    emptyStatePostsCta: 'New post',
    emptyStateMatchesTitle: 'No matches yet.',
    emptyStateMatchesSubtitle: "We'll keep looking for help nearby.",
    emptyStateSearchTitle: 'No results.',
    emptyStateSearchSubtitle: 'Try a different word or ZIP.',
    emptyStateErrorTitle: "Couldn't load.",
    emptyStateErrorSubtitle: 'Check your connection and try again.',
    emptyStateErrorCta: 'Try again',
    // M8.5 redesign — toast
    toastSaved: 'Saved',
    toastSent: 'Sent',
    toastCopied: 'Copied',
    toastFailed: "Didn't send",
    toastRetrying: 'Retrying…',
    // M8.5 redesign — onboarding takeover (new step copy)
    obLangTitle: 'Pick your language',
    obLangSubtitle: 'You can change this later.',
    obLangCta: 'Continue',
    obLocTitle: 'Where are you?',
    obLocSubtitle: 'We only use your ZIP — never your home address.',
    obLocUseLocation: 'Use my location',
    obLocZipLabel: 'ZIP code',
    obLocSkip: "Skip — I'll add ZIP later",
    obLocCta: 'Save ZIP and see help',
    obDoneTitle: "You're all set.",
    obDoneSubtitle: 'Start with places near you.',
    obDoneCta: 'See nearby',
    // R4 additions
    toastBookmarkRemoved: 'Removed',
    pullToRefreshLabel: 'Pull to refresh',
    pullToRefreshRelease: 'Release to refresh',
    pullToRefreshLoading: 'Refreshing',
    fabPostLabel: 'New post',
    // Category 4 — new loading label for compose publish
    composePublishing: 'Posting…',
    // Category 2 — clear-this-device hint
    meSignOutHint: 'Your posts and messages stay. Just this phone forgets you.',
    // Category 2b — "Clear all devices" (server-side revoke every session family)
    meSignOutAllDevicesAction: 'Sign out of every device',
    meSignOutAllDevicesConfirm: 'This will sign you out on every phone and browser you\u2019ve used. Continue?',
    // Category 11 — delete rate-limit copy
    deleteRateLimitError: "You've asked to delete 3 times in the last hour. Try again in a bit, or email help@weavenyc.org for urgent removal.",
    // Category 13 — community join toast
    joinSuccessToast: 'You joined {name}. Announcements and posts are below.',
    // Category 14 — community hero greeting (de-dup)
    communityHeroGreeting: "You're in {name}.",
    // Category 15 — QR camera branches
    cameraPermissionDenied: 'Camera is blocked. Open Settings → Safari → Camera and choose Allow, then come back and tap Scan again.',
    cameraUnsupportedBrowser: "This browser can't scan QR codes. Upload a photo of the QR instead, or paste the code text.",
    // Category 16 — onboarding location back to language step
    obLocBack: 'Change language',
    // Wave 4C — Resource Detail
    resourceDetailEyebrow: 'Place info',
    resourceDetailAddressTitle: 'Address',
    resourceDetailPhoneTitle: 'Phone',
    resourceDetailWebsiteTitle: 'Website',
    resourceDetailVisitWebsite: 'Open website',
    resourceDetailTodayLabel: 'Today',
    resourceDetailShareLabel: 'Share this place',
    resourceDetailSaveAction: 'Save',
    resourceDetailRemoveAction: 'Remove',
    resourceDetailShareCopied: 'Link copied',
    // M8.5 — offline write outbox
    outboxPendingHeading: 'Waiting to publish',
    outboxPendingHint: "Will send when you're back online.",
    outboxFailedHint: "Couldn't send: {error}",
    outboxRetryAction: 'Retry now',
    outboxDiscardAction: 'Discard',
    outboxQueuedToast: "Saved — we'll publish it when you're online.",
    outboxDrainingToast: 'Sending your post\u2026',
    // F4-C — chat safety banners
    chatSafetyHateSpeech: 'This message may contain hateful language.',
    chatSafetyHarassment: 'This message may contain harassing language.',
    chatSafetyPhone: 'This message may contain a phone number.',
    chatSafetyAddress: 'This message may contain a home address.',
    chatSafetySsn: 'This message may contain a Social Security number.',
    chatSafetyBankAccount: 'This message may contain a bank account number.',
    chatSafetyPassport: 'This message mentions passport info.',
    chatSafetyBank: 'This message mentions bank details.',
    chatSafetyWire: 'This message mentions wire transfers.',
    chatSafetyCrypto: 'This message mentions cryptocurrency.',
    chatSafetyGiftCard: 'This message mentions gift cards.',
    chatSafetyShowAnyway: 'Show anyway',
    chatSafetyHidden: 'Message hidden for your safety.',
    // F4-C — error.message i18n (errorGeneric + errorNetwork already
    // declared above in the Wave 1 error block).
    errorRateLimited: 'Too many tries. Please wait a moment and try again.',
    errorAuth: 'Please sign in again to continue.',
    errorForbidden: "You don't have permission to do that.",
    errorServer: 'Something went wrong on our side. Please try again soon.',
    errorValidation: 'Please check the information and try again.',
    errorConflict: 'That was already done. Please refresh and try again.',
    errorNotFound: "We couldn't find that.",
    // F4-C — shell-level loading fallback
    shellLoading: 'Loading\u2026',
    // F4-C — Banner/Toast dismiss button label
    commonDismiss: 'Dismiss',
  },
  es: {
    brand: 'WeaveNYC',
    devLink: 'Depuración M0',
    heroEyebrow: 'Recursos cercanos',
    heroTitle: 'Encuentra ayuda con comida cerca de ti, de forma sencilla.',
    heroCopy: 'Elige tu idioma, guarda un ZIP y mira las despensas cercanas. No necesitas crear cuenta para buscar. Verifica después si quieres ofrecer ayuda o unirte a una comunidad.',
    sessionAnonymous: 'Mirando',
    sessionVerified: 'Vecino verificado',
    sessionAnchor: 'Coordinador comunitario',
    createSession: 'Empezar',
    creatingSession: 'Preparando…',
    sessionReady: 'Listo',
    goVerify: 'Verificar',
    onboardingTitle: 'Empieza con idioma y ZIP',
    onboardingCopy: 'Sencillo: elige el idioma que mejor leas, guarda tu ZIP y mira la ayuda cercana. Puedes verificarte o unirte a una comunidad más tarde.',
    searchTitle: 'Recursos cercanos',
    zipLabel: 'Código ZIP',
    zipPlaceholder: '11735',
    zipValidation: 'Ingresa un código ZIP válido de 5 dígitos.',
    seeNearby: 'Ver cercanos',
    refreshNearby: 'Actualizar la lista',
    filtersOpenNow: 'Abierto ahora',
    filtersToday: 'Abierto hoy',
    filtersType: 'Tipo',
    filtersAll: 'Todos',
    lowBandwidth: 'Modo de bajo consumo',
    resultTitle: 'Recursos oficiales cerca de ti',
    resultCount: '{count} recursos cerca de ti',
    sampleMode: 'Mostramos datos de ejemplo porque los datos reales no están listos todavía.',
    noResults: 'No hay recursos con este ZIP y estos filtros.',
    resourceEmptyTitle: 'No hay resultados para el ZIP {zip}',
    resourceEmptyBody: 'Prueba con un ZIP cercano o quita tu ubicación para ver todos.',
    resourceEmptyTryAgain: 'Cambiar ZIP',
    resourceLoadingList: 'Cargando recursos cercanos…',
    resourceLoadError: 'No se pudieron cargar los recursos.',
    detailCta: 'Ver detalles',
    call: 'Llamar',
    directions: 'Cómo llegar',
    bookmarked: 'Guardado',
    save: 'Guardar',
    sessionIdChip: 'ID de usuario: {userId}',
    zipChip: 'ZIP: {zip}',
    distanceMiles: '{distance} mi',
    anonymousSessionError: 'No se pudo empezar. Revisa tu conexión.',
    verifyTitle: 'Verifica tu identidad',
    verifyCopy: 'Verifica con un código SMS o un enlace por correo. Al verificarte puedes ofrecer ayuda y enviar mensajes.',
    otpTab: 'Código de 6 dígitos',
    magicLinkTab: 'Enlace por correo',
    phoneLabel: 'Número de teléfono',
    emailLabel: 'Correo electrónico',
    codeLabel: 'Código de 6 dígitos',
    tokenLabel: 'Código del enlace',
    verifyNeedsSession: 'Preparando…',
    verifyError: 'No se pudo verificar. Revisa tu número o correo.',
    sendCode: 'Enviar código',
    verifyCode: 'Confirmar código',
    sendLink: 'Enviar enlace',
    useDemoLink: 'Verificar enlace',
    demoCodeLabel: 'Código demo',
    demoTokenLabel: 'Código demo',
    verificationDone: 'Ya estás verificado',
    backHome: 'Volver a recursos',
    verifyOverline: 'Verificar',
    verifySectionChoose: 'Elige cómo verificar',
    verifySectionCode: 'Escribe tu código',
    verifyBenefitsTitle: '¿Por qué verificar?',
    verifyBenefit1: 'Ofrece ayuda y responde solicitudes.',
    verifyBenefit2: 'Envía mensajes privados a vecinos.',
    verifyBenefit3: 'Tu cuenta queda ligada a una persona.',
    verifyMethodHelper: 'Elige mensaje de texto o correo.',
    verifyCodeSentTitle: 'El código está en camino',
    verifyCodeSentBody: 'Revisa tus mensajes para ver el código de 6 dígitos.',
    verifyResendCode: 'Reenviar código',
    verifySuccessTitle: 'Estás verificado',
    verifySuccessSubtitle: 'Bienvenido. Ya puedes enviar mensajes y ofrecer ayuda.',
    verifySuccessCta: 'Volver a Mi',
    verifyBackToMe: 'Volver a Mi',
    hoursTitle: 'Horario semanal',
    sourceTitle: 'Fuente',
    notesTitle: 'Notas',
    languagesTitle: 'Idiomas',
    debugTitle: 'Consola de depuración M0',
    resourceLoading: 'Cargando detalle del recurso…',
    resourceNotFound: 'No se encontró el recurso.',
    closedLabel: 'Cerrado',
    notListed: 'No disponible',
    noAdditionalNotes: 'No hay notas adicionales.',
    homeCommunityCopy: 'También puedes unirte a una comunidad: pide ayuda a tus vecinos, ofréceles una mano y mira tus propias publicaciones en un solo lugar.',
    homeCommunityReady: 'Comunidad lista',
    joinCommunityCta: 'Unirme',
    requestHelpCta: 'Pedir ayuda',
    offerHelpCta: 'Ofrecer ayuda',
    communityTitle: 'Comunidad',
    communityCopy: 'Únete con un código o un QR. Cambia entre publicaciones comunitarias y públicas, y mira tus propios pedidos y ofertas en un solo lugar.',
    communityAnnouncementsHeading: 'Anuncios de la comunidad',
    communityAnnouncementsCopy: 'Las últimas novedades de {communityName} aparecen aquí primero.',
    communityAnnouncementsBannerLabel: 'Última novedad',
    communityAnnouncementsListHeading: 'Novedades anteriores',
    communityAnnouncementsEmpty: 'Todavía no hay anuncios para esta comunidad.',
    communityAnnouncementsMoreEmpty: 'Todavía no hay anuncios anteriores.',
    communityAnnouncementsNoCommunity: 'Únete o cambia a una comunidad para ver anuncios.',
    communityAnnouncementsPinnedLabel: 'Fijado',
    communityFeedHeading: 'Feed comunitario',
    communityNoMembership: 'Primero únete a una comunidad para ver y publicar mensajes dentro de ella.',
    p2pSyncTitle: 'Guardar publicaciones en este teléfono',
    p2pSyncCopy: 'Guarda las publicaciones y avisos de {communityName} en este teléfono, para que puedas verlos aunque se caiga tu internet.',
    p2pEnableAction: 'Guardar en mi teléfono',
    p2pDisableAction: 'Dejar de guardar',
    p2pSyncNowAction: 'Actualizar ahora',
    p2pTransportLabel: 'Cómo se conecta',
    p2pTransportBootstrap: 'Red principal',
    p2pTransportMdnsDemo: 'Prueba con dispositivos cercanos',
    p2pPeerCountLabel: 'Otras personas en línea',
    p2pPeerCountValue: '{count} conectadas',
    p2pLastSyncLabel: 'Última actualización',
    p2pNoSyncYet: 'Aún no guardado',
    p2pPeerIdLabel: 'Este dispositivo',
    p2pPeerIdPending: 'Obteniendo nombre del dispositivo…',
    p2pOfflineMode: 'Tu teléfono está sin conexión. Mostraremos publicaciones y avisos guardados hasta que vuelva el internet.',
    p2pMdnsToggle: 'Probar conexión con dispositivos cercanos (solo prueba)',
    p2pMdnsToggleCopy: 'Solo aparece en la versión de prueba. La red principal sigue siendo la forma normal.',
    p2pCacheBadge: 'Guardado sin conexión',
    p2pLiveRefreshDelayed: 'Las actualizaciones en vivo van lentas ahora. Mostramos las últimas publicaciones guardadas.',
    postsOfflineFallback: 'Mostrando publicaciones guardadas desde {updatedAt}.',
    announcementsOfflineFallback: 'Mostrando avisos guardados desde {updatedAt}.',
    p2pPhase_disabled: 'Apagado',
    p2pPhase_connecting: 'Conectando',
    p2pPhase_ready: 'Listo',
    p2pPhase_degraded: 'Señal débil',
    p2pPhase_offline: 'Sin conexión',
    // P6 UX — mensajes de error por categoría
    p2pError_auth: 'Tu sesión venció. Verifícate otra vez.',
    p2pError_forbidden: 'Ya no eres parte de esta comunidad.',
    p2pError_network: 'Problema de conexión. Vamos a reintentar en un momento.',
    p2pError_server: 'El servidor de la comunidad tuvo un tropiezo. Reintentando…',
    p2pError_unknown: 'Hubo un problema al sincronizar. Toca Reintentar.',
    p2pRetrySyncAction: 'Reintentar',
    p2pRetrySignInAction: 'Iniciar sesión otra vez',
    p2pStatusLiveUpdate: 'Las publicaciones están al día',
    // P6 UX — Ajustes Privacidad → Sincronización comunitaria
    settingsP2PSectionTitle: 'Sincronización comunitaria',
    settingsP2PSectionCopy: 'Cuando la sincronización comunitaria está activa, las publicaciones y avisos recientes se guardan en este teléfono para que puedas leerlos sin internet. Tus publicaciones también se comparten con otras personas de la misma comunidad en sus dispositivos.',
    settingsP2PPhaseLabel: 'Estado',
    settingsP2PNotInCommunity: 'Aún no estás en una comunidad',
    settingsP2PLearnMore: 'Saber más sobre la sincronización comunitaria',
    p2pExplainerBody: 'La sincronización comunitaria guarda publicaciones y avisos de tu comunidad en este dispositivo para que los puedas abrir sin conexión. Cuando publicas algo, una copia se comparte con otras personas de la misma comunidad cuando abren la app. Nadie fuera de tu comunidad ve tus publicaciones por esta vía, y los mensajes privados nunca se sincronizan a otros dispositivos. Puedes apagar esto aquí cuando quieras.',
    // P6 UX — aviso al unirse a una comunidad (antes del código)
    joinP2PDisclosureCopy: 'Al unirte, las publicaciones y avisos recientes se guardan en este dispositivo para leerlos sin conexión, y tus publicaciones se comparten con los dispositivos de otras personas de la comunidad. Puedes apagarlo en Ajustes → Privacidad.',
    joinP2PDisclosureSettingsLink: 'Abrir ajustes de privacidad',
    // P6 UX — aviso sobre copias en dispositivos de otros al eliminar la cuenta
    deleteAccountP2PNotice: 'Las publicaciones que compartiste en comunidades pueden seguir apareciendo en los dispositivos de otras personas hasta por un día después de eliminar, mientras sus apps se actualizan.',
    // P6 UX — última actualización en Home sin conexión
    homeLastRefreshedLabel: 'Actualizado por última vez {time}',
    communityTab: 'Comunidad',
    publicTab: 'Público',
    currentCommunityLabel: 'Comunidad actual',
    joinTitle: 'Unirse a una comunidad',
    joinCopy: 'Primero escribe el código o escanea el QR. Después revisa la comunidad y únete.',
    joinNeedsSession: 'Preparando una sesión para que puedas unirte. Un momento…',
    joinInviteMode: 'Código de invitación',
    joinInviteModeDescription: 'Pega un código enviado por un admin de la comunidad.',
    joinInviteHeading: 'Escribe tu código',
    joinQrMode: 'Código QR',
    joinQrModeDescription: 'Escanea un QR impreso o sube una foto.',
    joinQrHeading: 'Escanea para unirte',
    inviteCodeLabel: 'Código de invitación',
    qrTokenLabel: 'QR o texto escaneado',
    resolveCommunityAction: 'Revisar código',
    clearJoinPreview: 'Limpiar',
    confirmJoinAction: 'Unirme a esta comunidad',
    joinStepsAriaLabel: 'Pasos para unirte a una comunidad',
    joinModePickerHeading: 'Elige cómo entrar',
    joinStep1Label: 'Paso 1 de 3: Escribe el código',
    joinStep2Label: 'Paso 2 de 3: Revisa la comunidad',
    joinStep3Label: 'Paso 3 de 3: Unirte',
    joinInvalidCodeTitle: 'No conocemos este código',
    joinInvalidCodeBody: 'Pide al coordinador comunitario un código o QR nuevo.',
    joinStartOver: 'Empezar de nuevo',
    joinCodeExpiredTitle: 'El código ya no sirve',
    joinCodeExpiredBody: 'Esta invitación ya expiró. Pide un código nuevo e intenta otra vez.',
    qrScanCamera: 'Escanear con la cámara',
    qrScanUpload: 'Subir una foto del QR',
    qrCapture: 'Leer el QR',
    qrUnsupported: 'Este navegador no puede leer QR. Escribe el código a mano.',
    composeTitle: 'Nueva publicación',
    composeCopy: 'Elige "pedir" u "ofrecer", escribe tu mensaje y revísalo antes de compartir. Cualquier persona puede pedir ayuda. Para ofrecer ayuda tienes que verificarte.',
    composeNeedsCommunity: 'Primero únete a una comunidad para publicar dentro de ella.',
    composeNeedsVerified: 'Verifica primero. Ofrecer ayuda o publicaciones sensibles requieren identidad verificada.',
    composeStepType: 'Tipo',
    composeStepCompose: 'Redactar',
    composeStepPreview: 'Vista previa',
    composerStep1Label: '1. Tipo',
    composerStep2Label: '2. Redactar',
    composerStep3Label: '3. Vista previa',
    composerValidationTitle: 'Corrige estos campos antes de publicar',
    composerValidationEmptyTitle: 'El título es obligatorio.',
    composerValidationLongTitle: 'El título debe tener 140 caracteres o menos.',
    composerValidationEmptyBody: 'Los detalles son obligatorios.',
    composerValidationLongBody: 'Los detalles deben tener 1000 caracteres o menos.',
    composerValidationNoCategory: 'Elige una categoría.',
    composerValidationNoZip: 'Introduce un código ZIP válido de 5 dígitos.',
    composerValidationExpired: 'La fecha de expiración debe ser futura.',
    composerBackToEdit: 'Volver a editar',
    composeCurrentCommunity: 'Comunidad',
    composeTitleLabel: 'Título',
    composeBodyLabel: 'Detalles',
    composeExpiresLabel: 'Expira el',
    composePrivacyLabel: 'Quién puede verlo',
    composeContactChat: 'Chatear dentro de la app',
    composeContactText: 'Se permiten mensajes de texto',
    composePublishAction: 'Publicar',
    speechBrowserAction: 'Usar mi voz (navegador)',
    speechFallbackAction: 'Subir una grabación de voz',
    speechBrowserError: 'Tu navegador no pudo escucharte. Escribe a mano o sube una grabación de voz.',
    postsLoading: 'Cargando publicaciones…',
    postsEmpty: 'Todavía no hay publicaciones en esta pestaña.',
    postDetailTitle: 'Detalles de la publicación',
    postEditAction: 'Editar',
    postCloseAction: 'Cerrar',
    postCloseConfirmTitle: '¿Cerrar esta publicación?',
    postCloseConfirmCta: 'Cerrar publicación',
    postDeleteAction: 'Eliminar',
    postContactAction: 'Contactar',
    postReported: 'Reporte enviado. Gracias por avisarnos.',
    loadingLabel: 'Cargando',
    reportPost: 'Reportar',
    myPostsTitle: 'Mis publicaciones',
    myPostsCopy: 'Mira todas tus publicaciones activas, pendientes, cerradas y eliminadas desde este dispositivo.',
    postsGroup_active: 'Activas',
    postsGroup_pending_review: 'Pendientes',
    postsGroup_closed: 'Cerradas',
    postsGroup_removed: 'Eliminadas',
    postsEmptyGroup: 'No hay publicaciones en este estado.',
    seeActionPlans: 'Ver opciones de ayuda',
    matchTitle: '3 formas de recibir ayuda ahora',
    matchCopy: 'Esta página junta a vecinos cercanos y lugares oficiales, para que cada pedido abierto tenga un próximo paso claro.',
    matchLoading: 'Buscando formas de ayudar…',
    matchUnavailable: 'No podemos mostrar opciones ahora.',
    matchOwnerOnly: 'Solo quien publicó este pedido puede ver estas opciones.',
    matchNeedsActiveRequest: 'Solo los pedidos abiertos muestran opciones de ayuda.',
    matchRefreshAction: 'Mostrar otras opciones',
    matchRefreshStatus: '{used}/{max} opciones que has cambiado',
    matchFreshResults: 'Mostrando opciones nuevas',
    matchStaleResults: 'Toca "mostrar otras" para ver nuevas opciones',
    matchNoMoreRefreshes: 'Ya cambiaste todas las opciones para este pedido.',
    matchNoResults: 'Todavía no hay opciones para mostrar.',
    matchContactAction: 'Enviar un mensaje',
    matchOpenPost: 'Abrir la publicación',
    matchOfficialFallback: 'Lugar oficial',
    matchContactReady: 'Listo para enviar tu mensaje a {title}.',
    matchContinueIntent: 'Enviar mensaje',
    matchClearIntent: 'Limpiar',
    matchContactPending: 'Tu mensaje fue enviado. La otra persona lo verá en sus mensajes.',
    matchGoInbox: 'Abrir mis mensajes',
    inboxTitle: 'Bandeja',
    inboxCopy: 'Aquí están tus nuevas peticiones y tus chats. Responde las peticiones nuevas primero y luego sigue con los chats.',
    inboxBackHome: 'Volver a la comunidad',
    inboxAllTab: 'Todo',
    inboxRequestsTab: 'Peticiones nuevas',
    inboxChatsTab: 'Chats',
    inboxViewLabel: 'Mostrando {view}',
    inboxViewHeading: 'Qué mostrar',
    inboxViewCopy: 'Muestra peticiones nuevas, chats o las dos cosas juntas.',
    inboxRequestsTitle: 'Peticiones nuevas',
    inboxRequestsCopy: 'Las peticiones nuevas de tus vecinos aparecen aquí primero.',
    inboxRequestsEmpty: 'No hay peticiones nuevas ahora.',
    inboxChatsTitle: 'Chats',
    inboxChatsCopy: 'Las peticiones aceptadas y los chats activos se quedan aquí juntos.',
    inboxChatsEmpty: 'Todavía no hay chats ni peticiones nuevas.',
    inboxRefresh: 'Buscar mensajes nuevos',
    inboxPendingCount: '{count} en espera',
    inboxUnreadCount: '{count} sin leer',
    inboxCreated: 'Enviada',
    inboxExpires: 'Expira',
    inboxAccept: 'Aceptar',
    inboxReject: 'Rechazar',
    inboxRelatedPost: 'Abrir la publicación',
    inboxOpenThread: 'Abrir chat',
    inboxPendingPreview: 'Petición nueva sobre {title}',
    inboxUnreadBadge: '{count} nuevas',
    inboxExpiresAt: 'Expira {value}',
    inboxFromPost: 'Desde la publicación: {title}',
    inboxNeedsSession: 'Primero toca "Empezar" y vuelve para ver tus mensajes.',
    inboxNeedsVerified: 'Verifica para leer y responder.',
    inboxVerifyAction: 'Verificar',
    contactInboxTitle: 'Mis mensajes',
    contactInboxCopy: 'Las peticiones nuevas y los chats están juntos aquí.',
    contactInboxEmpty: 'Todavía no hay peticiones ni chats.',
    contactInboxRefresh: 'Buscar mensajes nuevos',
    contactInboxCreated: 'Enviada',
    contactInboxExpires: 'Expira',
    contactInboxAccept: 'Aceptar',
    contactInboxReject: 'Rechazar',
    contactInboxRelatedPost: 'Abrir la publicación',
    chatInboxTitle: 'Mis mensajes',
    chatInboxCopy: 'Las peticiones nuevas y los chats están juntos aquí.',
    chatInboxEmpty: 'Todavía no hay peticiones ni chats.',
    chatInboxRefresh: 'Buscar mensajes nuevos',
    chatInboxUnreadCount: '{count} sin leer',
    chatInboxPendingCount: '{count} peticiones en espera',
    chatInboxConversationsTitle: 'Chats',
    chatInboxConversationsCopy: 'Las peticiones aceptadas y los chats activos se quedan aquí juntos.',
    chatInboxPendingPreview: 'Petición nueva sobre {title}',
    chatInboxUnreadBadge: '{count} nuevas',
    chatInboxExpiresAt: 'Expira {value}',
    chatInboxFromPost: 'Desde la publicación: {title}',
    chatInboxOpenThread: 'Abrir chat',
    chatThreadTitle: 'Chat',
    chatThreadCopy: 'Este chat junta el contacto, las frases rápidas y las herramientas de seguridad en un mismo lugar.',
    chatThreadLoading: 'Cargando chat…',
    chatThreadStatusLive: 'Chat en vivo',
    chatThreadDetailsTitle: 'Información del chat',
    chatThreadDetailsCopy: 'Puedes ver quién está aquí, usar frases rápidas y reportar un problema sin salir del chat.',
    chatThreadSafetyTitle: 'Consejo de seguridad',
    chatThreadSafetyCopy: 'No compartas tu dirección completa, datos de banco, ni números de identificación aquí. Solo comparte lo que estés bien con que quede guardado en el chat.',
    chatThreadQuickPhrasesTitle: 'Frases rápidas',
    chatThreadActionsTitle: 'Seguridad',
    chatThreadReportAction: 'Reportar este chat',
    chatThreadBlockAction: 'Bloquear a esta persona',
    chatThreadReportedNotice: 'Reporte enviado. Un coordinador comunitario lo va a revisar.',
    chatThreadBlockedNotice: 'Este chat está bloqueado. No puedes enviar mensajes nuevos aquí.',
    chatThreadRelatedTitle: 'Sobre este chat',
    chatThreadRelatedPostLabel: 'Publicación relacionada',
    chatThreadRelatedPostMissing: 'Este chat no está ligado a ninguna publicación.',
    chatThreadMessagesTitle: 'Mensajes',
    chatThreadMessagesCopy: 'Los mensajes nuevos llegan aquí. La publicación y los consejos de seguridad se quedan visibles al lado.',
    chatThreadLastSeen: 'Actualizado {value}',
    chatThreadEmpty: 'Todavía no hay mensajes. Toca una frase rápida para saludar.',
    chatThreadYou: 'Tú',
    chatThreadSystem: 'Sistema',
    chatThreadComposerLabel: 'Mensaje',
    chatThreadComposerPlaceholder: 'Escribe un mensaje corto y claro…',
    chatThreadComposerHint: 'Sé breve. No compartas datos privados hasta que los dos acuerden un próximo paso seguro.',
    chatThreadSendAction: 'Enviar mensaje',
    chatThreadFallbackAlias: 'La otra persona',
    chatQuickPhraseHello: 'Hola, ya puedo chatear por aquí.',
    chatQuickPhraseTiming: 'Necesito unos 15 minutos antes de responder.',
    chatQuickPhrasePublicMeet: '¿Podemos vernos en un lugar público para estar seguros?',
    chatQuickPhraseThanks: 'Gracias. Estoy arreglando el próximo paso ahora.',
    // F5: Conversation logic fixes
    conversationAccessDeniedTitle: 'No puedes abrir este chat',
    conversationAccessDeniedBody: 'Solo las dos personas de este chat pueden abrirlo. Si crees que es un error, vuelve a tus mensajes y ábrelo desde allí.',
    sendFailedTitle: 'Mensaje no enviado',
    sendFailedRetry: 'Reintentar',
    wsReconnecting: 'Reconectando…',
    wsDisconnected: 'No pudimos conectar. Los mensajes nuevos pueden tardar un momento cuando vuelva la conexión.',
    // Settings screen
    settingsTitle: 'Ajustes',
    settingsBackHome: 'Volver al inicio',
    settingsLanguageTitle: 'Idioma',
    settingsLanguageHint: 'Elige el idioma que quieres ver en la app. Lo puedes cambiar cuando quieras.',
    settingsPrivacyTitle: 'Privacidad',
    settingsPostVisibilityLegend: 'Quién puede ver tus nuevas publicaciones',
    settingsVisibilityCommunity: 'Solo la comunidad',
    settingsVisibilityCommunityHint: 'Solo personas en tu comunidad ven la publicación.',
    settingsVisibilityPublic: 'Público',
    settingsVisibilityPublicHint: 'Cualquier persona en la app puede ver la publicación.',
    settingsVisibilityAnchor: 'Solo coordinador comunitario',
    settingsVisibilityAnchorHint: 'Solo los coordinadores de confianza de tu comunidad la pueden ver.',
    settingsLocationPrecisionLegend: 'Qué tanto compartir tu ubicación',
    settingsPrecisionZip: 'Código ZIP',
    settingsPrecisionZipHint: 'Comparte tu ZIP de 5 dígitos para mostrarte recursos cercanos.',
    settingsPrecisionNeighborhood: 'Solo vecindario',
    settingsPrecisionNeighborhoodHint: 'Comparte solo el nombre del vecindario, no el ZIP.',
    settingsLowBandwidthLabel: 'Modo de bajo consumo',
    settingsLowBandwidthHint: 'Actívalo si tienes conexión lenta. Las fotos y actualizaciones en vivo se reducen.',
    settingsSafetyTitle: 'Seguridad y confianza',
    settingsSafetyCopy: 'Si algo te parece raro, para y abre tus mensajes para ver el próximo paso seguro.',
    settingsOpenInbox: 'Abrir mensajes',
    settingsHelpTitle: 'Ayuda y comentarios',
    settingsHelpReport: 'Reportar un problema',
    settingsVersion: 'Versión de la app {version}',
    // Account section
    settingsAccountTitle: 'Cuenta',
    settingsAccountLevel: 'Nivel actual',
    settingsAccountLevelAnonymous: 'Mirando',
    settingsAccountLevelVerified: 'Vecino verificado',
    settingsAccountLevelAnchor: 'Coordinador comunitario',
    settingsAccountLevelNone: 'Sin empezar todavía',
    settingsAccountUserId: 'ID de usuario: {userId}',
    deleteAccountSummary: 'Eliminar tu cuenta',
    deleteAccountBody: 'Te mandamos un código para confirmar. Cuando confirmes, tus publicaciones y mensajes quedan ocultos enseguida. Después de 30 días se borran por completo. Puedes deshacerlo cuando quieras durante esos 30 días.',
    deleteAccountReasonLabel: 'Cuéntanos por qué (opcional)',
    deleteAccountReasonHint: 'Contarnos la razón es opcional. Nos ayuda a mejorar WeaveNYC pero no cambia nada sobre la eliminación.',
    deleteAccountReasonPlaceholder: 'Escribe una razón corta para ayudarnos a mejorar.',
    deleteAccountConfirmLabel: 'Entiendo que mis publicaciones y mensajes se van a eliminar.',
    // Delete reason options
    deleteReasonNoLonger: 'Ya no necesito WeaveNYC',
    deleteReasonPrivacy: 'Quiero más privacidad',
    deleteReasonMoving: 'Me estoy mudando',
    deleteReasonSafety: 'Tengo una preocupación de seguridad',
    deleteReasonOther: 'Otra razón',
    // Delete flow states
    deleteRequestButton: 'Empezar',
    deleteRequestSending: 'Enviando código…',
    deleteOtpSent: 'Te mandamos un código de 6 dígitos a tu teléfono o correo. Escríbelo aquí en los próximos 10 minutos.',
    deleteOtpCodeLabel: 'Código de 6 dígitos',
    deleteOtpVerifyButton: 'Confirmar eliminación',
    deleteOtpVerifying: 'Revisando el código…',
    deleteOtpResend: 'Enviar otro código',
    deleteOtpInvalid: 'Ese código no coincide. Espera un código nuevo o toca "Enviar otro código".',
    deleteScheduled: 'Tu cuenta ya está oculta. Todavía puedes deshacer esto por 30 días.',
    deleteScheduledPurge: 'Tus datos se borrarán por completo el {purgeDate}.',
    deleteUndeleteLink: 'Recuperar mi cuenta',
    deleteLastAnchorError: 'Eres el único coordinador comunitario aquí. Pasa el rol a otra persona antes de eliminar.',
    deleteAuthError: 'Inicia sesión otra vez para confirmar.',
    deleteGenericError: 'Algo no funcionó. Revisa tu conexión y prueba de nuevo en un momento.',
    undeleteSuccess: 'Qué bueno verte de vuelta. Tu cuenta está activa otra vez.',
    undeleteCountdownLong: 'Te quedan {minutes} min {seconds} seg para recuperarla',
    undeleteCountdownShort: '¡Queda menos de 1 min — recupérala ahora!',
    undeleteExpired: 'Ya pasó el tiempo para deshacer',
    undeleteSuccessTitle: 'Cuenta recuperada',
    undeleteSuccessBody: 'Tu cuenta ya está activa. Por seguridad, tu teléfono y correo se borraron. Inicia sesión otra vez para seguir usando WeaveNYC.',
    undeleteReverifyCta: 'Verificar de nuevo',
    // Recovery code flow
    recoveryCodeTitle: 'Código de respaldo',
    recoveryCodeHelp: '¿Perdiste tu teléfono o correo? Escribe un código de respaldo que te dio tu coordinador comunitario para volver a entrar.',
    recoveryCodeInputLabel: 'Código de respaldo',
    recoveryCodeInputPlaceholder: 'Escribe tu código de 12 letras',
    recoveryCodeSubmit: 'Usar código',
    recoveryCodeInvalid: 'Ese código no sirve o ya se usó. Pide uno nuevo.',
    recoveryCodeRateLimit: 'Muchos intentos. Espera unos minutos y prueba de nuevo.',
    recoveryCodeSuccess: 'Código aceptado. Verificado de nuevo.',
    // Onboarding language screen
    onboardingStepLanguage: 'Paso 1 de 2: Idioma',
    onboardingLanguageTitle: 'Elige tu idioma',
    onboardingLanguageHint: 'Escoge el idioma que quieres ver en la app. Lo puedes cambiar luego en Ajustes.',
    // G2: these 3 button labels must stay in the button's target language
    // regardless of the current UI language. A Chinese speaker reading a
    // Spanish-detected page must still see "继续使用中文" on the ZH button
    // so they can pick the language they read.
    onboardingLanguageContinueEn: 'Continue in English',
    onboardingLanguageContinueEs: 'Continuar en español',
    onboardingLanguageContinueZh: '继续使用中文',
    onboardingLanguageAlreadyDone: 'Ya elegiste el idioma.',
    onboardingGoToSettings: 'Abrir Ajustes',
    // Onboarding location screen
    onboardingStepLocation: 'Paso 2 de 2: Ubicación',
    onboardingLocationTitle: '¿Dónde estás buscando ayuda?',
    onboardingLocationHint: 'Usamos tu ZIP o vecindario para mostrarte despensas y vecinos cercanos. No guardamos tu dirección exacta.',
    onboardingLocationZipLabel: 'Código ZIP',
    onboardingLocationZipPlaceholder: '11373',
    onboardingLocationZipInvalid: 'Ingresa un ZIP válido de 5 dígitos.',
    onboardingLocationSubmit: 'Guardar y seguir',
    onboardingLocationUseDevice: 'Usar la ubicación de mi dispositivo',
    onboardingLocationDeviceBlocked: 'El navegador bloqueó la ubicación. Puedes escribir un ZIP a mano.',
    onboardingLocationDeviceDenied: 'No se dio permiso de ubicación. Escribe un ZIP.',
    onboardingLocationDevicePending: 'Pidiendo ubicación al dispositivo…',
    onboardingLocationPrivacyNote: 'Tu ubicación se queda en este dispositivo. Solo se comparte el ZIP cuando buscas.',
    onboardingLocationRecoverHint: 'Escribe tu ZIP para continuar.',
    // Errors / empty states / banners
    errorGeneric: 'Algo no funcionó. Espera un momento y prueba de nuevo.',
    errorNetwork: 'Sin conexión. Revisa tu Wi-Fi o señal.',
    errorUnauthorized: 'Te sacamos de tu cuenta. Inicia sesión de nuevo para seguir.',
    errorRateLimit: 'Muchos intentos. Espera un minuto y prueba de nuevo.',
    emptyNoResults: 'No encontramos nada con lo que buscas.',
    emptyNoPosts: 'Todavía no hay publicaciones. Vuelve más tarde.',
    emptyNoConversations: 'Todavía no tienes chats. Tus chats aparecerán aquí.',
    emptyNoReports: 'Nada que revisar ahora.',
    bannerPilotMode: 'WeaveNYC es nuevo. Vamos a mejorarlo contigo poco a poco.',
    bannerStagingNotice: 'Estás usando la app de prueba. Los datos aquí son solo para probar.',
    bannerOfflineHint: 'No hay conexión. Algunas páginas mostrarán copias guardadas.',
    bannerSessionExpired: 'Te sacamos de tu cuenta. Inicia sesión de nuevo.',
    bannerAccountDeleted: 'Esta cuenta se va a eliminar. Puedes deshacerlo en Ajustes.',
    buttonRetry: 'Reintentar',
    buttonCancel: 'Cancelar',
    buttonContinue: 'Continuar',
    buttonClose: 'Cerrar',
    buttonLearnMore: 'Saber más',
    // F10 accesibilidad
    skipToContent: 'Saltar al contenido principal',
    joinCameraLabel: 'Vista previa de la cámara para escanear un código QR',
    pageTitleHome: 'Buscar ayuda cerca de mí',
    pageTitleVerify: 'Verificar',
    pageTitleCommunity: 'Comunidad',
    pageTitleCommunityJoin: 'Unirse a una comunidad',
    pageTitleResources: 'Ayuda cerca de ti',
    pageTitleResourceDetail: 'Información del lugar',
    pageTitlePostNew: 'Nueva publicación',
    pageTitlePostsMine: 'Mis publicaciones',
    pageTitlePostDetail: 'Publicación',
    pageTitleMatches: 'Opciones de ayuda',
    pageTitleInbox: 'Mis mensajes',
    pageTitleConversation: 'Chat',
    pageTitleSettings: 'Ajustes',
    pageTitleOnboardingLanguage: 'Idioma',
    pageTitleOnboardingLocation: 'Dónde estás',
    // M8.5 redesign — app shell
    shellTabHome: 'Inicio',
    shellTabCommunity: 'Comunidad',
    shellTabPost: 'Publicar',
    shellTabInbox: 'Mensajes',
    shellTabMe: 'Yo',
    shellSkipLink: 'Saltar al contenido',
    shellBackButton: 'Atrás',
    shellTabbarLabel: 'Principal',
    // M8.5 redesign — home
    homeHeroEyebrow: 'Ayuda cerca de ti',
    homeHeroTitle: 'Ayuda cerca de ti.',
    homeHeroSubtitle: 'Comida, salud y vivienda, a pocos pasos.',
    homeHeroSearchPlaceholder: 'Busca un ZIP cercano',
    homeZipStatus: 'Resultados cerca de {zip}',
    homeZipChange: 'Cambiar',
    homeEmptyTitle: 'Nada cerca por ahora.',
    homeEmptySubtitle: 'Prueba con un ZIP distinto o amplía la búsqueda.',
    homeEmptyCta: 'Cambiar ZIP',
    // W3 review fix — distinct empty-state copy
    homeNoZipTitle: 'Agrega tu ZIP',
    homeNoZipSubtitle: 'Te mostraremos ayuda cerca.',
    homeNoZipCta: 'Agregar ZIP',
    homeNoResultsTitle: 'Nada cerca',
    homeNoResultsSubtitle: 'Prueba otro filtro o ZIP.',
    homeNoResultsCta: 'Cambiar ZIP',
    homeLoadingLabel: 'Buscando lugares…',
    homeFilterAll: 'Todo',
    homeFilterFood: 'Comida',
    homeFilterMeal: 'Comidas',
    homeFilterFresh: 'Frescos',
    homeFilterHealth: 'Salud',
    homeFilterHousing: 'Vivienda',
    homeResultsCount: '{count} cerca',
    // M8.5 redesign — Me hub
    meTitle: 'Yo',
    meSignedInAs: 'Verificado como {name}',
    meNotSignedIn: 'Mirando',
    meSectionAccount: 'Cuenta',
    meSectionLanguage: 'Idioma',
    meSectionPrivacy: 'Privacidad',
    meSectionVerify: 'Verificar',
    meSectionDanger: 'Zona de peligro',
    meActionSignOut: 'Cerrar esta sesión',
    meActionChangeLanguage: 'Cambiar idioma',
    meActionVerifyIdentity: 'Verificar identidad',
    meActionDeleteAccount: 'Eliminar cuenta',
    meVerifyStatusVerified: 'Verificado',
    meVerifyStatusUnverified: 'Sin verificar',
    meVerifyHelper: 'Verifícate para ofrecer ayuda y enviar mensajes.',
    meDangerTitle: 'Zona de peligro',
    meDangerSubtitle: 'Si eliminas, tus publicaciones y mensajes se borran en 30 días.',
    meDangerCta: 'Eliminar cuenta',
    meDeleteStep1Title: '¿Eliminar cuenta?',
    meDeleteStep1Subtitle: 'Te mandamos un código. Puedes deshacer en 30 días.',
    meDeleteStep1Cta: 'Empezar a eliminar',
    meDeleteStep2Title: 'Confirmar eliminación',
    meDeleteStep2CodePrompt: 'Escribe el código de 6 dígitos que te enviamos.',
    meDeleteStep2Reason: 'Razón (opcional)',
    meDeleteStep2Cta: 'Confirmar eliminación',
    meDeleteUndoBanner: 'Cuenta en proceso de eliminación. Puedes deshacer en 30 días.',
    meDeleteUndoCta: 'Deshacer',
    // M8.5 redesign — ResourceCard atom
    resourceCardDistanceMeters: '{distance} m',
    resourceCardDistanceMiles: '{distance} mi',
    resourceCardActionCall: 'Llamar',
    resourceCardActionDirections: 'Cómo llegar',
    resourceCardActionBookmark: 'Guardar',
    resourceCardActionBookmarked: 'Guardado',
    resourceCardOpenNow: 'Abierto ahora',
    resourceCardClosedNow: 'Cerrado',
    resourceCardOpensLater: 'Abre más tarde hoy',
    resourceCardHoursUnknown: 'Sin horario',
    // M8.5 redesign — EmptyState atom (shared)
    emptyStateInboxTitle: 'Aún no hay mensajes.',
    emptyStateInboxSubtitle: 'Las peticiones y chats aparecen aquí.',
    emptyStatePostsTitle: 'Aún nada aquí.',
    emptyStatePostsSubtitle: 'Crea una publicación para pedir u ofrecer ayuda.',
    emptyStatePostsCta: 'Publicar',
    emptyStateMatchesTitle: 'Aún sin opciones.',
    emptyStateMatchesSubtitle: 'Seguimos buscando ayuda cerca de ti.',
    emptyStateSearchTitle: 'Sin resultados.',
    emptyStateSearchSubtitle: 'Prueba otra palabra u otro ZIP.',
    emptyStateErrorTitle: 'No se pudo cargar.',
    emptyStateErrorSubtitle: 'Revisa tu conexión y prueba otra vez.',
    emptyStateErrorCta: 'Reintentar',
    // M8.5 redesign — toast
    toastSaved: 'Guardado',
    toastSent: 'Enviado',
    toastCopied: 'Copiado',
    toastFailed: 'No se envió',
    toastRetrying: 'Reintentando…',
    // M8.5 redesign — onboarding takeover (new step copy)
    obLangTitle: 'Elige tu idioma',
    obLangSubtitle: 'Puedes cambiarlo después.',
    obLangCta: 'Continuar',
    obLocTitle: '¿Dónde estás?',
    obLocSubtitle: 'Solo usamos tu ZIP, nunca tu dirección de casa.',
    obLocUseLocation: 'Usar mi ubicación',
    obLocZipLabel: 'Código ZIP',
    obLocSkip: 'Saltar, lo agrego después',
    obLocCta: 'Guardar y ver ayuda cerca',
    obDoneTitle: '¡Todo listo!',
    obDoneSubtitle: 'Empieza por los lugares cerca de ti.',
    obDoneCta: 'Ver cercanos',
    // R4 additions
    toastBookmarkRemoved: 'Quitado',
    pullToRefreshLabel: 'Desliza para actualizar',
    pullToRefreshRelease: 'Suelta para actualizar',
    pullToRefreshLoading: 'Actualizando',
    fabPostLabel: 'Nueva publicación',
    // Category 4 — new loading label for compose publish
    composePublishing: 'Publicando…',
    // Category 2 — clear-this-device hint
    meSignOutHint: 'Tus publicaciones y mensajes se quedan. Solo este teléfono te olvida.',
    // Category 2b — "Clear all devices"
    meSignOutAllDevicesAction: 'Cerrar sesión en todos los dispositivos',
    meSignOutAllDevicesConfirm: 'Esto cerrará tu sesión en todos los teléfonos y navegadores que has usado. ¿Continuar?',
    // Category 11 — delete rate-limit copy
    deleteRateLimitError: 'Pediste eliminar 3 veces en la última hora. Intenta en un rato, o escribe a help@weavenyc.org si es urgente.',
    // Category 13 — community join toast
    joinSuccessToast: 'Te uniste a {name}. Abajo están los avisos y publicaciones.',
    // Category 14 — community hero greeting (de-dup)
    communityHeroGreeting: 'Estás en {name}.',
    // Category 15 — QR camera branches
    cameraPermissionDenied: 'La cámara está bloqueada. Abre Configuración → Safari → Cámara y elige Permitir, luego vuelve aquí y toca Escanear.',
    cameraUnsupportedBrowser: 'Este navegador no puede escanear QR. Sube una foto del QR o pega el código.',
    // Category 16 — onboarding location back to language step
    obLocBack: 'Cambiar idioma',
    // Wave 4C — Resource Detail
    resourceDetailEyebrow: 'Información del lugar',
    resourceDetailAddressTitle: 'Dirección',
    resourceDetailPhoneTitle: 'Teléfono',
    resourceDetailWebsiteTitle: 'Sitio web',
    resourceDetailVisitWebsite: 'Abrir sitio web',
    resourceDetailTodayLabel: 'Hoy',
    resourceDetailShareLabel: 'Compartir este lugar',
    resourceDetailSaveAction: 'Guardar',
    resourceDetailRemoveAction: 'Quitar',
    resourceDetailShareCopied: 'Enlace copiado',
    // M8.5 — offline write outbox
    outboxPendingHeading: 'Pendientes de publicar',
    outboxPendingHint: 'Se enviar\u00e1 cuando vuelvas a tener conexi\u00f3n.',
    outboxFailedHint: 'No se pudo enviar: {error}',
    outboxRetryAction: 'Reintentar',
    outboxDiscardAction: 'Descartar',
    outboxQueuedToast: 'Guardado \u2014 lo publicaremos cuando tengas conexi\u00f3n.',
    outboxDrainingToast: 'Enviando tu publicaci\u00f3n\u2026',
    // F4-C — chat safety banners
    chatSafetyHateSpeech: 'Este mensaje puede contener lenguaje de odio.',
    chatSafetyHarassment: 'Este mensaje puede contener lenguaje de acoso.',
    chatSafetyPhone: 'Este mensaje puede incluir un n\u00famero de tel\u00e9fono.',
    chatSafetyAddress: 'Este mensaje puede incluir una direcci\u00f3n de casa.',
    chatSafetySsn: 'Este mensaje puede incluir un n\u00famero de Seguro Social.',
    chatSafetyBankAccount: 'Este mensaje puede incluir un n\u00famero de cuenta bancaria.',
    chatSafetyPassport: 'Este mensaje menciona informaci\u00f3n de pasaporte.',
    chatSafetyBank: 'Este mensaje menciona datos bancarios.',
    chatSafetyWire: 'Este mensaje menciona transferencias bancarias.',
    chatSafetyCrypto: 'Este mensaje menciona criptomonedas.',
    chatSafetyGiftCard: 'Este mensaje menciona tarjetas de regalo.',
    chatSafetyShowAnyway: 'Mostrar de todos modos',
    chatSafetyHidden: 'Mensaje oculto por tu seguridad.',
    // F4-C — error.message i18n
    errorRateLimited: 'Demasiados intentos. Espera un momento e int\u00e9ntalo de nuevo.',
    errorAuth: 'Inicia sesi\u00f3n de nuevo para continuar.',
    errorForbidden: 'No tienes permiso para hacer eso.',
    errorServer: 'Algo sali\u00f3 mal de nuestro lado. Int\u00e9ntalo pronto.',
    errorValidation: 'Revisa la informaci\u00f3n e int\u00e9ntalo de nuevo.',
    errorConflict: 'Eso ya se hizo. Actualiza e int\u00e9ntalo de nuevo.',
    errorNotFound: 'No encontramos eso.',
    // F4-C — shell-level loading fallback
    shellLoading: 'Cargando\u2026',
    // F4-C — Banner/Toast dismiss button label
    commonDismiss: 'Descartar',
  },
  zh: {
    brand: 'WeaveNYC',
    devLink: 'M0 调试',
    heroEyebrow: '附近的帮助',
    heroTitle: '几步就能找到附近的食物帮助',
    heroCopy: '选一个你看得懂的语言，存下邮编，就能看到附近的食物发放点。想随便看看不用验证。以后想帮别人或加入社区，再验证也来得及。',
    sessionAnonymous: '只是看看',
    sessionVerified: '已验证的邻居',
    sessionAnchor: '社区协调员',
    createSession: '开始看看',
    creatingSession: '准备中……',
    sessionReady: '可以出发了',
    goVerify: '去验证',
    onboardingTitle: '先选语言，再填邮编',
    onboardingCopy: '很简单：选一个你读起来最顺的语言，存下邮编，就能看到附近的帮助。之后再验证或加入社区都行。',
    searchTitle: '附近的帮助',
    zipLabel: '邮编',
    zipPlaceholder: '11735',
    zipValidation: '填 5 位数的邮编。',
    seeNearby: '看附近',
    refreshNearby: '刷新',
    filtersOpenNow: '现在开着',
    filtersToday: '今天开',
    filtersType: '类别',
    filtersAll: '全部',
    lowBandwidth: '省流量',
    resultTitle: '你附近的官方资源',
    resultCount: '附近 {count} 个',
    sampleMode: '真实数据还没接上，先给你看一批样例。',
    noResults: '这个邮编和筛选下没有结果。',
    resourceEmptyTitle: '{zip} 附近暂时没有',
    resourceEmptyBody: '换个附近的邮编，或者清掉位置看全部。',
    resourceEmptyTryAgain: '换邮编',
    resourceLoadingList: '正在找附近的帮助……',
    resourceLoadError: '加载不出来。检查一下网络再试。',
    detailCta: '看详情',
    call: '打电话',
    directions: '导航',
    bookmarked: '已收藏',
    save: '收藏',
    sessionIdChip: '用户 ID：{userId}',
    zipChip: 'ZIP：{zip}',
    distanceMiles: '{distance} 英里',
    anonymousSessionError: '没能开始。检查一下网络。',
    verifyTitle: '验证你的身份',
    verifyCopy: '用短信验证码或邮箱链接验证身份。验证后就能帮忙和发私信。',
    otpTab: '短信验证码',
    magicLinkTab: '邮箱链接',
    phoneLabel: '手机号',
    emailLabel: '邮箱',
    codeLabel: '6 位验证码',
    tokenLabel: '邮箱里的验证码',
    verifyNeedsSession: '正在准备……',
    verifyError: '没能验证。检查一下手机号或邮箱。',
    sendCode: '发送验证码',
    verifyCode: '确认验证码',
    sendLink: '发送链接',
    useDemoLink: '验证链接',
    demoCodeLabel: '演示验证码',
    demoTokenLabel: '演示验证码',
    verificationDone: '你已经验证过了',
    backHome: '回附近帮助',
    verifyOverline: '身份验证',
    verifySectionChoose: '选验证方式',
    verifySectionCode: '填验证码',
    verifyBenefitsTitle: '为什么要验证？',
    verifyBenefit1: '可以帮忙、回复别人的求助。',
    verifyBenefit2: '可以给邻居发私信。',
    verifyBenefit3: '账号只属于你一个人。',
    verifyMethodHelper: '选短信或邮箱。',
    verifyCodeSentTitle: '验证码已发出',
    verifyCodeSentBody: '看一下短信，里面有 6 位验证码。',
    verifyResendCode: '再发一次',
    verifySuccessTitle: '验证通过',
    verifySuccessSubtitle: '欢迎回来。现在你可以发私信、也可以帮忙。',
    verifySuccessCta: '回到「我」',
    verifyBackToMe: '回到「我」',
    hoursTitle: '每周开放时间',
    sourceTitle: '数据来源',
    notesTitle: '备注',
    languagesTitle: '支持的语言',
    debugTitle: 'M0 调试台',
    resourceLoading: '正在加载详情……',
    resourceNotFound: '没找到这个地方。',
    closedLabel: '关门',
    notListed: '没写',
    noAdditionalNotes: '没有更多备注。',
    homeCommunityCopy: '你也可以加入一个社区：找邻居帮忙，搭一把手给别人，自己发的帖子也都能一块儿看到。',
    homeCommunityReady: '社区已就绪',
    joinCommunityCta: '加入社区',
    requestHelpCta: '求助',
    offerHelpCta: '帮忙',
    communityTitle: '社区',
    communityCopy: '用邀请码或 QR 码加入。在社区帖和公开帖之间切换，自己的求助和帮助也都放在一块儿。',
    communityAnnouncementsHeading: '社区公告',
    communityAnnouncementsCopy: '{communityName} 的最新通知会先出现在这里。',
    communityAnnouncementsBannerLabel: '最新通知',
    communityAnnouncementsListHeading: '之前的通知',
    communityAnnouncementsEmpty: '这个社区还没有公告。',
    communityAnnouncementsMoreEmpty: '没有更早的公告了。',
    communityAnnouncementsNoCommunity: '加入或切换到一个社区，就能看到公告。',
    communityAnnouncementsPinnedLabel: '置顶',
    communityFeedHeading: '社区动态',
    communityNoMembership: '先加入一个社区，才能看到和发社区里的求助和帮助。',
    p2pSyncTitle: '把社区帖子存在这部手机里',
    p2pSyncCopy: '把 {communityName} 的帖子和公告存在这部手机上。断网的时候也还能看。',
    p2pEnableAction: '存到这部手机',
    p2pDisableAction: '不再保存',
    p2pSyncNowAction: '现在更新',
    p2pTransportLabel: '怎么连的',
    p2pTransportBootstrap: '主网络',
    p2pTransportMdnsDemo: '附近设备（测试）',
    p2pPeerCountLabel: '在线的人',
    p2pPeerCountValue: '{count} 个在线',
    p2pLastSyncLabel: '上次更新',
    p2pNoSyncYet: '还没存过',
    p2pPeerIdLabel: '这部手机',
    p2pPeerIdPending: '正在取设备名……',
    p2pOfflineMode: '你的手机现在没网。先给你看之前存下来的社区帖子和公告，等网络回来再更新。',
    p2pMdnsToggle: '试试附近设备分享（只在测试版）',
    p2pMdnsToggleCopy: '只在测试版里出现。平常还是走主网络。',
    p2pCacheBadge: '离线可看',
    p2pLiveRefreshDelayed: '实时更新有点慢，先给你看之前存下来的社区内容。',
    postsOfflineFallback: '正在显示 {updatedAt} 存下来的社区帖子。',
    announcementsOfflineFallback: '正在显示 {updatedAt} 存下来的公告。',
    p2pPhase_disabled: '已关闭',
    p2pPhase_connecting: '连接中',
    p2pPhase_ready: '已连上',
    p2pPhase_degraded: '信号弱',
    p2pPhase_offline: '离线',
    // P6 UX — 按错误类别显示的提示
    p2pError_auth: '登录过期了，重新验证一下。',
    p2pError_forbidden: '你已经不在这个社区里了。',
    p2pError_network: '网络有点问题，等一下会再试。',
    p2pError_server: '社区服务器小打嗝，正在重试……',
    p2pError_unknown: '同步卡住了。点「重试」再试一次。',
    p2pRetrySyncAction: '再试一次',
    p2pRetrySignInAction: '重新登录',
    p2pStatusLiveUpdate: '帖子都是最新的',
    // P6 UX — 设置 隐私 → 社区同步
    settingsP2PSectionTitle: '社区同步',
    settingsP2PSectionCopy: '打开社区同步后，最近的帖子和公告会存在这部手机上，没网也能看。你发的帖子也会同步到同一个社区其他人的手机上。',
    settingsP2PPhaseLabel: '状态',
    settingsP2PNotInCommunity: '你还没加入社区',
    settingsP2PLearnMore: '了解社区同步',
    p2pExplainerBody: '社区同步会把你社区里的帖子和公告存在这部手机上，没网的时候也能打开看。你发帖的时候，社区里其他人打开 App，就能在他们的手机上看到一份。社区外面的人看不到你这样同步的帖子，私聊也不会同步到别人手机。你随时可以在这里关掉。',
    // P6 UX — 加入社区前的说明（放在邀请码输入框之前）
    joinP2PDisclosureCopy: '加入以后，最近的帖子和公告会存在这部手机上，没网也能看；你发的帖子也会同步到同社区其他人的手机上。你可以在 设置 → 隐私 里关掉。',
    joinP2PDisclosureSettingsLink: '打开隐私设置',
    // P6 UX — 删除账号时关于他人手机缓存的提醒
    deleteAccountP2PNotice: '你在社区里发过的帖子，可能在你删除后还会在其他人的手机上停留一天左右，等他们的 App 刷新才会没掉。',
    // P6 UX — Home 离线时显示的上次刷新时间
    homeLastRefreshedLabel: '上次更新 {time}',
    communityTab: '社区',
    publicTab: '公开',
    currentCommunityLabel: '当前社区',
    joinTitle: '加入一个社区',
    joinCopy: '先输邀请码，或者扫 QR 码。看看是哪个社区，再加入。',
    joinNeedsSession: '正在给你准备加入流程。请稍等……',
    joinInviteMode: '邀请码',
    joinInviteModeDescription: '粘贴社区管理员发给你的码。',
    joinInviteHeading: '输入邀请码',
    joinQrMode: 'QR 码',
    joinQrModeDescription: '扫纸上的 QR 码，或上传一张图。',
    joinQrHeading: '扫码加入',
    inviteCodeLabel: '邀请码',
    qrTokenLabel: 'QR 码内容',
    resolveCommunityAction: '核对',
    clearJoinPreview: '清除',
    confirmJoinAction: '加入',
    joinStepsAriaLabel: '加入社区的步骤',
    joinModePickerHeading: '选一种方式',
    joinStep1Label: '第 1 步（共 3 步）：输邀请码',
    joinStep2Label: '第 2 步（共 3 步）：看看社区',
    joinStep3Label: '第 3 步（共 3 步）：加入',
    joinInvalidCodeTitle: '没找到这个邀请码',
    joinInvalidCodeBody: '找社区协调员要一个新的邀请码或 QR 码。',
    joinStartOver: '重新来',
    joinCodeExpiredTitle: '邀请码过期了',
    joinCodeExpiredBody: '这个邀请码已经不能用了。找协调员要一个新的再试。',
    qrScanCamera: '用相机扫',
    qrScanUpload: '上传一张 QR 图',
    qrCapture: '识别 QR 码',
    qrUnsupported: '这个浏览器没法扫 QR 码。手动输入邀请码吧。',
    composeTitle: '新帖子',
    composeCopy: '先选「求助」还是「帮忙」，写好内容，预览一下再发。随便看看的人也能发求助帖；要帮别人，先验证一下。',
    composeNeedsCommunity: '先加入一个社区，才能在里面发帖。',
    composeNeedsVerified: '先验证身份。想帮人或发敏感帖要先验证。',
    composeStepType: '选类型',
    composeStepCompose: '写内容',
    composeStepPreview: '预览',
    composerStep1Label: '1. 类型',
    composerStep2Label: '2. 写内容',
    composerStep3Label: '3. 预览',
    composerValidationTitle: '发帖前先改一下这几处',
    composerValidationEmptyTitle: '标题不能空。',
    composerValidationLongTitle: '标题最多 140 个字。',
    composerValidationEmptyBody: '内容不能空。',
    composerValidationLongBody: '内容最多 1000 个字。',
    composerValidationNoCategory: '选一个类别。',
    composerValidationNoZip: '填 5 位数的邮编。',
    composerValidationExpired: '过期时间要选一个未来的日子。',
    composerBackToEdit: '回去改',
    composeCurrentCommunity: '社区',
    composeTitleLabel: '标题',
    composeBodyLabel: '内容',
    composeExpiresLabel: '过期时间',
    composePrivacyLabel: '谁能看',
    composeContactChat: '在 app 里聊',
    composeContactText: '可以发短信',
    composePublishAction: '发帖',
    speechBrowserAction: '用语音输入（浏览器）',
    speechFallbackAction: '上传一段语音',
    speechBrowserError: '浏览器没听清。你可以打字，或者上传一段语音。',
    postsLoading: '正在加载帖子……',
    postsEmpty: '这里还没有帖子。',
    postDetailTitle: '帖子详情',
    postEditAction: '修改',
    postCloseAction: '关闭帖子',
    postCloseConfirmTitle: '关闭这条帖子？',
    postCloseConfirmCta: '关闭帖子',
    postDeleteAction: '删除',
    postContactAction: '联系发帖人',
    postReported: '举报已送出。谢谢告诉我们。',
    loadingLabel: '加载中',
    reportPost: '举报',
    myPostsTitle: '我的帖子',
    myPostsCopy: '你在这部手机上发过的帖子，都可以按进行中、待审核、已关闭、已删除来看。',
    postsGroup_active: '进行中',
    postsGroup_pending_review: '待审核',
    postsGroup_closed: '已关闭',
    postsGroup_removed: '已删除',
    postsEmptyGroup: '这里还没有帖子。',
    seeActionPlans: '看看有哪些办法',
    matchTitle: '现在可以试的 3 个办法',
    matchCopy: '这里把附近的邻居和官方地点放一起，让每一条还没解决的求助都有下一步。',
    matchLoading: '正在找办法……',
    matchUnavailable: '现在没有可以显示的办法。',
    matchOwnerOnly: '只有发这条求助的人能看到这些办法。',
    matchNeedsActiveRequest: '只有还在进行中的求助才会显示办法。',
    matchRefreshAction: '换一批',
    matchRefreshStatus: '已换 {used}/{max} 批',
    matchFreshResults: '这是最新一批',
    matchStaleResults: '点「换一批」看新的',
    matchNoMoreRefreshes: '这条求助的所有办法都换过了。',
    matchNoResults: '暂时没有办法可显示。',
    matchContactAction: '发消息',
    matchOpenPost: '打开帖子',
    matchOfficialFallback: '官方地点',
    matchContactReady: '可以把消息发给 {title}。',
    matchContinueIntent: '发送',
    matchClearIntent: '取消',
    matchContactPending: '消息已发出。对方会在自己的消息里看到。',
    matchGoInbox: '打开消息',
    inboxTitle: '消息',
    inboxCopy: '邻居的新请求和你的聊天都在这里。先回新请求，再继续聊。',
    inboxBackHome: '回社区',
    inboxAllTab: '全部',
    inboxRequestsTab: '新请求',
    inboxChatsTab: '聊天',
    inboxViewLabel: '正在看：{view}',
    inboxViewHeading: '看什么',
    inboxViewCopy: '可以只看新请求、只看聊天，或者两样一起看。',
    inboxRequestsTitle: '新请求',
    inboxRequestsCopy: '邻居发来的新请求会先出现在这里。',
    inboxRequestsEmpty: '现在没有新请求。',
    inboxChatsTitle: '聊天',
    inboxChatsCopy: '已接受的请求和正在聊的对话都在这里。',
    inboxChatsEmpty: '还没有聊天，也没有新请求。',
    inboxRefresh: '刷新消息',
    inboxPendingCount: '{count} 条在等',
    inboxUnreadCount: '{count} 条未读',
    inboxCreated: '发来于',
    inboxExpires: '过期',
    inboxAccept: '接受',
    inboxReject: '拒绝',
    inboxRelatedPost: '打开帖子',
    inboxOpenThread: '打开聊天',
    inboxPendingPreview: '关于 {title} 的新请求',
    inboxUnreadBadge: '{count} 条新',
    inboxExpiresAt: '{value} 过期',
    inboxFromPost: '来自帖子：{title}',
    inboxNeedsSession: '先点「开始看看」，再回来看消息。',
    inboxNeedsVerified: '先验证，才能看和回消息。',
    inboxVerifyAction: '去验证',
    contactInboxTitle: '我的消息',
    contactInboxCopy: '新请求和聊天都在这里。',
    contactInboxEmpty: '还没有请求，也没有聊天。',
    contactInboxRefresh: '刷新消息',
    contactInboxCreated: '发来于',
    contactInboxExpires: '过期',
    contactInboxAccept: '接受',
    contactInboxReject: '拒绝',
    contactInboxRelatedPost: '打开帖子',
    chatInboxTitle: '我的消息',
    chatInboxCopy: '新请求和聊天都在这里。',
    chatInboxEmpty: '还没有请求，也没有聊天。',
    chatInboxRefresh: '刷新消息',
    chatInboxUnreadCount: '{count} 条未读',
    chatInboxPendingCount: '{count} 个请求在等',
    chatInboxConversationsTitle: '聊天',
    chatInboxConversationsCopy: '已接受的请求和正在聊的对话都在这里。',
    chatInboxPendingPreview: '关于 {title} 的新请求',
    chatInboxUnreadBadge: '{count} 条新',
    chatInboxExpiresAt: '{value} 过期',
    chatInboxFromPost: '来自帖子：{title}',
    chatInboxOpenThread: '打开聊天',
    chatThreadTitle: '聊天',
    chatThreadCopy: '聊天、常用短语、安全工具都在一个地方。',
    chatThreadLoading: '正在加载……',
    chatThreadStatusLive: '实时聊天',
    chatThreadDetailsTitle: '聊天信息',
    chatThreadDetailsCopy: '这里能看到谁在、用常用短语，不用离开聊天就能举报问题。',
    chatThreadSafetyTitle: '一个小提醒',
    chatThreadSafetyCopy: '不要在这里发详细家庭住址、银行信息或证件号。只发你愿意留在聊天记录里的内容。',
    chatThreadQuickPhrasesTitle: '常用短语',
    chatThreadActionsTitle: '安全',
    chatThreadReportAction: '举报这段聊天',
    chatThreadBlockAction: '屏蔽这个人',
    chatThreadReportedNotice: '举报已送出。社区协调员会看一下。',
    chatThreadBlockedNotice: '这段聊天已经屏蔽了。你没法在这里再发消息。',
    chatThreadRelatedTitle: '关于这个聊天',
    chatThreadRelatedPostLabel: '相关帖子',
    chatThreadRelatedPostMissing: '这个聊天没有对应的帖子。',
    chatThreadMessagesTitle: '消息',
    chatThreadMessagesCopy: '新消息会出现在这里，相关帖子和安全提示一直都在旁边。',
    chatThreadLastSeen: '最近更新 {value}',
    chatThreadEmpty: '还没有消息。点下面的常用短语先打个招呼。',
    chatThreadYou: '你',
    chatThreadSystem: '系统',
    chatThreadComposerLabel: '消息',
    chatThreadComposerPlaceholder: '写一条简短清楚的消息……',
    chatThreadComposerHint: '先写短一点。没商量好下一步之前，别发太多私人信息。',
    chatThreadSendAction: '发送',
    chatThreadFallbackAlias: '对方',
    chatQuickPhraseHello: '你好，现在可以在这里聊。',
    chatQuickPhraseTiming: '我大概 15 分钟后回你。',
    chatQuickPhrasePublicMeet: '我们约个人多的地方见面，好吗？',
    chatQuickPhraseThanks: '谢谢，我这就去安排下一步。',
    // F5: 会话逻辑修复
    conversationAccessDeniedTitle: '这段聊天你打不开',
    conversationAccessDeniedBody: '只有聊天里的两个人能打开。如果你觉得是弄错了，回到「消息」再从那里进来。',
    sendFailedTitle: '消息没发出去',
    sendFailedRetry: '重试',
    wsReconnecting: '正在重连……',
    wsDisconnected: '暂时连不上。网络回来后，新消息可能会慢一点才到。',
    // 设置页
    settingsTitle: '设置',
    settingsBackHome: '回首页',
    settingsLanguageTitle: '语言',
    settingsLanguageHint: '选你想在 app 里看到的语言。随时可以再改。',
    settingsPrivacyTitle: '隐私',
    settingsPostVisibilityLegend: '谁能看到你发的新帖子',
    settingsVisibilityCommunity: '只给社区看',
    settingsVisibilityCommunityHint: '只有同一个社区里的人能看到。',
    settingsVisibilityPublic: '公开',
    settingsVisibilityPublicHint: 'app 里所有人都能看到。',
    settingsVisibilityAnchor: '只给社区协调员看',
    settingsVisibilityAnchorHint: '只有你社区里的协调员能看到。',
    settingsLocationPrecisionLegend: '位置分享到多细',
    settingsPrecisionZip: '邮编',
    settingsPrecisionZipHint: '分享 5 位邮编，这样能找到你附近的资源。',
    settingsPrecisionNeighborhood: '只给街区名',
    settingsPrecisionNeighborhoodHint: '只分享街区名，不分享邮编。',
    settingsLowBandwidthLabel: '省流量模式',
    settingsLowBandwidthHint: '网速慢的时候开。图片和实时更新会少一些。',
    settingsSafetyTitle: '安全与信任',
    settingsSafetyCopy: '要是感觉哪里不对劲，先停一下，打开消息看看下一步怎么走更稳妥。',
    settingsOpenInbox: '打开消息',
    settingsHelpTitle: '帮助与反馈',
    settingsHelpReport: '反馈问题',
    settingsVersion: 'app 版本 {version}',
    // 账号
    settingsAccountTitle: '账号',
    settingsAccountLevel: '当前身份',
    settingsAccountLevelAnonymous: '只是看看',
    settingsAccountLevelVerified: '已验证的邻居',
    settingsAccountLevelAnchor: '社区协调员',
    settingsAccountLevelNone: '还没开始',
    settingsAccountUserId: '用户 ID：{userId}',
    deleteAccountSummary: '删除账号',
    deleteAccountBody: '我们会发一个验证码给你确认。确认后，你的帖子和消息会马上隐藏起来。30 天后才彻底删掉。这 30 天里你随时都能撤回。',
    deleteAccountReasonLabel: '告诉我们为什么（可以不填）',
    deleteAccountReasonHint: '填一下原因能帮我们做得更好，不影响删除。',
    deleteAccountReasonPlaceholder: '简单说一下原因，帮我们把 WeaveNYC 做得更好。',
    deleteAccountConfirmLabel: '我知道我的帖子和消息会被删掉。',
    // 删除原因
    deleteReasonNoLonger: '我不再需要 WeaveNYC',
    deleteReasonPrivacy: '我想要更多隐私',
    deleteReasonMoving: '我要搬走了',
    deleteReasonSafety: '我有安全上的担心',
    deleteReasonOther: '其他',
    // 删除流程
    deleteRequestButton: '开始删除',
    deleteRequestSending: '正在发送……',
    deleteOtpSent: '我们把 6 位验证码发到了你的手机或邮箱。10 分钟内填进来。',
    deleteOtpCodeLabel: '6 位验证码',
    deleteOtpVerifyButton: '确认删除',
    deleteOtpVerifying: '正在核对……',
    deleteOtpResend: '再发一次',
    deleteOtpInvalid: '验证码对不上。等一下新的 6 位码，或者点「再发一次」。',
    deleteScheduled: '你的账号已经隐藏起来了。30 天里还能撤回。',
    deleteScheduledPurge: '你的数据会在 {purgeDate} 彻底删除。',
    deleteUndeleteLink: '把账号找回来',
    deleteLastAnchorError: '这个社区里只剩你一个协调员了。先把身份交给别人，再删账号。',
    deleteAuthError: '再登录一次，来确认这一步。',
    deleteGenericError: '出了点问题。检查一下网络，过一会儿再试。',
    undeleteSuccess: '欢迎回来，账号又能用了。',
    undeleteCountdownLong: '还剩 {minutes} 分 {seconds} 秒可以找回',
    undeleteCountdownShort: '不到 1 分钟啦——现在就找回！',
    undeleteExpired: '已经过了撤回的时间',
    undeleteSuccessTitle: '账号已找回',
    undeleteSuccessBody: '账号回来了。为了安全，你的手机号和邮箱绑定都清掉了。再登录一次就能继续用 WeaveNYC。',
    undeleteReverifyCta: '重新验证',
    // 备用码
    recoveryCodeTitle: '备用码',
    recoveryCodeHelp: '手机或邮箱进不去？用协调员给你的备用码就能再登录。',
    recoveryCodeInputLabel: '备用码',
    recoveryCodeInputPlaceholder: '输入 12 位备用码',
    recoveryCodeSubmit: '使用',
    recoveryCodeInvalid: '这个备用码不能用，或者已经用过了。找协调员要一个新的。',
    recoveryCodeRateLimit: '试得次数太多。等几分钟再试。',
    recoveryCodeSuccess: '备用码通过，你重新验证了。',
    // 引导页：语言
    onboardingStepLanguage: '第 1 步（共 2 步）：语言',
    onboardingLanguageTitle: '选你的语言',
    onboardingLanguageHint: '选一个你读着最顺的语言。以后在设置里也能改。',
    // G2: labels stay in target language across all dictionaries
    onboardingLanguageContinueEn: 'Continue in English',
    onboardingLanguageContinueEs: 'Continuar en español',
    onboardingLanguageContinueZh: '继续使用中文',
    onboardingLanguageAlreadyDone: '语言已经选好了。',
    onboardingGoToSettings: '打开设置',
    // 引导页：位置
    onboardingStepLocation: '第 2 步（共 2 步）：你在哪儿',
    onboardingLocationTitle: '你在哪里找帮助？',
    onboardingLocationHint: '我们用邮编或街区，给你看附近的食物点和邻居。我们不会留你家的门牌号。',
    onboardingLocationZipLabel: '邮编',
    onboardingLocationZipPlaceholder: '11373',
    onboardingLocationZipInvalid: '填 5 位数的邮编。',
    onboardingLocationSubmit: '保存，继续',
    onboardingLocationUseDevice: '用我的位置',
    onboardingLocationDeviceBlocked: '浏览器把定位挡住了。你可以手动填邮编。',
    onboardingLocationDeviceDenied: '定位权限是关着的。手动填一下邮编。',
    onboardingLocationDevicePending: '正在问设备要位置……',
    onboardingLocationPrivacyNote: '你的位置只留在这部手机上。搜索的时候只会用到邮编。',
    onboardingLocationRecoverHint: '填邮编继续。',
    // 错误 / 空状态 / 横幅
    errorGeneric: '出了点问题。等一下，再试一次。',
    errorNetwork: '连不上。检查一下 Wi-Fi 或手机信号。',
    errorUnauthorized: '你被登出了。再登录一次就能继续。',
    errorRateLimit: '试得次数太多。等一分钟再试。',
    emptyNoResults: '没找到你在找的内容。',
    emptyNoPosts: '这里还没有帖子。过一会儿再来看看。',
    emptyNoConversations: '还没有聊天。以后聊天会出现在这里。',
    emptyNoReports: '现在没有要审核的。',
    bannerPilotMode: 'WeaveNYC 刚上线。我们会和你一起慢慢做得更好。',
    bannerStagingNotice: '这是测试版。这里的一切都只用来测试。',
    bannerOfflineHint: '连不上。有些页面会显示之前存下来的内容。',
    bannerSessionExpired: '你被登出了。再登录一次。',
    bannerAccountDeleted: '这个账号安排了删除。你可以在设置里撤回。',
    buttonRetry: '重试',
    buttonCancel: '取消',
    buttonContinue: '继续',
    buttonClose: '关闭',
    buttonLearnMore: '了解更多',
    // F10 可访问性
    skipToContent: '跳到主要内容',
    joinCameraLabel: '扫 QR 码用的相机画面',
    pageTitleHome: '找身边的帮助',
    pageTitleVerify: '验证',
    pageTitleCommunity: '社区',
    pageTitleCommunityJoin: '加入社区',
    pageTitleResources: '附近的帮助',
    pageTitleResourceDetail: '地点详情',
    pageTitlePostNew: '新帖子',
    pageTitlePostsMine: '我的帖子',
    pageTitlePostDetail: '帖子',
    pageTitleMatches: '能帮忙的办法',
    pageTitleInbox: '我的消息',
    pageTitleConversation: '聊天',
    pageTitleSettings: '设置',
    pageTitleOnboardingLanguage: '语言',
    pageTitleOnboardingLocation: '你在哪儿',
    // M8.5 redesign — app shell
    shellTabHome: '首页',
    shellTabCommunity: '社区',
    shellTabPost: '发帖',
    shellTabInbox: '消息',
    shellTabMe: '我',
    shellSkipLink: '跳到主要内容',
    shellBackButton: '返回',
    shellTabbarLabel: '主导航',
    // M8.5 redesign — home
    homeHeroEyebrow: '附近的帮助',
    homeHeroTitle: '身边就有帮助',
    homeHeroSubtitle: '吃的、看病、住的，走几步就到。',
    homeHeroSearchPlaceholder: '按邮编搜附近',
    homeZipStatus: '显示 {zip} 附近的结果',
    homeZipChange: '换',
    homeEmptyTitle: '附近暂时没有',
    homeEmptySubtitle: '换个邮编，或者扩大一下范围。',
    homeEmptyCta: '换邮编',
    // W3 review fix — distinct empty-state copy
    homeNoZipTitle: '填一下邮编',
    homeNoZipSubtitle: '我们会显示走几步就能到的帮助。',
    homeNoZipCta: '填邮编',
    homeNoResultsTitle: '附近没有',
    homeNoResultsSubtitle: '试试别的筛选或邮编。',
    homeNoResultsCta: '换邮编',
    homeLoadingLabel: '正在查找……',
    homeFilterAll: '全部',
    homeFilterFood: '食物',
    homeFilterMeal: '餐食',
    homeFilterFresh: '新鲜',
    homeFilterHealth: '健康',
    homeFilterHousing: '住房',
    homeResultsCount: '附近 {count} 个',
    // M8.5 redesign — Me hub
    meTitle: '我',
    meSignedInAs: '你是 {name}',
    meNotSignedIn: '只是看看',
    meSectionAccount: '账号',
    meSectionLanguage: '语言',
    meSectionPrivacy: '隐私',
    meSectionVerify: '身份验证',
    meSectionDanger: '危险区',
    meActionSignOut: '清除本机',
    meActionChangeLanguage: '换语言',
    meActionVerifyIdentity: '验证身份',
    meActionDeleteAccount: '删除账号',
    meVerifyStatusVerified: '已验证',
    meVerifyStatusUnverified: '未验证',
    meVerifyHelper: '验证后才能帮忙和发消息。',
    meDangerTitle: '危险区',
    meDangerSubtitle: '删除后，帖子和消息会在 30 天后彻底消失。',
    meDangerCta: '删除账号',
    meDeleteStep1Title: '删除账号吗？',
    meDeleteStep1Subtitle: '我们会发一个验证码确认。30 天内都能撤回。',
    meDeleteStep1Cta: '开始删除',
    meDeleteStep2Title: '确认删除',
    meDeleteStep2CodePrompt: '输入我们发的 6 位验证码。',
    meDeleteStep2Reason: '原因（可以不填）',
    meDeleteStep2Cta: '确认删除',
    meDeleteUndoBanner: '账号安排了删除。30 天内可以撤回。',
    meDeleteUndoCta: '撤回',
    // M8.5 redesign — ResourceCard atom
    resourceCardDistanceMeters: '{distance} 米',
    resourceCardDistanceMiles: '{distance} 英里',
    resourceCardActionCall: '打电话',
    resourceCardActionDirections: '导航',
    resourceCardActionBookmark: '收藏',
    resourceCardActionBookmarked: '已收藏',
    resourceCardOpenNow: '现在开着',
    resourceCardClosedNow: '已关门',
    resourceCardOpensLater: '今天晚点开',
    resourceCardHoursUnknown: '没写时间',
    // M8.5 redesign — EmptyState atom (shared)
    emptyStateInboxTitle: '还没有消息',
    emptyStateInboxSubtitle: '新请求和聊天都会出现在这里。',
    emptyStatePostsTitle: '这里还是空的',
    emptyStatePostsSubtitle: '发一条帖子，求助或搭把手。',
    emptyStatePostsCta: '发新帖',
    emptyStateMatchesTitle: '还没匹配到',
    emptyStateMatchesSubtitle: '我们会继续帮你找身边的办法。',
    emptyStateSearchTitle: '没结果',
    emptyStateSearchSubtitle: '换个词或者换个邮编试试。',
    emptyStateErrorTitle: '没能加载',
    emptyStateErrorSubtitle: '检查一下网络，再试一次。',
    emptyStateErrorCta: '重试',
    // M8.5 redesign — toast
    toastSaved: '已保存',
    toastSent: '已发送',
    toastCopied: '已复制',
    toastFailed: '没发出去',
    toastRetrying: '重试中……',
    // M8.5 redesign — onboarding takeover (new step copy)
    obLangTitle: '选你的语言',
    obLangSubtitle: '以后也能改。',
    obLangCta: '继续',
    obLocTitle: '你在哪儿？',
    obLocSubtitle: '我们只用邮编，从不看你家门牌号。',
    obLocUseLocation: '用我的位置',
    obLocZipLabel: '邮编',
    obLocSkip: '跳过，回头再填',
    obLocCta: '保存并查看附近',
    obDoneTitle: '都弄好啦',
    obDoneSubtitle: '先看看身边有什么。',
    obDoneCta: '看附近',
    // R4 additions
    toastBookmarkRemoved: '已取消收藏',
    pullToRefreshLabel: '下拉刷新',
    pullToRefreshRelease: '松开刷新',
    pullToRefreshLoading: '刷新中',
    fabPostLabel: '新帖子',
    // Category 4 — new loading label for compose publish
    composePublishing: '发帖中……',
    // Category 2 — clear-this-device hint
    meSignOutHint: '帖子和消息都留着，只是这台手机忘记你。',
    // Category 2b — "Clear all devices"
    meSignOutAllDevicesAction: '登出所有设备',
    meSignOutAllDevicesConfirm: '这会在你用过的每台手机和浏览器上都退出登录。要继续吗？',
    // Category 11 — delete rate-limit copy
    deleteRateLimitError: '最近一小时已经请求了 3 次删除。过一会儿再试，急事可以发邮件到 help@weavenyc.org。',
    // Category 13 — community join toast
    joinSuccessToast: '你加入了 {name}。下方就是通告和帖子。',
    // Category 14 — community hero greeting (de-dup)
    communityHeroGreeting: '你在 {name} 社区。',
    // Category 15 — QR camera branches
    cameraPermissionDenied: '相机被关了。去 设置 → Safari → 相机，选"允许"再回来扫一次。',
    cameraUnsupportedBrowser: '这个浏览器不能扫码。改上传 QR 图片，或者直接粘贴码。',
    // Category 16 — onboarding location back to language step
    obLocBack: '换语言',
    // Wave 4C — Resource Detail
    resourceDetailEyebrow: '地点详情',
    resourceDetailAddressTitle: '地址',
    resourceDetailPhoneTitle: '电话',
    resourceDetailWebsiteTitle: '网站',
    resourceDetailVisitWebsite: '去网站',
    resourceDetailTodayLabel: '今天',
    resourceDetailShareLabel: '分享这个地点',
    resourceDetailSaveAction: '收藏',
    resourceDetailRemoveAction: '取消收藏',
    resourceDetailShareCopied: '链接已复制',
    // M8.5 — offline write outbox
    outboxPendingHeading: '等待发布',
    outboxPendingHint: '网络恢复后会自动发布。',
    outboxFailedHint: '发布失败：{error}',
    outboxRetryAction: '立即重试',
    outboxDiscardAction: '放弃',
    outboxQueuedToast: '已保存\u2014\u2014联网后自动发布。',
    outboxDrainingToast: '正在发布\u2026\u2026',
    // F4-C — chat safety banners
    chatSafetyHateSpeech: '这条消息可能含有仇恨言论。',
    chatSafetyHarassment: '这条消息可能含有骚扰内容。',
    chatSafetyPhone: '这条消息里可能有电话号码。',
    chatSafetyAddress: '这条消息里可能有家庭住址。',
    chatSafetySsn: '这条消息里可能有社安号码。',
    chatSafetyBankAccount: '这条消息里可能有银行账号。',
    chatSafetyPassport: '这条消息提到护照信息。',
    chatSafetyBank: '这条消息提到银行信息。',
    chatSafetyWire: '这条消息提到电汇。',
    chatSafetyCrypto: '这条消息提到加密货币。',
    chatSafetyGiftCard: '这条消息提到礼品卡。',
    chatSafetyShowAnyway: '仍然显示',
    chatSafetyHidden: '为了你的安全，这条消息已隐藏。',
    // F4-C — error.message i18n
    errorRateLimited: '请求太多。请稍等一下再试。',
    errorAuth: '请重新登录以继续。',
    errorForbidden: '你没有权限这样做。',
    errorServer: '我们这边出了点问题。请稍后再试。',
    errorValidation: '请检查信息后再试。',
    errorConflict: '这件事已经做过了。请刷新后再试。',
    errorNotFound: '找不到这个内容。',
    // F4-C — shell-level loading fallback
    shellLoading: '加载中\u2026',
    // F4-C — Banner/Toast dismiss button label
    commonDismiss: '关闭',
  },
};

export function getChromeCopy(language: SupportedLanguage) {
  return messages[language];
}

export function getSessionLabel(language: SupportedLanguage, level: UserLevel) {
  const copy = getChromeCopy(language);

  if (level === 'verified') {
    return copy.sessionVerified;
  }

  if (level === 'anchor') {
    return copy.sessionAnchor;
  }

  return copy.sessionAnonymous;
}

export function getTypeLabel(language: SupportedLanguage, type: ResourceFilterType) {
  const copy = getChromeCopy(language);

  if (type === 'all') {
    return copy.filtersAll;
  }

  const labels: Record<Exclude<ResourceFilterType, 'all'>, Record<SupportedLanguage, string>> = {
    pantry: { en: 'Pantry', es: 'Despensa', zh: '食品领取点' },
    kitchen: { en: 'Kitchen', es: 'Comedor', zh: '社区厨房' },
    market: { en: 'Market', es: 'Mercado', zh: '流动市场' },
    benefits: { en: 'Benefits', es: 'Beneficios', zh: '福利支持' },
    other: { en: 'Other', es: 'Otro', zh: '其他' },
  };

  return labels[type][language];
}

export function getPostTypeLabel(language: SupportedLanguage, type: 'request' | 'offer') {
  const labels = {
    request: { en: 'Request', es: 'Pedido', zh: '求助' },
    offer: { en: 'Offer', es: 'Ofrecimiento', zh: '帮助' },
  };

  return labels[type][language];
}

export function getCategoryLabel(
  language: SupportedLanguage,
  category: 'food' | 'goods' | 'childcare' | 'companionship' | 'translation' | 'transportation' | 'other',
) {
  const labels = {
    food: { en: 'Food', es: 'Comida', zh: '食物' },
    goods: { en: 'Goods', es: 'Bienes', zh: '物资' },
    childcare: { en: 'Childcare', es: 'Cuidado infantil', zh: '儿童照看' },
    companionship: { en: 'Companionship', es: 'Compañía', zh: '陪伴' },
    translation: { en: 'Translation', es: 'Traducción', zh: '翻译' },
    transportation: { en: 'Transportation', es: 'Transporte', zh: '交通' },
    other: { en: 'Other', es: 'Otro', zh: '其他' },
  };

  return labels[category][language];
}

export function getPostPrivacyLabel(
  language: SupportedLanguage,
  privacy: 'community_only' | 'public' | 'anchor_mediated',
) {
  const labels = {
    community_only: { en: 'Community only', es: 'Solo comunidad', zh: '仅社区可见' },
    public: { en: 'Public', es: 'Público', zh: '公开' },
    anchor_mediated: { en: 'Coordinator helps', es: 'Coordinador ayuda', zh: '由协调员转接' },
  };

  return labels[privacy][language];
}

export function getPostStatusLabel(
  language: SupportedLanguage,
  status: 'draft' | 'pending_review' | 'active' | 'fulfilled' | 'closed' | 'removed',
) {
  const labels = {
    draft: { en: 'Draft', es: 'Borrador', zh: '草稿' },
    pending_review: { en: 'Pending review', es: 'Pendiente de revisión', zh: '待审核' },
    active: { en: 'Active', es: 'Activa', zh: '已发布' },
    fulfilled: { en: 'Fulfilled', es: 'Resuelta', zh: '已完成' },
    closed: { en: 'Closed', es: 'Cerrada', zh: '已关闭' },
    removed: { en: 'Removed', es: 'Eliminada', zh: '已删除' },
  };

  return labels[status][language];
}

export function getMatchReasonLabel(
  language: SupportedLanguage,
  reason:
    | 'same_category'
    | 'same_language'
    | 'within_1_mile'
    | 'within_3_miles'
    | 'within_5_miles'
    | 'verified_user'
    | 'anchor_reviewed'
    | 'expires_soon'
    | 'open_now'
    | 'open_today'
    | 'nearby_resource'
    | 'language_supported',
) {
  const labels = {
    same_category: { en: 'Same category', es: 'Misma categoría', zh: '同类需求' },
    same_language: { en: 'Language match', es: 'Idioma coincide', zh: '语言匹配' },
    within_1_mile: { en: 'Within 1 mile', es: 'A 1 milla', zh: '1 英里内' },
    within_3_miles: { en: 'Within 3 miles', es: 'A 3 millas', zh: '3 英里内' },
    within_5_miles: { en: 'Within 5 miles', es: 'A 5 millas', zh: '5 英里内' },
    verified_user: { en: 'Verified', es: 'Verificado', zh: '已验证' },
    anchor_reviewed: { en: 'Coordinator reviewed', es: 'Revisado por el coordinador', zh: '协调员已审核' },
    expires_soon: { en: 'Expires soon', es: 'Expira pronto', zh: '即将过期' },
    open_now: { en: 'Open now', es: 'Abierto ahora', zh: '当前开放' },
    open_today: { en: 'Open today', es: 'Abierto hoy', zh: '今天开放' },
    nearby_resource: { en: 'Nearby resource', es: 'Recurso cercano', zh: '附近资源' },
    language_supported: { en: 'Language supported', es: 'Idioma disponible', zh: '支持该语言' },
  };

  return labels[reason][language];
}

export function getContactRequestStatusLabel(
  language: SupportedLanguage,
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled',
) {
  const labels = {
    pending: { en: 'Pending', es: 'Pendiente', zh: '待处理' },
    accepted: { en: 'Accepted', es: 'Aceptada', zh: '已接受' },
    rejected: { en: 'Rejected', es: 'Rechazada', zh: '已拒绝' },
    expired: { en: 'Expired', es: 'Expirada', zh: '已过期' },
    cancelled: { en: 'Cancelled', es: 'Cancelada', zh: '已取消' },
  };

  return labels[status][language];
}

export const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'zh'];
export const resourceFilterTypes: ResourceFilterType[] = ['all', 'pantry', 'kitchen', 'market', 'benefits', 'other'];

export function formatZipLabel(preferences: PreferencesState) {
  return preferences.zipCode ? preferences.zipCode : 'ZIP not set';
}

export function coerceSupportedLanguage(value: string | null | undefined): SupportedLanguage {
  const locale = value?.toLowerCase() ?? '';

  if (locale.startsWith('es')) {
    return 'es';
  }

  if (locale.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}
