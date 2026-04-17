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
  communityTab: string;
  publicTab: string;
  currentCommunityLabel: string;
  joinTitle: string;
  joinCopy: string;
  joinNeedsSession: string;
  joinInviteMode: string;
  joinQrMode: string;
  inviteCodeLabel: string;
  qrTokenLabel: string;
  resolveCommunityAction: string;
  clearJoinPreview: string;
  confirmJoinAction: string;
  joinStepsAriaLabel: string;
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
  postDeleteAction: string;
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
  contactInboxEmpty: string;
  contactInboxRefresh: string;
  contactInboxCreated: string;
  contactInboxExpires: string;
  contactInboxAccept: string;
  contactInboxReject: string;
  contactInboxRelatedPost: string;
  chatInboxTitle: string;
  chatInboxCopy: string;
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
};

export const messages: Record<SupportedLanguage, ChromeMessages> = {
  en: {
    brand: 'WeaveNYC',
    devLink: 'M0 debug',
    heroEyebrow: 'Nearby resources',
    heroTitle: 'Find nearby food help with a quick, easy start.',
    heroCopy: 'Pick your language, save a ZIP, and see food pantries near you. No sign-up needed to look around. Sign in later only if you want to offer help or join a community.',
    sessionAnonymous: 'Looking around',
    sessionVerified: 'Signed-in neighbor',
    sessionAnchor: 'Community coordinator',
    createSession: 'Start looking around',
    creatingSession: 'Getting ready…',
    sessionReady: 'Ready to go',
    goVerify: 'Sign in to do more',
    onboardingTitle: 'Start with language and ZIP',
    onboardingCopy: 'Keep it simple: pick the language you read best, save your ZIP, and see nearby help. You can sign in or join a community later.',
    searchTitle: 'Nearby resources',
    zipLabel: 'ZIP code',
    zipPlaceholder: '11735',
    zipValidation: 'Enter a valid 5-digit ZIP code.',
    seeNearby: 'See nearby resources',
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
    sessionIdChip: 'user_id: {userId}',
    zipChip: 'ZIP: {zip}',
    distanceMiles: '{distance} mi',
    anonymousSessionError: 'Could not start. Please check your connection and try again.',
    verifyTitle: 'Sign in to prove who you are',
    verifyCopy: 'Sign in with a text message code or an email link. Signing in lets you offer help and send messages. If the code does not arrive, you can use the demo option below.',
    otpTab: '6-digit text code',
    magicLinkTab: 'Email link',
    phoneLabel: 'Phone number',
    emailLabel: 'Email address',
    codeLabel: '6-digit code',
    tokenLabel: 'Code from your email',
    verifyNeedsSession: 'Tap "Start looking around" on the home page first, then come back to sign in.',
    verifyError: 'Something did not work. Check your number or email and try again.',
    sendCode: 'Send my code',
    verifyCode: 'Check my code',
    sendLink: 'Send me a link',
    useDemoLink: 'Use demo link',
    demoCodeLabel: 'Demo code',
    demoTokenLabel: 'Demo code',
    verificationDone: 'You are already signed in.',
    backHome: 'Back to resources',
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
    joinCommunityCta: 'Join a community',
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
    communityTab: 'Community',
    publicTab: 'Public',
    currentCommunityLabel: 'Current community',
    joinTitle: 'Join a community',
    joinCopy: 'First, type an invite code or scan a QR code. Then check the community and join.',
    joinNeedsSession: 'Tap "Start looking around" first, then come back to join.',
    joinInviteMode: 'Invite code',
    joinQrMode: 'QR code',
    inviteCodeLabel: 'Invite code',
    qrTokenLabel: 'QR code or scanned text',
    resolveCommunityAction: 'Check this code',
    clearJoinPreview: 'Clear',
    confirmJoinAction: 'Join this community',
    joinStepsAriaLabel: 'Steps to join a community',
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
    composeTitle: 'Create a post',
    composeCopy: 'Choose "ask" or "offer", write your post, and check it before you share. Anyone looking around can ask for help. To offer help, you need to sign in.',
    composeNeedsCommunity: 'Join a community first, before you post inside a community.',
    composeNeedsVerified: 'Please sign in first. You must sign in to offer help or share a sensitive post (for example, one that asks to meet in person).',
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
    composePublishAction: 'Share my post',
    speechBrowserAction: 'Use my voice (browser)',
    speechFallbackAction: 'Upload a voice recording',
    speechBrowserError: 'Your browser could not listen. Please type instead or upload a voice recording.',
    postsLoading: 'Loading posts…',
    postsEmpty: 'No posts matched this tab yet.',
    postDetailTitle: 'Post detail',
    postEditAction: 'Edit post',
    postCloseAction: 'Close post',
    postDeleteAction: 'Delete post',
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
    matchContinueIntent: 'Send my message',
    matchClearIntent: 'Clear',
    matchContactPending: 'Your message was sent. The other person will see it in their messages.',
    matchGoInbox: 'Open my messages',
    inboxTitle: 'My messages',
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
    inboxReject: 'Decline',
    inboxRelatedPost: 'Open the post',
    inboxOpenThread: 'Open chat',
    inboxPendingPreview: 'New request about {title}',
    inboxUnreadBadge: '{count} new',
    inboxExpiresAt: 'Expires {value}',
    inboxFromPost: 'From post: {title}',
    inboxNeedsSession: 'Tap "Start looking around" first, then come back to see your messages.',
    inboxNeedsVerified: 'Please sign in to see and answer your messages.',
    inboxVerifyAction: 'Sign in to open my messages',
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
    chatThreadLoading: 'Loading chat...',
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
    chatThreadComposerPlaceholder: 'Type a short, clear message...',
    chatThreadComposerHint: 'Keep it short. Do not share private info until you both agree on a safe next step.',
    chatThreadSendAction: 'Send',
    chatThreadFallbackAlias: 'The other person',
    chatQuickPhraseHello: 'Hi, I can chat here now.',
    chatQuickPhraseTiming: 'I need about 15 minutes before I can reply.',
    chatQuickPhrasePublicMeet: 'Can we meet in a public place to be safe?',
    chatQuickPhraseThanks: 'Thank you. I am setting up the next step now.',
    // F5: Conversation logic fixes
    conversationAccessDeniedTitle: 'You cannot open this chat',
    conversationAccessDeniedBody: 'Only the two people in this chat can open it. If you think this is a mistake, go back to your messages and open it from there.',
    sendFailedTitle: 'Your message did not go through',
    sendFailedRetry: 'Try again',
    wsReconnecting: 'Reconnecting...',
    wsDisconnected: 'You are offline. New messages may take a moment to arrive once you are back online.',
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
    settingsOpenInbox: 'Open my messages',
    settingsHelpTitle: 'Help and feedback',
    settingsHelpReport: 'Report a problem',
    settingsVersion: 'App version {version}',
    // Account section
    settingsAccountTitle: 'Account',
    settingsAccountLevel: 'Current level',
    settingsAccountLevelAnonymous: 'Looking around',
    settingsAccountLevelVerified: 'Signed-in neighbor',
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
    deleteRequestSending: 'Sending code...',
    deleteOtpSent: 'We sent a 6-digit code to your phone or email. Please type it below within 10 minutes.',
    deleteOtpCodeLabel: '6-digit code',
    deleteOtpVerifyButton: 'Confirm delete',
    deleteOtpVerifying: 'Checking code...',
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
    undeleteReverifyCta: 'Sign in now',
    // Recovery code flow
    recoveryCodeTitle: 'Backup code',
    recoveryCodeHelp: 'Lost your phone or email? Type a backup code from your community coordinator to sign in again.',
    recoveryCodeInputLabel: 'Backup code',
    recoveryCodeInputPlaceholder: 'Type your 12-letter code',
    recoveryCodeSubmit: 'Use backup code',
    recoveryCodeInvalid: 'This code is not good, or it was already used. Please ask your community coordinator for a new one.',
    recoveryCodeRateLimit: 'Too many tries. Please wait a few minutes and try again.',
    recoveryCodeSuccess: 'Code worked. You are signed in.',
    // Onboarding language screen
    onboardingStepLanguage: 'Step 1 of 2: Language',
    onboardingLanguageTitle: 'Pick your language',
    onboardingLanguageHint: 'Choose the language you want to see in the app. You can change it later in Settings.',
    onboardingLanguageContinueEn: 'Continue in English',
    onboardingLanguageContinueEs: 'Continuar en español',
    onboardingLanguageContinueZh: '用中文继续',
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
    onboardingLocationDevicePending: 'Asking your device for location...',
    onboardingLocationPrivacyNote: 'Your location stays on this device. Only your ZIP is shared when you search.',
    // Errors / empty states / banners
    errorGeneric: 'Something did not work. Please wait a moment and try again.',
    errorNetwork: 'Cannot reach the internet. Check your Wi-Fi or phone signal, then tap "Try again".',
    errorUnauthorized: 'You have been signed out. Please sign in again to keep going.',
    errorRateLimit: 'Too many tries. Please wait a minute and try again.',
    emptyNoResults: 'No results for what you are looking for.',
    emptyNoPosts: 'No posts here yet. Please come back later.',
    emptyNoConversations: 'No chats yet. Your chats will show up here.',
    emptyNoReports: 'Nothing to review right now.',
    bannerPilotMode: 'WeaveNYC is brand new. We will keep improving it with you.',
    bannerStagingNotice: 'You are using the test app. Everything here is for testing only.',
    bannerOfflineHint: 'You are offline. Some pages will show saved copies.',
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
    pageTitleVerify: 'Sign in',
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
  },
  es: {
    brand: 'WeaveNYC',
    devLink: 'Depuración M0',
    heroEyebrow: 'Recursos cercanos',
    heroTitle: 'Encuentra ayuda con comida cerca de ti, de forma sencilla.',
    heroCopy: 'Elige tu idioma, guarda un ZIP y mira las despensas cercanas. No necesitas crear cuenta para buscar. Entra con tu cuenta después si quieres ofrecer ayuda o unirte a una comunidad.',
    sessionAnonymous: 'Mirando',
    sessionVerified: 'Vecino con cuenta',
    sessionAnchor: 'Coordinador comunitario',
    createSession: 'Empezar a mirar',
    creatingSession: 'Preparando…',
    sessionReady: 'Listo',
    goVerify: 'Entrar para hacer más',
    onboardingTitle: 'Empieza con idioma y ZIP',
    onboardingCopy: 'Sencillo: elige el idioma que mejor leas, guarda tu ZIP y mira la ayuda cercana. Puedes entrar con tu cuenta o unirte a una comunidad más tarde.',
    searchTitle: 'Recursos cercanos',
    zipLabel: 'Código ZIP',
    zipPlaceholder: '11735',
    zipValidation: 'Ingresa un código ZIP válido de 5 dígitos.',
    seeNearby: 'Ver recursos cercanos',
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
    sessionIdChip: 'user_id: {userId}',
    zipChip: 'ZIP: {zip}',
    distanceMiles: '{distance} mi',
    anonymousSessionError: 'No se pudo empezar. Revisa tu conexión y vuelve a probar.',
    verifyTitle: 'Entra para probar quién eres',
    verifyCopy: 'Entra con un código por mensaje de texto o un enlace por correo. Entrar te deja ofrecer ayuda y enviar mensajes. Si el código no llega, usa el modo demo abajo.',
    otpTab: 'Código de 6 dígitos',
    magicLinkTab: 'Enlace por correo',
    phoneLabel: 'Número de teléfono',
    emailLabel: 'Correo electrónico',
    codeLabel: 'Código de 6 dígitos',
    tokenLabel: 'Código del enlace',
    verifyNeedsSession: 'Primero toca "Empezar a mirar" en la pantalla principal, luego regresa para entrar.',
    verifyError: 'Algo no funcionó. Revisa tu número o correo e intenta otra vez.',
    sendCode: 'Enviar mi código',
    verifyCode: 'Revisar mi código',
    sendLink: 'Enviar el enlace',
    useDemoLink: 'Usar enlace demo',
    demoCodeLabel: 'Código demo',
    demoTokenLabel: 'Código demo',
    verificationDone: 'Ya entraste con tu cuenta.',
    backHome: 'Volver a recursos',
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
    joinCommunityCta: 'Unirse a una comunidad',
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
    communityTab: 'Comunidad',
    publicTab: 'Público',
    currentCommunityLabel: 'Comunidad actual',
    joinTitle: 'Unirse a una comunidad',
    joinCopy: 'Primero escribe el código o escanea el QR. Después revisa la comunidad y únete.',
    joinNeedsSession: 'Primero toca "Empezar a mirar", luego regresa para unirte.',
    joinInviteMode: 'Código de invitación',
    joinQrMode: 'Código QR',
    inviteCodeLabel: 'Código de invitación',
    qrTokenLabel: 'QR o texto escaneado',
    resolveCommunityAction: 'Revisar este código',
    clearJoinPreview: 'Limpiar',
    confirmJoinAction: 'Unirme a esta comunidad',
    joinStepsAriaLabel: 'Pasos para unirte a una comunidad',
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
    composeTitle: 'Crear publicación',
    composeCopy: 'Elige "pedir" u "ofrecer", escribe tu mensaje y revísalo antes de compartir. Cualquier persona puede pedir ayuda. Para ofrecer ayuda tienes que entrar con tu cuenta.',
    composeNeedsCommunity: 'Primero únete a una comunidad para publicar dentro de ella.',
    composeNeedsVerified: 'Primero entra con tu cuenta. Tienes que entrar para ofrecer ayuda o compartir una publicación sensible (por ejemplo, una que pida verse en persona).',
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
    composePublishAction: 'Compartir mi publicación',
    speechBrowserAction: 'Usar mi voz (navegador)',
    speechFallbackAction: 'Subir una grabación de voz',
    speechBrowserError: 'Tu navegador no pudo escucharte. Escribe a mano o sube una grabación de voz.',
    postsLoading: 'Cargando publicaciones…',
    postsEmpty: 'Todavía no hay publicaciones en esta pestaña.',
    postDetailTitle: 'Detalles de la publicación',
    postEditAction: 'Editar',
    postCloseAction: 'Cerrar',
    postDeleteAction: 'Eliminar',
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
    matchContinueIntent: 'Enviar mi mensaje',
    matchClearIntent: 'Limpiar',
    matchContactPending: 'Tu mensaje fue enviado. La otra persona lo verá en sus mensajes.',
    matchGoInbox: 'Abrir mis mensajes',
    inboxTitle: 'Mis mensajes',
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
    inboxNeedsSession: 'Primero toca "Empezar a mirar" y luego regresa para ver tus mensajes.',
    inboxNeedsVerified: 'Entra con tu cuenta para ver y responder tus mensajes.',
    inboxVerifyAction: 'Entrar para abrir mis mensajes',
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
    chatThreadLoading: 'Cargando chat...',
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
    chatThreadComposerPlaceholder: 'Escribe un mensaje corto y claro...',
    chatThreadComposerHint: 'Sé breve. No compartas datos privados hasta que los dos acuerden un próximo paso seguro.',
    chatThreadSendAction: 'Enviar',
    chatThreadFallbackAlias: 'La otra persona',
    chatQuickPhraseHello: 'Hola, ya puedo chatear por aquí.',
    chatQuickPhraseTiming: 'Necesito unos 15 minutos antes de responder.',
    chatQuickPhrasePublicMeet: '¿Podemos vernos en un lugar público para estar seguros?',
    chatQuickPhraseThanks: 'Gracias. Estoy arreglando el próximo paso ahora.',
    // F5: Conversation logic fixes
    conversationAccessDeniedTitle: 'No puedes abrir este chat',
    conversationAccessDeniedBody: 'Solo las dos personas de este chat pueden abrirlo. Si crees que es un error, vuelve a tus mensajes y ábrelo desde allí.',
    sendFailedTitle: 'Tu mensaje no se pudo enviar',
    sendFailedRetry: 'Intentar de nuevo',
    wsReconnecting: 'Reconectando...',
    wsDisconnected: 'Estás sin conexión. Los mensajes nuevos pueden tardar un momento en llegar cuando vuelvas.',
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
    settingsOpenInbox: 'Abrir mis mensajes',
    settingsHelpTitle: 'Ayuda y comentarios',
    settingsHelpReport: 'Reportar un problema',
    settingsVersion: 'Versión de la app {version}',
    // Account section
    settingsAccountTitle: 'Cuenta',
    settingsAccountLevel: 'Nivel actual',
    settingsAccountLevelAnonymous: 'Mirando',
    settingsAccountLevelVerified: 'Vecino con cuenta',
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
    deleteRequestButton: 'Empezar a eliminar',
    deleteRequestSending: 'Enviando código...',
    deleteOtpSent: 'Te mandamos un código de 6 dígitos a tu teléfono o correo. Escríbelo aquí en los próximos 10 minutos.',
    deleteOtpCodeLabel: 'Código de 6 dígitos',
    deleteOtpVerifyButton: 'Confirmar eliminación',
    deleteOtpVerifying: 'Revisando el código...',
    deleteOtpResend: 'Enviar otro código',
    deleteOtpInvalid: 'Ese código no coincide. Espera un código nuevo o toca "Enviar otro código".',
    deleteScheduled: 'Tu cuenta ya está oculta. Todavía puedes deshacer esto por 30 días.',
    deleteScheduledPurge: 'Tus datos se borrarán por completo el {purgeDate}.',
    deleteUndeleteLink: 'Recuperar mi cuenta',
    deleteLastAnchorError: 'Eres el único coordinador comunitario aquí. Pasa el rol a otra persona antes de eliminar.',
    deleteAuthError: 'Por favor entra con tu cuenta otra vez para confirmar.',
    deleteGenericError: 'Algo no funcionó. Revisa tu conexión y prueba de nuevo en un momento.',
    undeleteSuccess: 'Qué bueno verte de vuelta. Tu cuenta está activa otra vez.',
    undeleteCountdownLong: 'Te quedan {minutes} min {seconds} seg para recuperarla',
    undeleteCountdownShort: '¡Queda menos de 1 min — recupérala ahora!',
    undeleteExpired: 'Ya pasó el tiempo para deshacer',
    undeleteSuccessTitle: 'Cuenta recuperada',
    undeleteSuccessBody: 'Tu cuenta ya está activa. Por seguridad, tu teléfono y correo se borraron. Por favor entra otra vez con tu cuenta para seguir usando WeaveNYC.',
    undeleteReverifyCta: 'Entrar ahora',
    // Recovery code flow
    recoveryCodeTitle: 'Código de respaldo',
    recoveryCodeHelp: '¿Perdiste tu teléfono o correo? Escribe un código de respaldo que te dio tu coordinador comunitario para volver a entrar.',
    recoveryCodeInputLabel: 'Código de respaldo',
    recoveryCodeInputPlaceholder: 'Escribe tu código de 12 letras',
    recoveryCodeSubmit: 'Usar código de respaldo',
    recoveryCodeInvalid: 'Ese código no sirve o ya se usó. Pide uno nuevo.',
    recoveryCodeRateLimit: 'Muchos intentos. Espera unos minutos y prueba de nuevo.',
    recoveryCodeSuccess: 'Código aceptado. Ya entraste.',
    // Onboarding language screen
    onboardingStepLanguage: 'Paso 1 de 2: Idioma',
    onboardingLanguageTitle: 'Elige tu idioma',
    onboardingLanguageHint: 'Escoge el idioma que quieres ver en la app. Lo puedes cambiar luego en Ajustes.',
    onboardingLanguageContinueEn: 'Continuar en inglés',
    onboardingLanguageContinueEs: 'Continuar en español',
    onboardingLanguageContinueZh: 'Continuar en chino',
    onboardingLanguageAlreadyDone: 'Ya elegiste el idioma.',
    onboardingGoToSettings: 'Abrir Ajustes',
    // Onboarding location screen
    onboardingStepLocation: 'Paso 2 de 2: Ubicación',
    onboardingLocationTitle: 'Dónde estás buscando ayuda?',
    onboardingLocationHint: 'Usamos tu ZIP o vecindario para mostrarte despensas y vecinos cercanos. No guardamos tu dirección exacta.',
    onboardingLocationZipLabel: 'Código ZIP',
    onboardingLocationZipPlaceholder: '11373',
    onboardingLocationZipInvalid: 'Ingresa un ZIP válido de 5 dígitos.',
    onboardingLocationSubmit: 'Guardar y seguir',
    onboardingLocationUseDevice: 'Usar la ubicación de mi dispositivo',
    onboardingLocationDeviceBlocked: 'El navegador bloqueó la ubicación. Puedes escribir un ZIP a mano.',
    onboardingLocationDeviceDenied: 'No se dio permiso de ubicación. Escribe un ZIP.',
    onboardingLocationDevicePending: 'Pidiendo ubicación al dispositivo...',
    onboardingLocationPrivacyNote: 'Tu ubicación se queda en este dispositivo. Solo se comparte el ZIP cuando buscas.',
    // Errors / empty states / banners
    errorGeneric: 'Algo no funcionó. Espera un momento y prueba de nuevo.',
    errorNetwork: 'No hay internet. Revisa tu Wi-Fi o señal del teléfono y toca "Intentar de nuevo".',
    errorUnauthorized: 'Te sacamos de tu cuenta. Entra de nuevo para seguir.',
    errorRateLimit: 'Muchos intentos. Espera un minuto y prueba de nuevo.',
    emptyNoResults: 'No encontramos nada con lo que buscas.',
    emptyNoPosts: 'Todavía no hay publicaciones. Vuelve más tarde.',
    emptyNoConversations: 'Todavía no tienes chats. Tus chats aparecerán aquí.',
    emptyNoReports: 'Nada que revisar ahora.',
    bannerPilotMode: 'WeaveNYC es nuevo. Vamos a mejorarlo contigo poco a poco.',
    bannerStagingNotice: 'Estás usando la app de prueba. Los datos aquí son solo para probar.',
    bannerOfflineHint: 'Estás sin conexión. Algunas páginas mostrarán copias guardadas.',
    bannerSessionExpired: 'Te sacamos de tu cuenta. Entra de nuevo.',
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
    pageTitleVerify: 'Entrar',
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
  },
  zh: {
    brand: 'WeaveNYC',
    devLink: 'M0 调试页',
    heroEyebrow: '附近资源',
    heroTitle: '一步步帮你找到附近的食物援助。',
    heroCopy: '先选你看得懂的语言，保存你的邮编，就能看到附近的食物发放点。只是看一看的话不用登录。之后想帮邻居的忙，或者加入社区，再登录就好。',
    sessionAnonymous: '只是在看看',
    sessionVerified: '已登录的邻居',
    sessionAnchor: '社区协调员',
    createSession: '开始看看',
    creatingSession: '正在准备……',
    sessionReady: '准备好了',
    goVerify: '登录后能做更多',
    onboardingTitle: '先选语言，再填邮编',
    onboardingCopy: '很简单：选一个你看得懂的语言，留下你的邮编，就能看到附近的帮助。想登录或者加入社区，都可以以后再做。',
    searchTitle: '附近资源',
    zipLabel: '邮编',
    zipPlaceholder: '11735',
    zipValidation: '请填写 5 位数的邮编。',
    seeNearby: '看附近有什么',
    filtersOpenNow: '现在开门',
    filtersToday: '今天开门',
    filtersType: '类别',
    filtersAll: '全部',
    lowBandwidth: '省流量模式',
    resultTitle: '你附近的官方资源',
    resultCount: '附近 {count} 个资源',
    sampleMode: '真实数据还没准备好，先看一下样例数据。',
    noResults: '这个邮编和条件下没有找到资源。',
    resourceEmptyTitle: '邮编 {zip} 没有找到',
    resourceEmptyBody: '换一个附近的邮编，或者去掉位置看全部。',
    resourceEmptyTryAgain: '换个邮编',
    resourceLoadingList: '正在找附近的资源……',
    resourceLoadError: '没找到资源。请检查网络后重试。',
    detailCta: '看详情',
    call: '拨打电话',
    directions: '导航过去',
    bookmarked: '已收藏',
    save: '收藏',
    sessionIdChip: 'user_id: {userId}',
    zipChip: '邮编：{zip}',
    distanceMiles: '{distance} 英里',
    anonymousSessionError: '没能开始。请检查你的网络，再试一次。',
    verifyTitle: '登录来证明你是你',
    verifyCopy: '可以用手机短信里的 6 位数字验证码登录，也可以用发到你邮箱里的链接登录。登录后才能帮忙、才能给人发消息。如果收不到验证码，下面有演示模式可以用。',
    otpTab: '6 位数字验证码',
    magicLinkTab: '邮件链接',
    phoneLabel: '手机号',
    emailLabel: '邮箱',
    codeLabel: '6 位数字验证码',
    tokenLabel: '邮件里的验证码',
    verifyNeedsSession: '请先在首页点「开始看看」，再回来登录。',
    verifyError: '登录没成功。请检查一下手机号或邮箱，再试一次。',
    sendCode: '发我验证码',
    verifyCode: '验证一下',
    sendLink: '把链接发给我',
    useDemoLink: '使用演示链接',
    demoCodeLabel: '演示验证码',
    demoTokenLabel: '演示验证码',
    verificationDone: '你已经登录好了。',
    backHome: '返回资源页',
    hoursTitle: '每周开放时间',
    sourceTitle: '数据来源',
    notesTitle: '备注',
    languagesTitle: '服务语言',
    debugTitle: 'M0 调试控制台',
    resourceLoading: '正在加载资源详情…',
    resourceNotFound: '未找到该资源。',
    closedLabel: '关闭',
    notListed: '未提供',
    noAdditionalNotes: '暂无更多备注。',
    homeCommunityCopy: '你还可以加入一个社区：找邻居帮忙、帮邻居一把，自己的帖子也都能在同一个地方看到。',
    homeCommunityReady: '社区已就绪',
    joinCommunityCta: '加入一个社区',
    requestHelpCta: '请人帮忙',
    offerHelpCta: '帮别人忙',
    communityTitle: '社区',
    communityCopy: '用邀请码或二维码加入社区。可以在社区帖和公开帖之间切换，自己发的求助和帮助也都在一个地方。',
    communityAnnouncementsHeading: '社区公告',
    communityAnnouncementsCopy: '{communityName} 的最新通知会优先显示在这里。',
    communityAnnouncementsBannerLabel: '最新通知',
    communityAnnouncementsListHeading: '更早的通知',
    communityAnnouncementsEmpty: '这个社区还没有公告。',
    communityAnnouncementsMoreEmpty: '暂无更早的公告。',
    communityAnnouncementsNoCommunity: '加入或切换到一个社区后即可查看公告。',
    communityAnnouncementsPinnedLabel: '置顶',
    communityFeedHeading: '社区帖子流',
    communityNoMembership: '先加入一个社区，才能看到和发布社区内的帖子。',
    p2pSyncTitle: '把社区帖子存在这台设备',
    p2pSyncCopy: '把 {communityName} 的帖子和公告存在这台手机里。就算断网了也还能看。',
    p2pEnableAction: '在这台设备里保存',
    p2pDisableAction: '不再保存',
    p2pSyncNowAction: '立刻更新',
    p2pTransportLabel: '怎么连',
    p2pTransportBootstrap: '主网络',
    p2pTransportMdnsDemo: '附近设备（测试）',
    p2pPeerCountLabel: '其他在线的人',
    p2pPeerCountValue: '{count} 个在线',
    p2pLastSyncLabel: '上一次更新',
    p2pNoSyncYet: '还没保存过',
    p2pPeerIdLabel: '这台设备',
    p2pPeerIdPending: '正在取设备名称……',
    p2pOfflineMode: '你的手机现在没有网。我们会先给你看之前保存下来的社区帖子和公告，等网络回来再更新。',
    p2pMdnsToggle: '试用附近设备发现（只在测试里）',
    p2pMdnsToggleCopy: '只在测试版本里看到。平时还是走主网络。',
    p2pCacheBadge: '离线保存',
    p2pLiveRefreshDelayed: '现在实时更新有点慢，先给你看之前保存下来的社区内容。',
    postsOfflineFallback: '正在显示 {updatedAt} 保存的社区帖子。',
    announcementsOfflineFallback: '正在显示 {updatedAt} 保存的社区公告。',
    p2pPhase_disabled: '已关闭',
    p2pPhase_connecting: '连接中',
    p2pPhase_ready: '已就绪',
    p2pPhase_degraded: '信号不好',
    p2pPhase_offline: '离线',
    communityTab: '社区',
    publicTab: '公开',
    currentCommunityLabel: '当前社区',
    joinTitle: '加入一个社区',
    joinCopy: '先输入邀请码，或者扫一下二维码。看一看是哪个社区，再确认加入。',
    joinNeedsSession: '请先点「开始看看」，再回来加入社区。',
    joinInviteMode: '邀请码',
    joinQrMode: '二维码',
    inviteCodeLabel: '邀请码',
    qrTokenLabel: '二维码里的内容',
    resolveCommunityAction: '看看这个码',
    clearJoinPreview: '清除',
    confirmJoinAction: '加入这个社区',
    joinStepsAriaLabel: '加入社区的步骤',
    joinStep1Label: '第 1/3 步：输入邀请码',
    joinStep2Label: '第 2/3 步：看看社区',
    joinStep3Label: '第 3/3 步：加入',
    joinInvalidCodeTitle: '这个邀请码我们不认识',
    joinInvalidCodeBody: '请让你的社区协调员给你一个新的邀请码或二维码。',
    joinStartOver: '重新开始',
    joinCodeExpiredTitle: '邀请码过期了',
    joinCodeExpiredBody: '这个邀请码已经不能用了。请找社区协调员要一个新的，再试一次。',
    qrScanCamera: '用相机扫',
    qrScanUpload: '上传二维码图片',
    qrCapture: '识别二维码',
    qrUnsupported: '这个浏览器扫不了二维码。请把邀请码手动输进来。',
    composeTitle: '发一条帖子',
    composeCopy: '先选「求助」还是「帮忙」，再写好内容，预览一下就能发。只是看看的人也可以发求助帖；想帮别人忙的话，需要先登录。',
    composeNeedsCommunity: '想在社区里发帖，先加入社区。',
    composeNeedsVerified: '请先登录。要帮别人忙，或者发涉及敏感类内容（比如想约见面）的帖子，都需要先登录。',
    composeStepType: '选类型',
    composeStepCompose: '写内容',
    composeStepPreview: '预览',
    composerStep1Label: '1. 类型',
    composerStep2Label: '2. 写内容',
    composerStep3Label: '3. 预览',
    composerValidationTitle: '发布前请先修好这些地方',
    composerValidationEmptyTitle: '标题不能空着。',
    composerValidationLongTitle: '标题不能超过 140 个字。',
    composerValidationEmptyBody: '详细内容不能空着。',
    composerValidationLongBody: '详细内容不能超过 1000 个字。',
    composerValidationNoCategory: '请选一个类别。',
    composerValidationNoZip: '请填写 5 位数的邮编。',
    composerValidationExpired: '过期时间要填一个未来的日期。',
    composerBackToEdit: '回去修改',
    composeCurrentCommunity: '社区',
    composeTitleLabel: '标题',
    composeBodyLabel: '详细内容',
    composeExpiresLabel: '过期时间',
    composePrivacyLabel: '谁可以看',
    composeContactChat: '在应用里聊',
    composeContactText: '可以发短信联系',
    composePublishAction: '发布帖子',
    speechBrowserAction: '用声音输入（浏览器）',
    speechFallbackAction: '上传一段语音',
    speechBrowserError: '浏览器没能听清。你可以手动打字，也可以上传一段语音。',
    postsLoading: '正在加载帖子……',
    postsEmpty: '这里还没有帖子。',
    postDetailTitle: '帖子详情',
    postEditAction: '修改帖子',
    postCloseAction: '关闭帖子',
    postDeleteAction: '删除帖子',
    myPostsTitle: '我的帖子',
    myPostsCopy: '你在这台设备上发过的所有帖子，都可以按「进行中、待审核、已关闭、已删除」来看。',
    postsGroup_active: '进行中',
    postsGroup_pending_review: '待审核',
    postsGroup_closed: '已关闭',
    postsGroup_removed: '已删除',
    postsEmptyGroup: '这个状态下还没有帖子。',
    seeActionPlans: '看看有哪些办法',
    matchTitle: '现在能做的 3 件事',
    matchCopy: '这里把附近邻居能帮的、官方的地方，放在一起。这样每条还没解决的求助都有一个下一步。',
    matchLoading: '正在找能帮忙的办法……',
    matchUnavailable: '现在没有可以显示的办法。',
    matchOwnerOnly: '只有发这条求助的人才能看这些办法。',
    matchNeedsActiveRequest: '只有还在进行中的求助才会显示这些办法。',
    matchRefreshAction: '换一批',
    matchRefreshStatus: '已经换了 {used}/{max} 批',
    matchFreshResults: '这是最新的结果',
    matchStaleResults: '点「换一批」看看新的选项',
    matchNoMoreRefreshes: '这条求助已经换过所有选项了。',
    matchNoResults: '暂时没有可以显示的办法。',
    matchContactAction: '给对方发消息',
    matchOpenPost: '打开帖子',
    matchOfficialFallback: '官方地点',
    matchContactReady: '可以把消息发给 {title}。',
    matchContinueIntent: '发消息给他',
    matchClearIntent: '取消',
    matchContactPending: '消息已经发出去了，对方会在自己的消息里看到。',
    matchGoInbox: '打开我的消息',
    inboxTitle: '我的消息',
    inboxCopy: '邻居的新请求和你的聊天都在这里。先回新请求，再继续聊。',
    inboxBackHome: '返回社区',
    inboxAllTab: '全部',
    inboxRequestsTab: '新请求',
    inboxChatsTab: '聊天',
    inboxViewLabel: '当前显示：{view}',
    inboxViewHeading: '要看什么',
    inboxViewCopy: '可以只看新请求，只看聊天，或者两样一起看。',
    inboxRequestsTitle: '新请求',
    inboxRequestsCopy: '邻居发来的新请求会先出现在这里。',
    inboxRequestsEmpty: '现在没有新请求。',
    inboxChatsTitle: '聊天',
    inboxChatsCopy: '已经接受的请求和正在进行的聊天都在这里。',
    inboxChatsEmpty: '还没有聊天，也没有新请求。',
    inboxRefresh: '看看有没有新消息',
    inboxPendingCount: '{count} 个在等你',
    inboxUnreadCount: '{count} 条未读',
    inboxCreated: '发来时间',
    inboxExpires: '过期时间',
    inboxAccept: '接受',
    inboxReject: '拒绝',
    inboxRelatedPost: '打开对应的帖子',
    inboxOpenThread: '打开聊天',
    inboxPendingPreview: '{title} 的待处理请求',
    inboxUnreadBadge: '{count} 条新消息',
    inboxExpiresAt: '{value} 过期',
    inboxFromPost: '来自帖子：{title}',
    inboxNeedsSession: '请先点「开始看看」，再回来看你的消息。',
    inboxNeedsVerified: '请先登录，才能看到和回复你的消息。',
    inboxVerifyAction: '登录后打开我的消息',
    contactInboxTitle: '我的消息',
    contactInboxCopy: '新请求和聊天都在这里。',
    contactInboxEmpty: '还没有请求，也没有聊天。',
    contactInboxRefresh: '看看有没有新消息',
    contactInboxCreated: '发来时间',
    contactInboxExpires: '过期时间',
    contactInboxAccept: '接受',
    contactInboxReject: '拒绝',
    contactInboxRelatedPost: '打开对应的帖子',
    chatInboxTitle: '我的消息',
    chatInboxCopy: '新请求和聊天都在这里。',
    chatInboxEmpty: '还没有请求，也没有聊天。',
    chatInboxRefresh: '看看有没有新消息',
    chatInboxUnreadCount: '{count} 条未读',
    chatInboxPendingCount: '{count} 个请求在等你',
    chatInboxConversationsTitle: '聊天',
    chatInboxConversationsCopy: '已经接受的请求和正在进行的聊天都在这里。',
    chatInboxPendingPreview: '{title} 的待处理请求',
    chatInboxUnreadBadge: '{count} 条新消息',
    chatInboxExpiresAt: '{value} 过期',
    chatInboxFromPost: '来自帖子：{title}',
    chatInboxOpenThread: '打开聊天',
    chatThreadTitle: '聊天',
    chatThreadCopy: '这里把联系、常用短句、还有安全相关的按钮，都放在一个地方。',
    chatThreadLoading: '正在加载聊天……',
    chatThreadStatusLive: '实时聊天',
    chatThreadDetailsTitle: '聊天信息',
    chatThreadDetailsCopy: '你可以看到谁在这里、用常用短句，还可以不用离开聊天就举报问题。',
    chatThreadSafetyTitle: '安全小提示',
    chatThreadSafetyCopy: '不要在聊天里发你的详细家庭住址、银行信息，或者身份证件号。只发一些你愿意留在聊天里的内容就好。',
    chatThreadQuickPhrasesTitle: '常用短句',
    chatThreadActionsTitle: '安全',
    chatThreadReportAction: '举报这段聊天',
    chatThreadBlockAction: '屏蔽这个人',
    chatThreadReportedNotice: '举报已经发出去了，社区协调员会看一下。',
    chatThreadBlockedNotice: '这段聊天已经屏蔽了。你没办法在这里再发新消息。',
    chatThreadRelatedTitle: '关于这个聊天',
    chatThreadRelatedPostLabel: '相关帖子',
    chatThreadRelatedPostMissing: '这个聊天没有对应的帖子。',
    chatThreadMessagesTitle: '消息',
    chatThreadMessagesCopy: '新消息会出现在这里，旁边一直能看到相关的帖子和安全提示。',
    chatThreadLastSeen: '最近更新于 {value}',
    chatThreadEmpty: '还没有消息。可以先点下面一句常用短句打个招呼。',
    chatThreadYou: '你',
    chatThreadSystem: '系统',
    chatThreadComposerLabel: '消息内容',
    chatThreadComposerPlaceholder: '写一条简短清楚的消息……',
    chatThreadComposerHint: '先写短一点。没商量好安全的下一步之前，不要发太多私人信息。',
    chatThreadSendAction: '发送',
    chatThreadFallbackAlias: '对方',
    chatQuickPhraseHello: '你好，现在可以在这里聊。',
    chatQuickPhraseTiming: '我大概 15 分钟后再回你。',
    chatQuickPhrasePublicMeet: '我们约个人多的地方见面好吗？',
    chatQuickPhraseThanks: '谢谢，我现在就去安排下一步。',
    // F5: 会话逻辑修复
    conversationAccessDeniedTitle: '你没办法打开这段聊天',
    conversationAccessDeniedBody: '只有这段聊天里的两个人才能打开。如果你觉得是弄错了，回到我的消息，从那里打开聊天。',
    sendFailedTitle: '消息没能发出去',
    sendFailedRetry: '再试一次',
    wsReconnecting: '正在重新连接……',
    wsDisconnected: '你现在没有网络。等网络回来，新消息可能会慢一会儿才到。',
    // 设置页
    settingsTitle: '设置',
    settingsBackHome: '回到主页',
    settingsLanguageTitle: '语言',
    settingsLanguageHint: '选你想在这个应用里看到的语言。你随时可以再改。',
    settingsPrivacyTitle: '隐私',
    settingsPostVisibilityLegend: '谁可以看到你发的新帖子',
    settingsVisibilityCommunity: '只给社区看',
    settingsVisibilityCommunityHint: '只有同一个社区里的人可以看到这条帖子。',
    settingsVisibilityPublic: '公开',
    settingsVisibilityPublicHint: '这个应用里所有人都能看到这条帖子。',
    settingsVisibilityAnchor: '只给社区协调员看',
    settingsVisibilityAnchorHint: '只有你社区里的协调员可以看到。',
    settingsLocationPrecisionLegend: '你想分享多清楚的位置',
    settingsPrecisionZip: '邮编',
    settingsPrecisionZipHint: '分享 5 位邮编，这样我们好帮你找附近的资源。',
    settingsPrecisionNeighborhood: '只分享街区名字',
    settingsPrecisionNeighborhoodHint: '只分享街区的名字，不分享邮编。',
    settingsLowBandwidthLabel: '省流量模式',
    settingsLowBandwidthHint: '网速慢的时候打开。图片和实时更新会少一点。',
    settingsSafetyTitle: '安全与信任',
    settingsSafetyCopy: '要是觉得哪里不对劲，先停一下，打开我的消息看一看下一步怎么做更安全。',
    settingsOpenInbox: '打开我的消息',
    settingsHelpTitle: '帮助与反馈',
    settingsHelpReport: '反馈问题',
    settingsVersion: '应用版本 {version}',
    // 账号信息
    settingsAccountTitle: '账号',
    settingsAccountLevel: '当前身份',
    settingsAccountLevelAnonymous: '只是在看看',
    settingsAccountLevelVerified: '已登录的邻居',
    settingsAccountLevelAnchor: '社区协调员',
    settingsAccountLevelNone: '还没开始',
    settingsAccountUserId: '用户 ID：{userId}',
    deleteAccountSummary: '注销账号',
    deleteAccountBody: '我们会给你发一个验证码来确认。确认之后，你的帖子和消息会马上藏起来。过了 30 天才彻底删掉。这 30 天里你随时可以撤销。',
    deleteAccountReasonLabel: '告诉我们为什么（可以不填）',
    deleteAccountReasonHint: '填原因可以帮我们做得更好，不影响注销。',
    deleteAccountReasonPlaceholder: '简单说一下原因，能帮我们做得更好。',
    deleteAccountConfirmLabel: '我知道我的帖子和消息会被删掉。',
    // 注销原因
    deleteReasonNoLonger: '我不再需要 WeaveNYC',
    deleteReasonPrivacy: '我想要更多隐私',
    deleteReasonMoving: '我要搬走了',
    deleteReasonSafety: '我有安全上的顾虑',
    deleteReasonOther: '其他原因',
    // 注销流程状态
    deleteRequestButton: '开始注销',
    deleteRequestSending: '正在发送验证码……',
    deleteOtpSent: '我们把 6 位数字验证码发到了你的手机或邮箱。请在 10 分钟内填进来。',
    deleteOtpCodeLabel: '6 位数字验证码',
    deleteOtpVerifyButton: '确认注销',
    deleteOtpVerifying: '正在核对验证码……',
    deleteOtpResend: '再发一次验证码',
    deleteOtpInvalid: '这个验证码不对。请等新的 6 位数字验证码，或者点「再发一次」。',
    deleteScheduled: '你的账号已经藏起来了。30 天里你还可以撤销。',
    deleteScheduledPurge: '你的数据会在 {purgeDate} 彻底删除。',
    deleteUndeleteLink: '把账号找回来',
    deleteLastAnchorError: '你是这个社区里最后一位社区协调员。请先把协调员的身份交给别人，再注销。',
    deleteAuthError: '请重新登录，再确认这个操作。',
    deleteGenericError: '出了点问题。请检查一下网络，等一会儿再试。',
    undeleteSuccess: '欢迎回来，你的账号又好了。',
    undeleteCountdownLong: '还有 {minutes} 分 {seconds} 秒可以找回',
    undeleteCountdownShort: '不到 1 分钟了 — 现在找回！',
    undeleteExpired: '已经过了撤销的时间',
    undeleteSuccessTitle: '账号找回来了',
    undeleteSuccessBody: '账号好了。为了安全，你的手机号和邮箱都清掉了。请再登录一次，就能继续用 WeaveNYC。',
    undeleteReverifyCta: '马上登录',
    // 恢复码
    recoveryCodeTitle: '备用码',
    recoveryCodeHelp: '手机或邮箱进不去了？用社区协调员给你的备用码就能再登录进来。',
    recoveryCodeInputLabel: '备用码',
    recoveryCodeInputPlaceholder: '请输入 12 位备用码',
    recoveryCodeSubmit: '使用备用码',
    recoveryCodeInvalid: '这个备用码不能用，或者已经用过了。请找社区协调员要一个新的。',
    recoveryCodeRateLimit: '试得太多次了，请过几分钟再试。',
    recoveryCodeSuccess: '备用码通过，你已经登录了。',
    // 引导页：语言
    onboardingStepLanguage: '第 1 步（共 2 步）：语言',
    onboardingLanguageTitle: '选你看得懂的语言',
    onboardingLanguageHint: '选一个你看得懂的语言，之后在设置里也可以再改。',
    onboardingLanguageContinueEn: '用英文继续',
    onboardingLanguageContinueEs: '用西班牙语继续',
    onboardingLanguageContinueZh: '用中文继续',
    onboardingLanguageAlreadyDone: '语言已经选好了。',
    onboardingGoToSettings: '打开设置',
    // 引导页：位置
    onboardingStepLocation: '第 2 步（共 2 步）：你在哪儿',
    onboardingLocationTitle: '你在哪里找帮助？',
    onboardingLocationHint: '我们用你的邮编或街区来显示附近的食物点和邻居。我们不会记下你家的门牌号。',
    onboardingLocationZipLabel: '邮编',
    onboardingLocationZipPlaceholder: '11373',
    onboardingLocationZipInvalid: '请填写 5 位数的邮编。',
    onboardingLocationSubmit: '保存，继续',
    onboardingLocationUseDevice: '用这台设备上的位置',
    onboardingLocationDeviceBlocked: '浏览器把定位挡住了。你可以手动输入邮编。',
    onboardingLocationDeviceDenied: '没有开启定位权限。请手动输入邮编。',
    onboardingLocationDevicePending: '正在问设备要位置……',
    onboardingLocationPrivacyNote: '你的位置只留在这台设备上。只有在搜索的时候才会用到邮编。',
    // 错误 / 空状态 / 横幅
    errorGeneric: '出了点问题。请等一下，再试一次。',
    errorNetwork: '连不上网络。请检查一下你的 Wi-Fi 或手机信号，再点「再试一次」。',
    errorUnauthorized: '你被退出登录了。请再登录一次，继续用。',
    errorRateLimit: '试得太多次了，请等一分钟再试。',
    emptyNoResults: '没找到你要找的内容。',
    emptyNoPosts: '这里还没有帖子。过一会儿再看看。',
    emptyNoConversations: '还没有聊天。你的聊天会出现在这里。',
    emptyNoReports: '现在没有需要审核的。',
    bannerPilotMode: 'WeaveNYC 刚开始，我们会和你一起慢慢做得更好。',
    bannerStagingNotice: '这是测试版本。这里的一切只用来测试。',
    bannerOfflineHint: '你现在没有网络。有些页面会显示之前保存下来的内容。',
    bannerSessionExpired: '你被退出登录了。请再登录一次。',
    bannerAccountDeleted: '这个账号已经安排注销。你可以在设置里撤销。',
    buttonRetry: '再试一次',
    buttonCancel: '取消',
    buttonContinue: '继续',
    buttonClose: '关闭',
    buttonLearnMore: '了解更多',
    // F10 可访问性
    skipToContent: '跳到主要内容',
    joinCameraLabel: '用来扫二维码的相机画面',
    pageTitleHome: '找附近的帮助',
    pageTitleVerify: '登录',
    pageTitleCommunity: '社区',
    pageTitleCommunityJoin: '加入一个社区',
    pageTitleResources: '附近能帮你的地方',
    pageTitleResourceDetail: '地点详情',
    pageTitlePostNew: '发新帖',
    pageTitlePostsMine: '我的帖子',
    pageTitlePostDetail: '帖子',
    pageTitleMatches: '能帮忙的办法',
    pageTitleInbox: '我的消息',
    pageTitleConversation: '聊天',
    pageTitleSettings: '设置',
    pageTitleOnboardingLanguage: '语言',
    pageTitleOnboardingLocation: '你在哪儿',
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
