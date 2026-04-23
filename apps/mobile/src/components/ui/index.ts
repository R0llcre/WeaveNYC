/**
 * UI atoms — public barrel (R4 scope).
 * ====================================
 *
 * Consumers (screens, composite components) import atoms from this path:
 *
 *   import { Icon, IconButton } from '@/components/ui';
 *
 * R4 scope: icon + icon-button atom ports. When M3a (atoms-primary) and
 * M3b (atoms-layout) merge, this barrel expands to include Button, Card,
 * Pill, Tag, Banner, Stack, Inline, etc. Never reach into the component
 * module directly from a screen.
 */

export { Icon } from './Icon';
export type { IconName, IconProps, IconSize, IconTone } from './Icon';

export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonSize } from './IconButton';
