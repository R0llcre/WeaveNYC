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
};

export const messages: Record<SupportedLanguage, ChromeMessages> = {
  en: {
    brand: 'WeaveNYC',
    devLink: 'M0 debug',
    heroEyebrow: 'M1 resource finder',
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
  },
  es: {
    brand: 'WeaveNYC',
    devLink: 'Depuración M0',
    heroEyebrow: 'Buscador M1',
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
  },
  zh: {
    brand: 'WeaveNYC',
    devLink: 'M0 调试页',
    heroEyebrow: 'M1 资源发现',
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
