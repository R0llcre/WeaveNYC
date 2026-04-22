/**
 * TokenPreview — dev-only atlas of every design token.
 * =====================================================
 *
 * Renders swatches for all `colors`, a grid of spacing rulers, sample rows
 * for every `borderRadii`, and a full type specimen (every `textVariant`).
 *
 * Usage
 * -----
 * - Not included in production bundles — only imported by the dev harness
 *   (Storybook RN wave B) or an on-device design-QA screen.
 * - When M3/M4 land atoms, this file becomes the first Storybook story.
 *
 * Why it's in `__preview__/`: matches the convention for code that is
 * explicitly non-shippable (`__preview__`, `__tests__`, `__mocks__`).
 * Any tree-shaker or build-time filter keyed on `__preview__` excludes it.
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

import { useAppTheme } from '../provider';
import type { Theme } from '../tokens';

// ---------------------------------------------------------------------------
// Section wrapper — reused to keep the preview consistent.
// ---------------------------------------------------------------------------
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        marginBottom: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.m,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fontFamilies.display,
          fontSize: 26,
          lineHeight: 32,
          fontWeight: theme.fontWeights.medium as '500',
          color: theme.colors.inkPrimary,
          marginBottom: theme.spacing.m,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Color swatches.
// ---------------------------------------------------------------------------
function ColorSwatch({
  name,
  value,
}: {
  name: keyof Theme['colors'];
  value: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.borderRadii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: value,
          marginRight: theme.spacing.m,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: theme.fontFamilies.bodyMedium,
            fontSize: 14,
            color: theme.colors.inkPrimary,
            fontWeight: theme.fontWeights.medium as '500',
          }}
        >
          {String(name)}
        </Text>
        <Text
          style={{
            fontFamily: theme.fontFamilies.body,
            fontSize: 12,
            color: theme.colors.inkMuted,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function ColorPalette() {
  const theme = useAppTheme();
  const entries = Object.entries(theme.colors) as Array<
    [keyof Theme['colors'], string]
  >;
  return (
    <View>
      {entries.map(([key, value]) => (
        <ColorSwatch key={String(key)} name={key} value={value} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Spacing rulers.
// ---------------------------------------------------------------------------
function SpacingRulers() {
  const theme = useAppTheme();
  const entries = Object.entries(theme.spacing) as Array<[string, number]>;
  return (
    <View>
      {entries.map(([name, size]) => (
        <View
          key={name}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: theme.spacing.s,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.body,
              fontSize: 13,
              color: theme.colors.inkSecondary,
              width: 96,
            }}
          >
            {name} ({size}px)
          </Text>
          <View
            style={{
              height: 12,
              width: Math.max(size, 1),
              backgroundColor: theme.colors.accent,
              borderRadius: theme.borderRadii.sm,
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Radius samples.
// ---------------------------------------------------------------------------
function RadiusSamples() {
  const theme = useAppTheme();
  const entries = Object.entries(theme.borderRadii) as Array<[string, number]>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {entries.map(([name, size]) => (
        <View
          key={name}
          style={{
            width: 96,
            height: 96,
            marginRight: theme.spacing.m,
            marginBottom: theme.spacing.m,
            borderRadius: Math.min(size, 48), // cap pill preview so it's visible
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.bodyMedium,
              fontSize: 13,
              color: theme.colors.inkPrimary,
              fontWeight: theme.fontWeights.medium as '500',
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              fontFamily: theme.fontFamilies.body,
              fontSize: 11,
              color: theme.colors.inkMuted,
              marginTop: 2,
            }}
          >
            {size}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Type specimen — one row per textVariant.
// ---------------------------------------------------------------------------
function TypeSpecimen() {
  const theme = useAppTheme();
  const variants = Object.entries(theme.textVariants) as Array<
    [string, Record<string, unknown>]
  >;
  return (
    <View>
      {variants.map(([name, spec]) => (
        <View
          key={name}
          style={{
            marginBottom: theme.spacing.m,
            paddingBottom: theme.spacing.s,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.body,
              fontSize: 11,
              color: theme.colors.inkMuted,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {name} · {String(spec.fontFamily)} · {String(spec.fontSize)}/
            {String(spec.lineHeight)} · {String(spec.fontWeight)}
          </Text>
          <Text
            style={{
              fontFamily: spec.fontFamily as string,
              fontSize: spec.fontSize as number,
              lineHeight: spec.lineHeight as number,
              fontWeight: spec.fontWeight as '400',
              color: theme.colors.inkPrimary,
            }}
          >
            WeaveNYC · 社区织网
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shadow / boxShadow samples.
// ---------------------------------------------------------------------------
function ShadowSamples() {
  const theme = useAppTheme();
  const entries = Object.entries(theme.boxShadows) as Array<
    [string, Record<string, unknown>]
  >;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {entries.map(([name, shadow]) => (
        <View
          key={name}
          style={[
            {
              width: 110,
              height: 96,
              marginRight: theme.spacing.l,
              marginBottom: theme.spacing.l,
              borderRadius: theme.borderRadii.lg,
              backgroundColor: theme.colors.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            },
            shadow as object,
          ]}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.bodyMedium,
              fontSize: 13,
              color: theme.colors.inkPrimary,
              fontWeight: theme.fontWeights.medium as '500',
            }}
          >
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Top-level preview.
// ---------------------------------------------------------------------------
export function TokenPreview() {
  const theme = useAppTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        paddingTop: theme.spacing.xxl,
        paddingBottom: theme.spacing.xxxxl,
      }}
    >
      <View style={{ paddingHorizontal: theme.spacing.m }}>
        <Text
          style={{
            fontFamily: theme.fontFamilies.display,
            fontSize: 32,
            lineHeight: 38,
            fontWeight: theme.fontWeights.medium as '500',
            color: theme.colors.inkPrimary,
            marginBottom: theme.spacing.xs,
          }}
        >
          WeaveNYC Tokens
        </Text>
        <Text
          style={{
            fontFamily: theme.fontFamilies.body,
            fontSize: 14,
            color: theme.colors.inkMuted,
            marginBottom: theme.spacing.xxl,
          }}
        >
          Editorial 朱砂 — ported from PWA globals.css
        </Text>
      </View>

      <Section title="Colors">
        <ColorPalette />
      </Section>
      <Section title="Spacing">
        <SpacingRulers />
      </Section>
      <Section title="Radii">
        <RadiusSamples />
      </Section>
      <Section title="Typography">
        <TypeSpecimen />
      </Section>
      <Section title="Shadows">
        <ShadowSamples />
      </Section>
    </ScrollView>
  );
}

export default TokenPreview;
