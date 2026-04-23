/**
 * UI atoms — public barrel.
 * =========================
 *
 * Consumers (screens, composite components) import atoms from this path:
 *
 *   import { Avatar, Checkbox, Radio, RadioGroup } from '@/components/ui';
 *
 * R3 scope: three secondary atoms — `Avatar` (circular identity glyph
 * with initials fallback) and `Checkbox` + `Radio` / `RadioGroup` (form
 * selection primitives). Subsequent waves extend this barrel via their
 * own export blocks — screens must never reach into component modules
 * directly, so the barrel stays the single cross-cutting import path.
 */

// ---- R3: identity + form selection atoms --------------------------------

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Radio, RadioGroup } from './Radio';
export type { RadioProps, RadioGroupProps } from './Radio';
