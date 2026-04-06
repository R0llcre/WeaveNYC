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
    onboardingCopy: 'M1 keeps the first-run path light: choose your preferred UI language, save a ZIP, and browse nearby resources before deciding whether to verify.',
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
    verifyCopy: 'Upgrade from anonymous to verified using OTP or a magic-link fallback. The forms are wired for the planned M1 endpoints and stay usable with local demo fallbacks.',
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
    verifyCopy: 'Sube de anónimo a verificado con OTP o con fallback de magic link. Los formularios ya están conectados a las rutas planeadas de M1 y siguen funcionando con modo demo.',
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
    verifyCopy: '使用短信验证码或 magic link fallback，把匿名会话升级为 verified。当前页面已经接好计划中的 M1 接口，也支持本地 demo fallback。',
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
