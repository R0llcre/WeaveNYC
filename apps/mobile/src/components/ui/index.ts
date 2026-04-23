/**
 * UI atoms — public barrel.
 * =========================
 *
 * Consumers (screens, composite components) import atoms from this path:
 *
 *   import { Stack, Inline, Button, Field } from '@/components/ui';
 *
 * The barrel is the single cross-cutting import path. Screens must never
 * reach into a component module directly — that keeps the import graph
 * flat and lets this file be the append-point when atoms are added,
 * renamed, or extracted into a shared package.
 *
 * Adding a new atom: add the component file, then re-export it here.
 * Types that travel with a component (prop interfaces, enum unions) are
 * re-exported alongside so callers don't reach into the component module
 * directly.
 *
 * Wave B coverage (20 atoms of 22 planned — the remaining two ship in a
 * follow-on wave):
 *
 *   - Primary       (R1 / #94):  Button, Card
 *   - Advisory      (R2 / #95):  Pill, Tag, Banner
 *   - Selection     (R3 / #96):  Avatar, Checkbox, Radio + RadioGroup
 *   - Iconography   (R4 / #93):  Icon, IconButton
 *   - Layout        (M3b / #91): Toast, EmptyState, Field, Stack, Inline
 *   - Resource      (M4b / #92): PageHeader, Skeleton, ResourceCard,
 *                                RouteLoadingFallback, SandboxBanner
 */

// ---- Primary (R1) -------------------------------------------------------

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

// ---- Advisory (R2) ------------------------------------------------------

export { Pill } from './Pill';
export type { PillProps } from './Pill';

export { Tag } from './Tag';
export type { TagProps, TagTone } from './Tag';

export { Banner } from './Banner';
export type { BannerProps, BannerTone } from './Banner';

// ---- Selection (R3) -----------------------------------------------------

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Radio, RadioGroup } from './Radio';
export type { RadioProps, RadioGroupProps } from './Radio';

// ---- Iconography (R4) ---------------------------------------------------

export { Icon } from './Icon';
export type { IconName, IconProps, IconSize, IconTone } from './Icon';

export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonSize } from './IconButton';

// ---- Layout + feedback (M3b) -------------------------------------------

export { Stack } from './Stack';
export type {
  StackProps,
  StackSpaceToken,
  StackAlign,
  StackJustify,
} from './Stack';

export { Inline } from './Inline';
export type {
  InlineProps,
  InlineSpaceToken,
  InlineAlign,
  InlineJustify,
} from './Inline';

export { Field } from './Field';
export type { FieldProps } from './Field';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateCta, EmptyStateTone } from './EmptyState';

export { Toast } from './Toast';
export type { ToastProps, ToastTone } from './Toast';

// ---- Resource / scaffolding (M4b) --------------------------------------

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

export { ResourceCard } from './ResourceCard';
export type {
  ResourceCardProps,
  ResourceCardResource,
  ResourceCardLabels,
  ResourceCardCategory,
} from './ResourceCard';

export { RouteLoadingFallback } from './RouteLoadingFallback';
export type { RouteLoadingFallbackProps } from './RouteLoadingFallback';

export { SandboxBanner, isDemoSandboxBuild } from './SandboxBanner';
export type { SandboxBannerProps } from './SandboxBanner';
