/**
 * BentoConceptCard — Glassmorphic bento-grid variant of ConceptCard.
 *
 * Two variants:
 *   - 'full' → horizontal tile showing icon + title + prompt + chevron
 *   - 'half' → square tile showing icon + title only. The prompt lives
 *     on the next screen (PromptDesign) — progressive disclosure via
 *     navigation, not in-place expansion.
 *
 * Visual language (replaces the 3px colored left accent bar of
 * ConceptCard):
 *   - Frosted-glass body via BlurView + a subtle solid tint overlay
 *     so the material reads even on flat backdrops
 *   - "Aura" glow: two stacked colored halos behind the icon at low
 *     alpha, plus an iOS-only native shadow to push the bleed outward.
 *     Reads as "the icon is emitting colored light into the glass"
 *   - 1px etched-edge border for the crisp iOS-style glass outline
 *
 * Revert path: this component is net-new. Delete the file and swap
 * the import in ConceptsScreen.tsx back to ConceptCard to return to
 * the pre-redesign list layout.
 */

import React from 'react';
import { StyleSheet, Text, View, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import PressableSurface from '../ui/PressableSurface';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Tiles are adaptive iOS-style materials — they frost the canvas
// behind them rather than painting over it, so the palette below
// branches on `isDark`. Dark values match `tokens.ts` dark-mode
// surface/text; light values are tuned for the light canvas:
// - `card.bg`  — translucent so the BlurView has real content to
//                sample instead of reading as a solid slab.
// - `tint`     — sits on top of the blur to give a predictable
//                base color independent of the backdrop.
// - `auraOuter/Inner` — hex alpha suffixes. Light mode bumps
//                saturation (~2×) so the accent glow stays
//                legible against the lighter canvas.
type CardPalette = {
  bg: string;
  border: string;
  tint: string;
  blurIntensity: number;
  blurTint: 'dark' | 'light';
  auraOuterAlpha: string; // two-char hex alpha suffix appended to `accent`
  auraInnerAlpha: string;
};

const DARK_PALETTE: CardPalette = {
  bg: '#1E1E28',                      // surfaceColors.elevated.dark
  border: 'rgba(255,255,255,0.08)',
  tint: 'rgba(255,255,255,0.04)',
  blurIntensity: 40,
  blurTint: 'dark',
  auraOuterAlpha: '1A',               // ~10%
  auraInnerAlpha: '33',               // ~20%
};

const LIGHT_PALETTE: CardPalette = {
  bg: 'rgba(255,255,255,0.72)',
  border: 'rgba(0,0,0,0.06)',
  tint: 'rgba(255,255,255,0.35)',
  blurIntensity: 50,
  blurTint: 'light',
  auraOuterAlpha: '33',               // ~20%
  auraInnerAlpha: '4D',               // ~30%
};

export type BentoVariant = 'full' | 'half';

interface BentoConceptCardProps {
  title: string;
  description: string;
  icon: string;
  accentColor?: string;
  variant: BentoVariant;
  onPress: () => void;
}

export default function BentoConceptCard({
  title,
  description,
  icon,
  accentColor,
  variant,
  onPress,
}: BentoConceptCardProps) {
  const { surfaces, isDark } = useTheme();
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const accent = accentColor || '#6C63FF';
  const isFull = variant === 'full';

  // Glass tint sits on TOP of the BlurView. On flat backdrops the blur
  // has little content to sample, so the tint gives the material a
  // predictable base color. Alpha is tuned so the aura glow beneath
  // still reads through the tint.
  const glassTint: ViewStyle = { backgroundColor: palette.tint };

  // Etched-edge border — the thin specular outline iOS glass uses.
  const glassBorder: ViewStyle = {
    borderWidth: 1,
    borderColor: palette.border,
  };

  // iOS-only shadow on the inner aura halo pushes the colored glow
  // outward past the halo's borderRadius, giving the bleed real depth.
  // Android can't render colored view shadows reliably, so we skip.
  const innerAuraShadow: ViewStyle =
    Platform.OS === 'ios'
      ? {
          shadowColor: accent,
          shadowOpacity: 0.5,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }
      : {};

  return (
    <PressableSurface
      role="elevated"
      onPress={onPress}
      hapticType="selection"
      padded
      radius="xl"
      style={[
        isFull ? styles.fullCard : styles.halfCard,
        // Adaptive surface — dark uses a solid elevated color, light
        // uses a translucent white so the BlurView has a real light
        // canvas to frost instead of rendering as a blank slab.
        { backgroundColor: palette.bg },
        glassBorder,
        // Clip the aura + tint to the rounded card edges. iOS renders
        // the role="elevated" shadow OUTSIDE the bounds, so
        // overflow:hidden doesn't eat it.
        { overflow: 'hidden' },
      ]}
    >
      {/* Frosted glass — bottom of the stack. `borderRadius` is set
          directly here (in addition to the parent's `overflow:hidden`)
          because iOS doesn't always clip native BlurView to the
          parent's rounded-rect mask, leaving full-width cards looking
          subtly squarer than the smaller half-tiles. Matching the
          parent's `radius="xl"` keeps all four corners identically
          round across variants. Intensity/tint come from the palette
          so the material adapts to the environment like a native iOS
          material (light frost in light mode, dark frost in dark). */}
      <BlurView
        intensity={palette.blurIntensity}
        tint={palette.blurTint}
        style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.xl }]}
      />

      {/* Solid tint on top of the blur — gives the glass its base
          color and keeps the material readable on flat backdrops.
          Same borderRadius rationale as the BlurView above. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          glassTint,
          { borderRadius: borderRadius.xl },
        ]}
        pointerEvents="none"
      />

      {/* Aura — two soft halos stacked behind the icon. Positioned
          at the card's top-left so the icon (also at top-left under
          `padded`) sits at their center. Negative offsets let the
          halos bleed past the card edge — overflow:hidden clips
          them to the rounded corners, producing the "emitting into
          the glass" look. */}
      <View
        pointerEvents="none"
        style={[
          styles.auraOuter,
          { backgroundColor: accent + palette.auraOuterAlpha },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.auraInner,
          { backgroundColor: accent + palette.auraInnerAlpha },
          innerAuraShadow,
        ]}
      />

      {/* Foreground content. */}
      {isFull ? (
        <View style={styles.fullRow}>
          <View
            style={[styles.iconHalo, { backgroundColor: accent + '1F' }]}
          >
            <Ionicons name={icon as any} size={22} color={accent} />
          </View>
          <View style={styles.fullContent}>
            <Text
              style={[styles.title, { color: surfaces.text.primary }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {/* Subtitle/chevron use `text.secondary` (not tertiary) —
                tertiary on the dark card bg fails WCAG AA (~2.98:1);
                secondary clears it (dark ~5.9:1, light ~4.04:1). */}
            <Text
              style={[styles.prompt, { color: surfaces.text.secondary }]}
              numberOfLines={2}
            >
              {description}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={surfaces.text.secondary}
            style={styles.chevron}
          />
        </View>
      ) : (
        <View style={styles.halfContent}>
          <View
            style={[styles.iconHalo, { backgroundColor: accent + '1F' }]}
          >
            <Ionicons name={icon as any} size={22} color={accent} />
          </View>
          <Text
            style={[styles.halfTitle, { color: surfaces.text.primary }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  // ── Card containers ────────────────────────────────────────────
  fullCard: {
    // Extra vertical breathing room on the feature tiles — the icon
    // + title + prompt trio felt cramped at the default 24px all-
    // around. Horizontal padding stays at 24 via `padded`; we only
    // override top/bottom to avoid RN's `padding` / `paddingVertical`
    // cascade quirks. Half tiles are square-and-compact by design
    // and intentionally skip this override.
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  halfCard: {
    // Fill the parent half-cell horizontally, then `aspectRatio: 1`
    // squares the tile's height to match its width.
    flex: 1,
    aspectRatio: 1,
  },

  // ── Aura halos ─────────────────────────────────────────────────
  // Outer: wide, low alpha — the soft colored bleed.
  auraOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    left: -55,
    top: -55,
  },
  // Inner: tighter, denser — anchors the "source" of the light.
  // Centered roughly on the icon halo (which sits ~47px from the
  // top-left corner under 24px card padding).
  auraInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    left: -20,
    top: -20,
  },

  // ── Icon halo ──────────────────────────────────────────────────
  iconHalo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Full-variant layout ────────────────────────────────────────
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  chevron: {
    opacity: 0.5,
    marginLeft: spacing.sm,
  },

  // ── Half-variant layout ────────────────────────────────────────
  halfContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  halfTitle: {
    ...typography.h3,
  },

  // ── Typography ─────────────────────────────────────────────────
  title: {
    ...typography.h3,
  },
  prompt: {
    ...typography.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
