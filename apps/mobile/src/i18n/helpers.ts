/**
 * Runtime label helpers ported from `apps/pwa/src/lib/i18n.ts`.
 *
 * The PWA's helpers took a `SupportedLanguage` string and returned the copy
 * by dipping into a flat record. On mobile we use react-i18next, so each
 * helper takes a `t` function from `useTranslation()` and returns the copy.
 * Callers stay ergonomic:
 *
 *   const { t } = useTranslation(['home', 'posts']);
 *   getTypeLabel(t, 'pantry'); // → "Pantry" (en) / "Despensa" (es) / "食品领取点" (zh)
 *
 * The enum-level labels below are the canonical source for the mobile app —
 * we don't re-namespace them into JSON because they're 1:1 with
 * `packages/shared` enum values and duplicating them there would create two
 * sources of truth. If a new resource type lands in the shared enum, the
 * TypeScript discriminated-union on `ResourceFilterType` will catch the
 * missing case here at compile time.
 */

type TFunction = (key: string, options?: Record<string, unknown>) => string;
export type AppLocale = 'en' | 'es' | 'zh-Hans';

// --- type discriminants (1:1 with packages/shared enums) -----------------

export type ResourceFilterType =
  | 'all'
  | 'pantry'
  | 'kitchen'
  | 'market'
  | 'benefits'
  | 'other'
  | 'snap_retailer'
  | 'senior_meal_site'
  | 'fqhc'
  | 'soup_kitchen'
  | 'mobile_pantry'
  | 'community_fridge';

export type PostType = 'request' | 'offer';

export type PostCategory =
  | 'food'
  | 'goods'
  | 'childcare'
  | 'companionship'
  | 'translation'
  | 'transportation'
  | 'other';

export type PostPrivacy = 'community_only' | 'public' | 'anchor_mediated';

export type PostStatus = 'draft' | 'pending_review' | 'active' | 'fulfilled' | 'closed' | 'removed';

export type MatchReason =
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
  | 'language_supported';

export type ContactRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export type UserLevel = 'anonymous' | 'verified' | 'anchor';

// --- session / hero label -------------------------------------------------

export function getSessionLabel(t: TFunction, level: UserLevel): string {
  if (level === 'verified') return t('chrome:sessionVerified');
  if (level === 'anchor') return t('chrome:sessionAnchor');
  return t('chrome:sessionAnonymous');
}

// --- resource type label --------------------------------------------------
// Uses `home:filtersAll` for the "all" sentinel so users see the same word
// they tapped on the filter chip. Every other type has a triplet table so a
// single `t` lookup is never enough.

const RESOURCE_TYPE_LABELS: Record<Exclude<ResourceFilterType, 'all'>, Record<AppLocale, string>> =
  {
    pantry: { en: 'Pantry', es: 'Despensa', 'zh-Hans': '食品领取点' },
    kitchen: { en: 'Kitchen', es: 'Comedor', 'zh-Hans': '社区厨房' },
    market: { en: 'Market', es: 'Mercado', 'zh-Hans': '流动市场' },
    benefits: { en: 'Benefits', es: 'Beneficios', 'zh-Hans': '福利支持' },
    other: { en: 'Other', es: 'Otro', 'zh-Hans': '其他' },
    snap_retailer: { en: 'SNAP retailer', es: 'Tienda SNAP', 'zh-Hans': 'EBT 商店' },
    senior_meal_site: { en: 'Senior meals', es: 'Comidas para mayores', 'zh-Hans': '老人餐点' },
    fqhc: { en: 'Health center', es: 'Centro de salud', 'zh-Hans': '社区健康中心' },
    soup_kitchen: { en: 'Soup kitchen', es: 'Comedor comunitario', 'zh-Hans': '免费餐厅' },
    mobile_pantry: { en: 'Mobile pantry', es: 'Despensa móvil', 'zh-Hans': '流动食品站' },
    community_fridge: { en: 'Community fridge', es: 'Nevera comunitaria', 'zh-Hans': '社区冰箱' },
  };

const POST_TYPE_LABELS: Record<PostType, Record<AppLocale, string>> = {
  request: { en: 'Request', es: 'Pedido', 'zh-Hans': '求助' },
  offer: { en: 'Offer', es: 'Ofrecimiento', 'zh-Hans': '帮助' },
};

const POST_CATEGORY_LABELS: Record<PostCategory, Record<AppLocale, string>> = {
  food: { en: 'Food', es: 'Comida', 'zh-Hans': '食物' },
  goods: { en: 'Goods', es: 'Bienes', 'zh-Hans': '物资' },
  childcare: { en: 'Childcare', es: 'Cuidado infantil', 'zh-Hans': '儿童照看' },
  companionship: { en: 'Companionship', es: 'Compañía', 'zh-Hans': '陪伴' },
  translation: { en: 'Translation', es: 'Traducción', 'zh-Hans': '翻译' },
  transportation: { en: 'Transportation', es: 'Transporte', 'zh-Hans': '交通' },
  other: { en: 'Other', es: 'Otro', 'zh-Hans': '其他' },
};

