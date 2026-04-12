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
  communityFeedHeading: string;
  communityNoMembership: string;
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
};

export const messages: Record<SupportedLanguage, ChromeMessages> = {
  en: {
    brand: 'WeaveNYC',
    devLink: 'M0 debug',
    heroEyebrow: 'Nearby resources',
    heroTitle: 'Find nearby food support with a lighter first-run flow.',
    heroCopy: 'Choose your language, save a ZIP, and browse official resources without leaving the PWA. Verification is available when you want to upgrade from anonymous to verified.',
    sessionAnonymous: 'Anonymous session',
    sessionVerified: 'Verified session',
    sessionAnchor: 'Anchor session',
    createSession: 'Create anonymous session',
    creatingSession: 'Creating session…',
    sessionReady: 'Session ready',
    goVerify: 'Upgrade to verified',
    onboardingTitle: 'Start with language and ZIP',
    onboardingCopy: 'Start light: choose your preferred UI language, save a ZIP, and browse nearby resources before deciding whether to join a community or verify.',
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
    sampleMode: 'Showing sample fallback data because the M1 resource API is not available yet.',
    noResults: 'No resources matched the current ZIP and filters.',
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
    anonymousSessionError: 'Unable to create session.',
    verifyTitle: 'Verify your session',
    verifyCopy: 'Upgrade from anonymous to verified using OTP or a magic-link fallback. The forms are wired to the live M1 auth routes and stay usable with local demo fallbacks.',
    otpTab: 'SMS code',
    magicLinkTab: 'Magic link',
    phoneLabel: 'Phone number',
    emailLabel: 'Email address',
    codeLabel: 'Verification code',
    tokenLabel: 'Magic-link token',
    verifyNeedsSession: 'Create an anonymous session on the home page before using verified upgrade flows.',
    verifyError: 'Verification request failed.',
    sendCode: 'Send code',
    verifyCode: 'Verify code',
    sendLink: 'Send link',
    useDemoLink: 'Use demo link',
    demoCodeLabel: 'Demo code',
    demoTokenLabel: 'Demo token',
    verificationDone: 'This session is already verified.',
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
    homeCommunityCopy: 'M2 adds a community lane on top of the resource finder: join a neighborhood, request help, offer help, and keep your posts nearby.',
    homeCommunityReady: 'Community ready',
    joinCommunityCta: 'Join community',
    requestHelpCta: 'Request help',
    offerHelpCta: 'Offer help',
    communityTitle: 'Community lane',
    communityCopy: 'Join with an invite code or QR, switch between community and public posts, and keep your own requests and offers in one place.',
    communityFeedHeading: 'Community feed',
    communityNoMembership: 'Join a community first to unlock community-only requests and offers.',
    communityTab: 'Community',
    publicTab: 'Public',
    currentCommunityLabel: 'Current community',
    joinTitle: 'Join a community',
    joinCopy: 'Resolve an invite code or QR token first, then confirm the membership on this device.',
    joinNeedsSession: 'Create an anonymous session before joining a community.',
    joinInviteMode: 'Invite code',
    joinQrMode: 'QR token',
    inviteCodeLabel: 'Invite code',
    qrTokenLabel: 'QR token or scanned payload',
    resolveCommunityAction: 'Resolve community',
    clearJoinPreview: 'Clear',
    confirmJoinAction: 'Confirm join',
    qrScanCamera: 'Use camera scan',
    qrScanUpload: 'Upload QR image',
    qrCapture: 'Capture QR',
    qrUnsupported: 'QR detection is not available in this browser. Paste the token instead.',
    composeTitle: 'Create a post',
    composeCopy: 'Choose request or offer, draft the post, and preview it before publish. Requests stay open to anonymous members; offers require a verified session.',
    composeNeedsCommunity: 'Join a community before you publish community posts.',
    composeNeedsVerified: 'Verify this session before you publish an offer or a high-risk post.',
    composeStepType: 'Choose type',
    composeStepCompose: 'Compose',
    composeStepPreview: 'Preview',
    composeCurrentCommunity: 'Community',
    composeTitleLabel: 'Title',
    composeBodyLabel: 'Details',
    composeExpiresLabel: 'Expires at',
    composePrivacyLabel: 'Visibility',
    composeContactChat: 'In-app chat later',
    composeContactText: 'Text message okay',
    composePublishAction: 'Publish post',
    speechBrowserAction: 'Use browser speech',
    speechFallbackAction: 'Upload audio fallback',
    speechBrowserError: 'Browser speech recognition was not available.',
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
    matchTitle: '3 ways to act now',
    matchCopy: 'This page combines nearby neighbor offers with official resources, so every active request gets a concrete next step.',
    matchLoading: 'Loading action plans…',
    matchUnavailable: 'Action plans are not available yet.',
    matchOwnerOnly: 'Action plans are only available to the owner of an active request.',
    matchNeedsActiveRequest: 'Only active request posts can open action plans.',
    matchRefreshAction: 'Swap one option',
    matchRefreshStatus: '{used}/{max} refreshes used',
    matchNoResults: 'No action plans are available yet.',
    matchContactAction: 'Contact',
    matchOpenPost: 'Open post',
    matchOfficialFallback: 'Official fallback',
    matchContactReady: 'Ready to continue your contact request to {title}.',
    matchContinueIntent: 'Continue contact request',
    matchClearIntent: 'Clear handoff',
    matchContactPending: 'Contact request sent. The other person will see it in their inbox.',
    matchGoInbox: 'Open inbox',
    inboxTitle: 'Inbox',
    inboxCopy: 'Requests and conversations live together here. Use requests for handoffs and chats for live threads.',
    inboxBackHome: 'Back to community',
    inboxAllTab: 'All',
    inboxRequestsTab: 'Requests',
    inboxChatsTab: 'Chats',
    inboxViewLabel: 'Viewing {view}',
    inboxViewHeading: 'Inbox views',
    inboxViewCopy: 'Switch between requests and chats, or keep both visible.',
    inboxRequestsTitle: 'Requests',
    inboxRequestsCopy: 'Pending contact handoffs appear here first.',
    inboxRequestsEmpty: 'No pending requests right now.',
    inboxChatsTitle: 'Chats',
    inboxChatsCopy: 'Accepted requests and live threads stay here together.',
    inboxChatsEmpty: 'No chats or pending requests yet.',
    inboxRefresh: 'Refresh inbox',
    inboxPendingCount: '{count} pending',
    inboxUnreadCount: '{count} unread',
    inboxCreated: 'Created',
    inboxExpires: 'Expires',
    inboxAccept: 'Accept',
    inboxReject: 'Reject',
    inboxRelatedPost: 'Open related post',
    inboxOpenThread: 'Open thread',
    inboxPendingPreview: 'Pending handoff about {title}',
    inboxUnreadBadge: '{count} new',
    inboxExpiresAt: 'Expires {value}',
    inboxFromPost: 'From post: {title}',
    inboxNeedsSession: 'Create an anonymous session before opening the inbox.',
    inboxNeedsVerified: 'Verify this session to handle inbox requests and chats.',
    inboxVerifyAction: 'Verify to open inbox',
    contactInboxTitle: 'Inbox',
    contactInboxCopy: 'Requests and conversations live together here.',
    contactInboxEmpty: 'No requests or conversations yet.',
    contactInboxRefresh: 'Refresh inbox',
    contactInboxCreated: 'Created',
    contactInboxExpires: 'Expires',
    contactInboxAccept: 'Accept',
    contactInboxReject: 'Reject',
    contactInboxRelatedPost: 'Open related post',
    chatInboxTitle: 'Inbox',
    chatInboxCopy: 'Requests and conversations live together here.',
    chatInboxEmpty: 'No requests or conversations yet.',
    chatInboxRefresh: 'Refresh inbox',
    chatInboxUnreadCount: '{count} unread',
    chatInboxPendingCount: '{count} pending requests',
    chatInboxConversationsTitle: 'Chats',
    chatInboxConversationsCopy: 'Accepted requests and live threads stay here together.',
    chatInboxPendingPreview: 'Pending handoff about {title}',
    chatInboxUnreadBadge: '{count} new',
    chatInboxExpiresAt: 'Expires {value}',
    chatInboxFromPost: 'From post: {title}',
    chatInboxOpenThread: 'Open thread',
    chatThreadTitle: 'Conversation',
    chatThreadCopy: 'This thread keeps the contact handoff, quick phrases, and trust & safety actions in one place.',
    chatThreadLoading: 'Loading conversation...',
    chatThreadStatusLive: 'Live thread shell',
    chatThreadDetailsTitle: 'Conversation details',
    chatThreadDetailsCopy: 'Participants, quick phrases, and moderation actions stay available without leaving the thread.',
    chatThreadSafetyTitle: 'Safety reminder',
    chatThreadSafetyCopy: 'Avoid sharing full address, bank information, ID numbers, or any private detail you would not want stored in chat history.',
    chatThreadQuickPhrasesTitle: 'Quick phrases',
    chatThreadActionsTitle: 'Trust and safety',
    chatThreadReportAction: 'Report conversation',
    chatThreadBlockAction: 'Block user',
    chatThreadReportedNotice: 'Report submitted. An anchor can review it from the moderation queue.',
    chatThreadBlockedNotice: 'This conversation is blocked. You cannot send new messages in this thread.',
    chatThreadRelatedTitle: 'Related context',
    chatThreadRelatedPostLabel: 'Related post',
    chatThreadRelatedPostMissing: 'This conversation does not have a related post preview.',
    chatThreadMessagesTitle: 'Messages',
    chatThreadMessagesCopy: 'Messages land here in real time, while the related post and safety context stay visible beside the thread.',
    chatThreadLastSeen: 'Updated {value}',
    chatThreadEmpty: 'No messages yet. Use a quick phrase to start.',
    chatThreadYou: 'You',
    chatThreadSystem: 'System',
    chatThreadComposerLabel: 'Message',
    chatThreadComposerPlaceholder: 'Write a short, practical message...',
    chatThreadComposerHint: 'Keep messages brief and do not share sensitive details until you both agree on a safe next step.',
    chatThreadSendAction: 'Send message',
    chatThreadFallbackAlias: 'Conversation partner',
    chatQuickPhraseHello: 'Hi, I can talk here now.',
    chatQuickPhraseTiming: 'I need about 15 minutes before I can respond.',
    chatQuickPhrasePublicMeet: 'Can we keep this to a public pickup or meeting spot?',
    chatQuickPhraseThanks: 'Thank you. I am confirming the next step now.',
  },
  es: {
    brand: 'WeaveNYC',
    devLink: 'Depuración M0',
    heroEyebrow: 'Recursos cercanos',
    heroTitle: 'Encuentra apoyo alimentario cercano con un inicio más ligero.',
    heroCopy: 'Elige idioma, guarda un ZIP y revisa recursos oficiales sin salir de la PWA. La verificación sigue disponible cuando quieras subir de anónimo a verificado.',
    sessionAnonymous: 'Sesión anónima',
    sessionVerified: 'Sesión verificada',
    sessionAnchor: 'Sesión anchor',
    createSession: 'Crear sesión anónima',
    creatingSession: 'Creando sesión…',
    sessionReady: 'Sesión lista',
    goVerify: 'Subir a verificado',
    onboardingTitle: 'Empieza con idioma y ZIP',
    onboardingCopy: 'M1 mantiene el primer recorrido liviano: elige idioma, guarda un ZIP y consulta recursos cercanos antes de decidir si quieres verificarte.',
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
    sampleMode: 'Mostrando datos de ejemplo porque la API M1 de recursos todavía no está disponible.',
    noResults: 'No hay recursos para el ZIP y filtros actuales.',
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
    anonymousSessionError: 'No se pudo crear la sesión.',
    verifyTitle: 'Verifica tu sesión',
    verifyCopy: 'Sube de anónimo a verificado con OTP o con fallback de magic link. Los formularios ya están conectados a las rutas activas de autenticación y siguen funcionando con modo demo.',
    otpTab: 'Código SMS',
    magicLinkTab: 'Magic link',
    phoneLabel: 'Número de teléfono',
    emailLabel: 'Correo electrónico',
    codeLabel: 'Código de verificación',
    tokenLabel: 'Token del magic link',
    verifyNeedsSession: 'Crea una sesión anónima en la pantalla principal antes de usar el flujo de verificación.',
    verifyError: 'La verificación falló.',
    sendCode: 'Enviar código',
    verifyCode: 'Verificar código',
    sendLink: 'Enviar enlace',
    useDemoLink: 'Usar enlace demo',
    demoCodeLabel: 'Código demo',
    demoTokenLabel: 'Token demo',
    verificationDone: 'Esta sesión ya está verificada.',
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
    homeCommunityCopy: 'M2 agrega la vía comunitaria encima del buscador: únete a tu comunidad, pide ayuda, ofrece ayuda y guarda tus publicaciones en un solo lugar.',
    homeCommunityReady: 'Comunidad lista',
    joinCommunityCta: 'Unirse a la comunidad',
    requestHelpCta: 'Pedir ayuda',
    offerHelpCta: 'Ofrecer ayuda',
    communityTitle: 'Canal comunitario',
    communityCopy: 'Únete con un código o QR, cambia entre publicaciones comunitarias y públicas, y sigue tus propios pedidos y ofertas.',
    communityFeedHeading: 'Feed comunitario',
    communityNoMembership: 'Primero únete a una comunidad para ver y publicar posts comunitarios.',
    communityTab: 'Comunidad',
    publicTab: 'Público',
    currentCommunityLabel: 'Comunidad actual',
    joinTitle: 'Unirse a una comunidad',
    joinCopy: 'Primero resuelve el código o QR y luego confirma la membresía en este dispositivo.',
    joinNeedsSession: 'Crea una sesión anónima antes de unirte a una comunidad.',
    joinInviteMode: 'Código',
    joinQrMode: 'QR',
    inviteCodeLabel: 'Código de invitación',
    qrTokenLabel: 'Token QR o contenido escaneado',
    resolveCommunityAction: 'Resolver comunidad',
    clearJoinPreview: 'Limpiar',
    confirmJoinAction: 'Confirmar ingreso',
    qrScanCamera: 'Usar cámara',
    qrScanUpload: 'Subir imagen QR',
    qrCapture: 'Capturar QR',
    qrUnsupported: 'Este navegador no puede detectar QR. Pega el token manualmente.',
    composeTitle: 'Crear publicación',
    composeCopy: 'Elige request u offer, redacta la publicación y revísala antes de publicarla. Las requests permiten sesión anónima; las offers requieren verificación.',
    composeNeedsCommunity: 'Únete a una comunidad antes de publicar posts comunitarios.',
    composeNeedsVerified: 'Verifica la sesión antes de publicar una offer o un post de alto riesgo.',
    composeStepType: 'Tipo',
    composeStepCompose: 'Redactar',
    composeStepPreview: 'Vista previa',
    composeCurrentCommunity: 'Comunidad',
    composeTitleLabel: 'Título',
    composeBodyLabel: 'Detalles',
    composeExpiresLabel: 'Expira en',
    composePrivacyLabel: 'Visibilidad',
    composeContactChat: 'Chat interno después',
    composeContactText: 'Se permiten mensajes de texto',
    composePublishAction: 'Publicar',
    speechBrowserAction: 'Usar voz del navegador',
    speechFallbackAction: 'Subir audio fallback',
    speechBrowserError: 'La voz del navegador no estuvo disponible.',
    postsLoading: 'Cargando publicaciones…',
    postsEmpty: 'Todavía no hay publicaciones en esta pestaña.',
    postDetailTitle: 'Detalle del post',
    postEditAction: 'Editar',
    postCloseAction: 'Cerrar',
    postDeleteAction: 'Eliminar',
    myPostsTitle: 'Mis publicaciones',
    myPostsCopy: 'Sigue todas las publicaciones activas, pendientes, cerradas y eliminadas creadas desde este dispositivo.',
    postsGroup_active: 'Activas',
    postsGroup_pending_review: 'Pendientes',
    postsGroup_closed: 'Cerradas',
    postsGroup_removed: 'Eliminadas',
    postsEmptyGroup: 'No hay publicaciones en este estado.',
    seeActionPlans: 'Ver planes de acción',
    matchTitle: '3 maneras de actuar ahora',
    matchCopy: 'Esta página combina ofertas vecinales cercanas con recursos oficiales para que cada request activa tenga un siguiente paso concreto.',
    matchLoading: 'Cargando planes de acción…',
    matchUnavailable: 'Los planes de acción todavía no están disponibles.',
    matchOwnerOnly: 'Los planes de acción solo están disponibles para la persona dueña de una request activa.',
    matchNeedsActiveRequest: 'Solo las requests activas pueden abrir planes de acción.',
    matchRefreshAction: 'Cambiar una opción',
    matchRefreshStatus: '{used}/{max} recambios usados',
    matchNoResults: 'Todavía no hay planes de acción disponibles.',
    matchContactAction: 'Contactar',
    matchOpenPost: 'Abrir publicación',
    matchOfficialFallback: 'Recurso oficial',
    matchContactReady: 'Listo para continuar tu solicitud de contacto con {title}.',
    matchContinueIntent: 'Continuar solicitud de contacto',
    matchClearIntent: 'Limpiar regreso',
    matchContactPending: 'Solicitud de contacto enviada. La otra persona la verá en su inbox.',
    matchGoInbox: 'Abrir inbox',
    inboxTitle: 'Inbox',
    inboxCopy: 'Las solicitudes y las conversaciones viven aquí juntas. Usa las solicitudes para los handoffs y los chats para los hilos activos.',
    inboxBackHome: 'Volver a la comunidad',
    inboxAllTab: 'Todo',
    inboxRequestsTab: 'Solicitudes',
    inboxChatsTab: 'Chats',
    inboxViewLabel: 'Viendo {view}',
    inboxViewHeading: 'Vistas del inbox',
    inboxViewCopy: 'Cambia entre solicitudes y chats, o deja ambos visibles.',
    inboxRequestsTitle: 'Solicitudes',
    inboxRequestsCopy: 'Los handoffs pendientes aparecen aquí primero.',
    inboxRequestsEmpty: 'No hay solicitudes pendientes ahora mismo.',
    inboxChatsTitle: 'Chats',
    inboxChatsCopy: 'Las solicitudes aceptadas y los hilos activos se quedan aquí juntos.',
    inboxChatsEmpty: 'Todavía no hay chats ni solicitudes pendientes.',
    inboxRefresh: 'Actualizar inbox',
    inboxPendingCount: '{count} pendientes',
    inboxUnreadCount: '{count} sin leer',
    inboxCreated: 'Creada',
    inboxExpires: 'Expira',
    inboxAccept: 'Aceptar',
    inboxReject: 'Rechazar',
    inboxRelatedPost: 'Abrir publicación relacionada',
    inboxOpenThread: 'Abrir hilo',
    inboxPendingPreview: 'Handoff pendiente sobre {title}',
    inboxUnreadBadge: '{count} nuevas',
    inboxExpiresAt: 'Expira {value}',
    inboxFromPost: 'Desde la publicación: {title}',
    inboxNeedsSession: 'Crea una sesión anónima antes de abrir el inbox.',
    inboxNeedsVerified: 'Verifica esta sesión para manejar solicitudes y chats del inbox.',
    inboxVerifyAction: 'Verificar para abrir el inbox',
    contactInboxTitle: 'Inbox',
    contactInboxCopy: 'Las solicitudes y las conversaciones viven aquí juntas.',
    contactInboxEmpty: 'Todavía no hay solicitudes ni conversaciones.',
    contactInboxRefresh: 'Actualizar inbox',
    contactInboxCreated: 'Creada',
    contactInboxExpires: 'Expira',
    contactInboxAccept: 'Aceptar',
    contactInboxReject: 'Rechazar',
    contactInboxRelatedPost: 'Abrir publicación relacionada',
    chatInboxTitle: 'Inbox',
    chatInboxCopy: 'Las solicitudes y las conversaciones viven aquí juntas.',
    chatInboxEmpty: 'Todavía no hay solicitudes ni conversaciones.',
    chatInboxRefresh: 'Actualizar inbox',
    chatInboxUnreadCount: '{count} sin leer',
    chatInboxPendingCount: '{count} solicitudes pendientes',
    chatInboxConversationsTitle: 'Chats',
    chatInboxConversationsCopy: 'Las solicitudes aceptadas y los hilos activos se quedan aquí juntos.',
    chatInboxPendingPreview: 'Handoff pendiente sobre {title}',
    chatInboxUnreadBadge: '{count} nuevas',
    chatInboxExpiresAt: 'Expira {value}',
    chatInboxFromPost: 'Desde la publicación: {title}',
    chatInboxOpenThread: 'Abrir hilo',
    chatThreadTitle: 'Conversación',
    chatThreadCopy: 'Este hilo reúne el handoff de contacto, frases rápidas y acciones mínimas de trust & safety.',
    chatThreadLoading: 'Cargando conversación...',
    chatThreadStatusLive: 'Shell de hilo en vivo',
    chatThreadDetailsTitle: 'Detalles de la conversación',
    chatThreadDetailsCopy: 'Participantes, frases rápidas y acciones de moderación siguen disponibles dentro del hilo.',
    chatThreadSafetyTitle: 'Recordatorio de seguridad',
    chatThreadSafetyCopy: 'Evita compartir dirección completa, información bancaria, números de identificación o cualquier dato privado que no quieras dejar en el historial.',
    chatThreadQuickPhrasesTitle: 'Frases rápidas',
    chatThreadActionsTitle: 'Trust y safety',
    chatThreadReportAction: 'Reportar conversación',
    chatThreadBlockAction: 'Bloquear usuario',
    chatThreadReportedNotice: 'Reporte enviado. Un anchor puede revisarlo desde la cola de moderación.',
    chatThreadBlockedNotice: 'Esta conversación está bloqueada. No puedes enviar mensajes nuevos en este hilo.',
    chatThreadRelatedTitle: 'Contexto relacionado',
    chatThreadRelatedPostLabel: 'Publicación relacionada',
    chatThreadRelatedPostMissing: 'Esta conversación no tiene una vista previa de publicación relacionada.',
    chatThreadMessagesTitle: 'Mensajes',
    chatThreadMessagesCopy: 'Los mensajes llegan aquí en tiempo real, mientras la publicación relacionada y el contexto de safety siguen visibles junto al hilo.',
    chatThreadLastSeen: 'Actualizado {value}',
    chatThreadEmpty: 'Todavía no hay mensajes. Usa una frase rápida para empezar.',
    chatThreadYou: 'Tú',
    chatThreadSystem: 'Sistema',
    chatThreadComposerLabel: 'Mensaje',
    chatThreadComposerPlaceholder: 'Escribe un mensaje corto y práctico...',
    chatThreadComposerHint: 'Mantén los mensajes breves y evita compartir datos sensibles hasta acordar un siguiente paso seguro.',
    chatThreadSendAction: 'Enviar mensaje',
    chatThreadFallbackAlias: 'Persona de la conversación',
    chatQuickPhraseHello: 'Hola, ya puedo responder por aquí.',
    chatQuickPhraseTiming: 'Necesito unos 15 minutos antes de responder.',
    chatQuickPhrasePublicMeet: 'Podemos mantener esto en un punto de encuentro o entrega público?',
    chatQuickPhraseThanks: 'Gracias. Estoy confirmando el siguiente paso ahora.',
  },
  zh: {
    brand: 'WeaveNYC',
    devLink: 'M0 调试页',
    heroEyebrow: '附近资源',
    heroTitle: '先选语言和 ZIP，再快速查看附近的食物支持资源。',
    heroCopy: '首页现在是资源入口，不再是 M0 仪表盘。你可以先匿名浏览，之后再按需要升级为 verified。',
    sessionAnonymous: '匿名会话',
    sessionVerified: '已验证会话',
    sessionAnchor: 'Anchor 会话',
    createSession: '创建匿名会话',
    creatingSession: '正在创建会话…',
    sessionReady: '会话已就绪',
    goVerify: '升级为 verified',
    onboardingTitle: '先设置语言和 ZIP',
    onboardingCopy: 'M1 的首屏尽量轻：先选界面语言、保存 ZIP、查看附近资源，再决定是否做验证升级。',
    searchTitle: '附近资源',
    zipLabel: '邮编',
    zipPlaceholder: '11735',
    zipValidation: '请输入有效的 5 位邮编。',
    seeNearby: '查看附近资源',
    filtersOpenNow: '当前开放',
    filtersToday: '今天开放',
    filtersType: '类型',
    filtersAll: '全部',
    lowBandwidth: '低带宽模式',
    resultTitle: '你附近的官方资源',
    resultCount: '附近 {count} 个资源',
    sampleMode: '当前资源 API 还没就绪，正在显示前端回退示例数据。',
    noResults: '当前 ZIP 和筛选条件下没有匹配资源。',
    resourceLoadingList: '正在加载附近资源…',
    resourceLoadError: '资源加载失败。',
    detailCta: '查看详情',
    call: '拨打电话',
    directions: '导航',
    bookmarked: '已收藏',
    save: '收藏',
    sessionIdChip: 'user_id: {userId}',
    zipChip: '邮编: {zip}',
    distanceMiles: '{distance} 英里',
    anonymousSessionError: '创建会话失败。',
    verifyTitle: '验证你的会话',
    verifyCopy: '使用短信验证码或 magic link fallback，把匿名会话升级为 verified。当前页面已经接好真实认证接口，也支持本地 demo fallback。',
    otpTab: '短信验证码',
    magicLinkTab: 'Magic link',
    phoneLabel: '手机号',
    emailLabel: '邮箱',
    codeLabel: '验证码',
    tokenLabel: 'Magic link token',
    verifyNeedsSession: '请先在首页创建匿名会话，再使用验证升级流程。',
    verifyError: '验证请求失败。',
    sendCode: '发送验证码',
    verifyCode: '验证',
    sendLink: '发送链接',
    useDemoLink: '使用 demo 链接',
    demoCodeLabel: 'Demo 验证码',
    demoTokenLabel: 'Demo token',
    verificationDone: '当前会话已经是 verified。',
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
    homeCommunityCopy: 'M2 在资源入口上叠加了社区主线：加入社区、发布求助、发布帮助，并把自己的帖子放在同一个入口里。',
    homeCommunityReady: '社区已就绪',
    joinCommunityCta: '加入社区',
    requestHelpCta: '发布求助',
    offerHelpCta: '发布帮助',
    communityTitle: '社区主线',
    communityCopy: '通过邀请码或二维码加入社区，在社区帖和公开帖之间切换，并集中查看自己的求助与帮助帖子。',
    communityFeedHeading: '社区帖子流',
    communityNoMembership: '先加入一个社区，才能查看和发布社区内帖子。',
    communityTab: '社区',
    publicTab: '公开',
    currentCommunityLabel: '当前社区',
    joinTitle: '加入社区',
    joinCopy: '先解析邀请码或二维码，再在这台设备上确认加入。',
    joinNeedsSession: '请先创建匿名会话，再加入社区。',
    joinInviteMode: '邀请码',
    joinQrMode: '二维码',
    inviteCodeLabel: '邀请码',
    qrTokenLabel: '二维码 token 或扫描结果',
    resolveCommunityAction: '解析社区',
    clearJoinPreview: '清除',
    confirmJoinAction: '确认加入',
    qrScanCamera: '使用相机扫描',
    qrScanUpload: '上传二维码图片',
    qrCapture: '识别二维码',
    qrUnsupported: '当前浏览器不支持二维码识别，请直接粘贴 token。',
    composeTitle: '创建帖子',
    composeCopy: '先选择 request 或 offer，再填写内容并预览后发布。Request 对匿名成员开放；Offer 需要 verified。',
    composeNeedsCommunity: '发布社区帖子前请先加入社区。',
    composeNeedsVerified: '发布 offer 或高风险帖子前，请先完成 verified。',
    composeStepType: '选择类型',
    composeStepCompose: '填写内容',
    composeStepPreview: '预览',
    composeCurrentCommunity: '社区',
    composeTitleLabel: '标题',
    composeBodyLabel: '详细内容',
    composeExpiresLabel: '过期时间',
    composePrivacyLabel: '可见范围',
    composeContactChat: '之后可用站内聊天',
    composeContactText: '允许短信联系',
    composePublishAction: '发布帖子',
    speechBrowserAction: '使用浏览器语音',
    speechFallbackAction: '上传音频 fallback',
    speechBrowserError: '浏览器语音识别不可用。',
    postsLoading: '正在加载帖子…',
    postsEmpty: '这个标签页下还没有帖子。',
    postDetailTitle: '帖子详情',
    postEditAction: '编辑帖子',
    postCloseAction: '关闭帖子',
    postDeleteAction: '删除帖子',
    myPostsTitle: '我的帖子',
    myPostsCopy: '按 active、pending、closed、removed 查看你在这台设备上创建的全部帖子。',
    postsGroup_active: '进行中',
    postsGroup_pending_review: '待审核',
    postsGroup_closed: '已关闭',
    postsGroup_removed: '已删除',
    postsEmptyGroup: '当前状态下还没有帖子。',
    seeActionPlans: '查看行动方案',
    matchTitle: '现在可以做的 3 个行动',
    matchCopy: '这个页面会把附近邻里 Offer 和官方资源放在一起，让每个 active request 都有明确下一步。',
    matchLoading: '正在加载行动方案…',
    matchUnavailable: '行动方案暂时不可用。',
    matchOwnerOnly: '只有 active request 的发布者才能查看行动方案。',
    matchNeedsActiveRequest: '只有 active 的 request 帖子才能打开行动方案。',
    matchRefreshAction: '换一个方案',
    matchRefreshStatus: '已使用 {used}/{max} 次刷新',
    matchNoResults: '暂时还没有可用的行动方案。',
    matchContactAction: '联系对方',
    matchOpenPost: '打开帖子',
    matchOfficialFallback: '官方资源兜底',
    matchContactReady: '已准备好继续向 {title} 发起联系请求。',
    matchContinueIntent: '继续发起联系请求',
    matchClearIntent: '清除返回意图',
    matchContactPending: '联系请求已发送，对方会在 inbox 里看到。',
    matchGoInbox: '打开 inbox',
    inboxTitle: 'Inbox',
    inboxCopy: '请求和会话在这里放在一起。用请求处理交接，用聊天继续实时线程。',
    inboxBackHome: '返回社区',
    inboxAllTab: '全部',
    inboxRequestsTab: '请求',
    inboxChatsTab: '聊天',
    inboxViewLabel: '当前视图：{view}',
    inboxViewHeading: 'Inbox 视图',
    inboxViewCopy: '在请求和聊天之间切换，或者同时显示两者。',
    inboxRequestsTitle: '请求',
    inboxRequestsCopy: '待处理的联系交接会先出现在这里。',
    inboxRequestsEmpty: '当前没有待处理请求。',
    inboxChatsTitle: '聊天',
    inboxChatsCopy: '已接受的请求和实时线程会一起保留在这里。',
    inboxChatsEmpty: '当前还没有聊天或待处理请求。',
    inboxRefresh: '刷新 inbox',
    inboxPendingCount: '{count} 个待处理',
    inboxUnreadCount: '{count} 条未读',
    inboxCreated: '创建时间',
    inboxExpires: '过期时间',
    inboxAccept: '接受',
    inboxReject: '拒绝',
    inboxRelatedPost: '打开相关帖子',
    inboxOpenThread: '打开线程',
    inboxPendingPreview: '与“{title}”相关的待交接请求',
    inboxUnreadBadge: '{count} 条新消息',
    inboxExpiresAt: '{value} 过期',
    inboxFromPost: '来源帖子：{title}',
    inboxNeedsSession: '先创建匿名会话，再打开 inbox。',
    inboxNeedsVerified: '先验证此会话，才能处理 inbox 请求和聊天。',
    inboxVerifyAction: '验证后打开 inbox',
    contactInboxTitle: 'Inbox',
    contactInboxCopy: '请求和会话会一起出现在这里。',
    contactInboxEmpty: '当前还没有请求或会话。',
    contactInboxRefresh: '刷新 inbox',
    contactInboxCreated: '创建时间',
    contactInboxExpires: '过期时间',
    contactInboxAccept: '接受',
    contactInboxReject: '拒绝',
    contactInboxRelatedPost: '打开相关帖子',
    chatInboxTitle: 'Inbox',
    chatInboxCopy: '请求和会话会一起出现在这里。',
    chatInboxEmpty: '当前还没有请求或会话。',
    chatInboxRefresh: '刷新 inbox',
    chatInboxUnreadCount: '{count} 条未读',
    chatInboxPendingCount: '{count} 个待处理请求',
    chatInboxConversationsTitle: '聊天',
    chatInboxConversationsCopy: '已接受的请求和实时线程会一起保留在这里。',
    chatInboxPendingPreview: '与“{title}”相关的待交接请求',
    chatInboxUnreadBadge: '{count} 条新消息',
    chatInboxExpiresAt: '{value} 过期',
    chatInboxFromPost: '来源帖子：{title}',
    chatInboxOpenThread: '打开线程',
    chatThreadTitle: '会话',
    chatThreadCopy: '这个线程把联系交接、快捷短语和最小 trust & safety 动作放在同一个入口里。',
    chatThreadLoading: '正在加载会话...',
    chatThreadStatusLive: '实时线程壳层',
    chatThreadDetailsTitle: '会话信息',
    chatThreadDetailsCopy: '参与者、快捷短语和审核动作都可以在不离开线程的情况下完成。',
    chatThreadSafetyTitle: '安全提醒',
    chatThreadSafetyCopy: '避免在聊天里发送完整地址、银行信息、证件号码，或任何你不希望被长期留存的隐私细节。',
    chatThreadQuickPhrasesTitle: '快捷短语',
    chatThreadActionsTitle: '信任与安全',
    chatThreadReportAction: '举报此会话',
    chatThreadBlockAction: '屏蔽此用户',
    chatThreadReportedNotice: '举报已提交，anchor 可以在审核队列里处理。',
    chatThreadBlockedNotice: '这段会话已被屏蔽，当前线程不能再发送新消息。',
    chatThreadRelatedTitle: '相关上下文',
    chatThreadRelatedPostLabel: '相关帖子',
    chatThreadRelatedPostMissing: '这段会话没有可展示的关联帖子摘要。',
    chatThreadMessagesTitle: '消息',
    chatThreadMessagesCopy: '消息会在这里实时到达，同时仍然保留相关帖子和安全上下文，方便边聊边确认下一步。',
    chatThreadLastSeen: '最近更新于 {value}',
    chatThreadEmpty: '暂时还没有消息，可以先发送一句快捷短语。',
    chatThreadYou: '你',
    chatThreadSystem: '系统',
    chatThreadComposerLabel: '消息内容',
    chatThreadComposerPlaceholder: '输入一条简短、务实的消息...',
    chatThreadComposerHint: '先保持简短，不要在双方确认安全下一步前分享敏感信息。',
    chatThreadSendAction: '发送消息',
    chatThreadFallbackAlias: '会话对方',
    chatQuickPhraseHello: '你好，我现在可以在这里沟通。',
    chatQuickPhraseTiming: '我大概需要 15 分钟后再回复。',
    chatQuickPhrasePublicMeet: '我们可以只约在公开、安全的地点见面吗？',
    chatQuickPhraseThanks: '谢谢，我正在确认下一步安排。',
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
    request: { en: 'Request', es: 'Request', zh: '求助' },
    offer: { en: 'Offer', es: 'Offer', zh: '帮助' },
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
    anchor_mediated: { en: 'Anchor mediated', es: 'Con mediación anchor', zh: 'Anchor 协调' },
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
    anchor_reviewed: { en: 'Anchor-reviewed', es: 'Revisado por anchor', zh: 'Anchor 已审核' },
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
