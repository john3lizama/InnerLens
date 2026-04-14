/**
 * motion.ts — ReflectXR Motion Token System
 *
 * Centralized motion vocabulary. Every animation in the app should use
 * these tokens instead of hardcoding spring configs per component.
 *
 * These are static values — no context needed, import directly.
 */

import * as Haptics from 'expo-haptics';

// ═══════════════════════════════════════════════════════════════════
// SPRING CONFIGS — role-based motion behaviors
// ═══════════════════════════════════════════════════════════════════

export const spring = {
  /** Press feedback — physical, immediate. Used on all tappable surfaces. */
  press: {
    scale: 0.97,
    damping: 20,
    stiffness: 400,
  },

  /** Selection confirmation — slightly softer, affirming. */
  select: {
    scale: 1.02,
    damping: 18,
    stiffness: 300,
  },

  /** Content entrance — graceful, unhurried. */
  enter: {
    damping: 22,
    stiffness: 180,
    mass: 1,
  },

  /** Sheet/modal presentation — heavy, deliberate. */
  sheet: {
    damping: 28,
    stiffness: 200,
  },

  /** Emotional moment — softer, slower, respectful. */
  gentle: {
    damping: 30,
    stiffness: 120,
  },

  /** Generation bloom — signature, expansive. The only "dramatic" motion. */
  bloom: {
    damping: 16,
    stiffness: 90,
    mass: 1.2,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// FADE DURATIONS — timing-based transitions
// ═══════════════════════════════════════════════════════════════════

export const fade = {
  /** UI state changes (button states, focus indicators) */
  fast: 150,
  /** Content transitions (text swap, section reveal) */
  normal: 250,
  /** Emotional reveals (artwork appearance, reflection prompt) */
  slow: 400,
  /** Artwork revelation — the most respectful pace */
  reverent: 600,
} as const;

// ═══════════════════════════════════════════════════════════════════
// ENTER ANIMATION CONFIGS — for Reanimated entering animations
// Small translateY (8px), not the default 20px+ which feels bouncy
// ═══════════════════════════════════════════════════════════════════

export const enterConfig = {
  /** Standard content entrance — subtle upward slide + fade */
  content: {
    translateY: 8,
    duration: 350,
  },
  /** Hero entrance — scale + fade, no translation */
  hero: {
    scaleFrom: 0.98,
    duration: 400,
  },
  /** Archive/quiet content — fade only */
  quiet: {
    duration: 300,
  },
  /** Stagger delay between list items */
  staggerDelay: 60,
} as const;

// ═══════════════════════════════════════════════════════════════════
// GENERATION ORB — timing for the signature loading moment
// ═══════════════════════════════════════════════════════════════════

export const generation: {
  breathDuration: number;
  breathMin: number;
  breathMax: number;
  glowMin: number;
  glowMax: number;
  textRotateInterval: number;
  textFadeDuration: number;
  dissolve: { scaleTo: number; opacityTo: number; duration: number };
  emerge: { scaleFrom: number; delay: number };
} = {
  /** Breathing cycle for the orb (slower = more meditative) */
  breathDuration: 2800,
  /** Scale range for breathing */
  breathMin: 0.88,
  breathMax: 1.12,
  /** Glow ring pulse */
  glowMin: 0.3,
  glowMax: 0.6,
  /** How often loading text rotates */
  textRotateInterval: 4000,
  /** Text fade duration */
  textFadeDuration: 300,
  /** Orb dissolution when images arrive */
  dissolve: {
    scaleTo: 1.3,
    opacityTo: 0,
    duration: 600,
  },
  /** Image emergence from orb */
  emerge: {
    scaleFrom: 0.95,
    delay: 200,
  },
};

// ═══════════════════════════════════════════════════════════════════
// HAPTIC MAP — what feedback for which interaction
// ═══════════════════════════════════════════════════════════════════

export const haptic = {
  /** Chip/option tap — lightest possible feedback */
  selection: () => Haptics.selectionAsync(),

  /** Image selection, secondary actions */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Primary button tap */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Generate action — the heaviest deliberate feedback */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /** Save/complete confirmation */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Error/failure */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** No haptic — for crisis flows where silence is appropriate */
  none: () => {},
} as const;
