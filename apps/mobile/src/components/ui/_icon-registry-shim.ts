/**
 * Icon registry — M4a-1 shim.
 * ===========================
 *
 * This file is a **temporary** placeholder that unblocks the Icon / IconButton
 * atom ports (R4) while M4a-1 (`mobile/m4a-1-svg-assets`, PR #90) is still
 * in flight. M4a-1 ships the real registry at
 * `apps/mobile/src/assets/icons/registry.ts` plus the 16 SVG source files
 * and wires `react-native-svg-transformer` into metro.config.js so each
 * `.svg` imports as a React component.
 *
 * Contract
 * --------
 * The name union below is deliberately a **strict subset** of the PWA's
 * `IconName` enum — just the 9 names exercised by existing mobile call
 * sites + tests. Once M4a-1 lands on main, R4's follow-up diff replaces
 * this import with the real registry:
 *
 *   - import { type IconName } from './_icon-registry-shim';
 *   + import { icons, type IconName } from '../../assets/icons/registry';
 *
 * Until then, the shim exposes ONLY the type (no runtime `icons` map), so
 * the Icon atom must gracefully handle the "no component found" branch by
 * rendering a labelled `<View />` placeholder. That branch is useful on
 * its own merit — it also catches typos in `name` at runtime in dev.
 */

export type IconName =
  | 'food'
  | 'meal'
  | 'fresh'
  | 'money'
  | 'general'
  | 'bookmark'
  | 'chat'
  | 'share'
  | 'chevron-right';