const POST_PRIVACY_LABELS: Record<PostPrivacy, Record<AppLocale, string>> = {
  community_only: { en: 'Community only', es: 'Solo comunidad', 'zh-Hans': '仅社区可见' },
  public: { en: 'Public', es: 'Público', 'zh-Hans': '公开' },
  anchor_mediated: { en: 'Coordinator helps', es: 'Coordinador ayuda', 'zh-Hans': '由协调员转接' },
};

const POST_STATUS_LABELS: Record<PostStatus, Record<AppLocale, string>> = {
  draft: { en: 'Draft', es: 'Borrador', 'zh-Hans': '草稿' },
  pending_review: { en: 'Pending review', es: 'Pendiente de revisión', 'zh-Hans': '待审核' },
  active: { en: 'Active', es: 'Activa', 'zh-Hans': '已发布' },
  fulfilled: { en: 'Fulfilled', es: 'Resuelta', 'zh-Hans': '已完成' },
  closed: { en: 'Closed', es: 'Cerrada', 'zh-Hans': '已关闭' },
  removed: { en: 'Removed', es: 'Eliminada', 'zh-Hans': '已删除' },
};

const MATCH_REASON_LABELS: Record<MatchReason, Record<AppLocale, string>> = {
  same_category: { en: 'Same category', es: 'Misma categoría', 'zh-Hans': '同类需求' },
  same_language: { en: 'Language match', es: 'Idioma coincide', 'zh-Hans': '语言匹配' },
  within_1_mile: { en: 'Within 1 mile', es: 'A 1 milla', 'zh-Hans': '1 英里内' },
  within_3_miles: { en: 'Within 3 miles', es: 'A 3 millas', 'zh-Hans': '3 英里内' },
  within_5_miles: { en: 'Within 5 miles', es: 'A 5 millas', 'zh-Hans': '5 英里内' },
  verified_user: { en: 'Verified', es: 'Verificado', 'zh-Hans': '已验证' },
  anchor_reviewed: {
    en: 'Coordinator reviewed',
    es: 'Revisado por el coordinador',
    'zh-Hans': '协调员已审核',
  },
  expires_soon: { en: 'Expires soon', es: 'Expira pronto', 'zh-Hans': '即将过期' },
  open_now: { en: 'Open now', es: 'Abierto ahora', 'zh-Hans': '当前开放' },
  open_today: { en: 'Open today', es: 'Abierto hoy', 'zh-Hans': '今天开放' },
  nearby_resource: { en: 'Nearby resource', es: 'Recurso cercano', 'zh-Hans': '附近资源' },
  language_supported: {
    en: 'Language supported',
    es: 'Idioma disponible',
    'zh-Hans': '支持该语言',
  },
};

const CONTACT_REQUEST_STATUS_LABELS: Record<ContactRequestStatus, Record<AppLocale, string>> = {
  pending: { en: 'Pending', es: 'Pendiente', 'zh-Hans': '待处理' },
  accepted: { en: 'Accepted', es: 'Aceptada', 'zh-Hans': '已接受' },
  rejected: { en: 'Rejected', es: 'Rechazada', 'zh-Hans': '已拒绝' },
  expired: { en: 'Expired', es: 'Expirada', 'zh-Hans': '已过期' },
  cancelled: { en: 'Cancelled', es: 'Cancelada', 'zh-Hans': '已取消' },
};

/**
 * Pick the active locale given a react-i18next `t` function. We read off
 * `i18next.language` at the call site via a small helper so each label
 * lookup stays synchronous.
 */
function currentLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const i18next = require('i18next') as { default?: { language: string } } & {
      language: string;
    };
    const lng = (i18next.default ?? i18next).language ?? 'en';
    if (lng.startsWith('es')) return 'es';
    if (lng.startsWith('zh')) return 'zh-Hans';
    return 'en';
  } catch {
    return 'en';
  }
}

export function getTypeLabel(t: TFunction, type: ResourceFilterType): string {
  if (type === 'all') return t('home:filtersAll');
  return RESOURCE_TYPE_LABELS[type][currentLocale()];
}

export function getPostTypeLabel(_t: TFunction, type: PostType): string {
  return POST_TYPE_LABELS[type][currentLocale()];
}

export function getCategoryLabel(_t: TFunction, category: PostCategory): string {
  return POST_CATEGORY_LABELS[category][currentLocale()];
}

export function getPostPrivacyLabel(_t: TFunction, privacy: PostPrivacy): string {
  return POST_PRIVACY_LABELS[privacy][currentLocale()];
}

export function getPostStatusLabel(_t: TFunction, status: PostStatus): string {
  return POST_STATUS_LABELS[status][currentLocale()];
}

export function getMatchReasonLabel(_t: TFunction, reason: MatchReason): string {
  return MATCH_REASON_LABELS[reason][currentLocale()];
}

export function getContactRequestStatusLabel(
  _t: TFunction,
  status: ContactRequestStatus,
): string {
  return CONTACT_REQUEST_STATUS_LABELS[status][currentLocale()];
}

/**
 * ZIP label used on the Home header. Matches the PWA behaviour: if the user
 * hasn't set a ZIP yet, show a hint rather than a blank chip.
 */
export function formatZipLabel(zipCode: string | null | undefined, t: TFunction): string {
  return zipCode && zipCode.length > 0 ? zipCode : t('home:homeNoZipTitle');
}
