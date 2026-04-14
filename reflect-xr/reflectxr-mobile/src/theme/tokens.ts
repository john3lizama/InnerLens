/**
 * tokens.ts — ReflectXR Design Tokens
 *
 * Single source of truth for the visual system. Every value is defined
 * for both dark and light modes simultaneously — no mode is an afterthought.
 *
 * Components consume these via useTheme() → surfaces, or import motion directly.
 */

// ═══════════════════════════════════════════════════════════════════
// SURFACE ROLES
// Dark mode: depth via luminance steps + faint top-edge highlights
// Light mode: depth via real shadows + subtle borders
// ═══════════════════════════════════════════════════════════════════

export type SurfaceRole =
  | 'canvas'
  | 'sunken'
  | 'ground'
  | 'elevated'
  | 'raised'
  | 'input'
  | 'critical';

export const surfaceColors: Record<SurfaceRole, { dark: string; light: string }> = {
  canvas:   { dark: '#0E0E14', light: '#F7F6F3' },
  sunken:   { dark: '#0A0A10', light: '#EEEDEA' },
  ground:   { dark: '#161620', light: '#FFFFFF' },
  elevated: { dark: '#1E1E28', light: '#FFFFFF' },
  raised:   { dark: '#262632', light: '#FFFFFF' },
  input:    { dark: '#12121A', light: '#F2F1EE' },
  critical: { dark: '#1C1418', light: '#FFF5F3' },
};

// ═══════════════════════════════════════════════════════════════════
// EDGE TREATMENTS — per surface role, per mode
// ═══════════════════════════════════════════════════════════════════

export type EdgeRole = 'none' | 'elevated' | 'raised' | 'input' | 'inputFocus' | 'selected';

interface EdgeStyle {
  borderWidth: number;
  borderColor: string;
}

export const edges: Record<Exclude<EdgeRole, 'none'>, { dark: EdgeStyle; light: EdgeStyle }> = {
  elevated: {
    dark:  { borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
    light: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  },
  raised: {
    dark:  { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    light: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  },
  input: {
    dark:  { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    light: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  },
  inputFocus: {
    dark:  { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.30)' },
    light: { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.40)' },
  },
  selected: {
    dark:  { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.40)' },
    light: { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.50)' },
  },
};

// ═══════════════════════════════════════════════════════════════════
// SHADOWS — different strategy per mode
// Dark: subtle, edge-light driven. Light: real shadows for hierarchy.
// ═══════════════════════════════════════════════════════════════════

interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const shadows: Record<'elevated' | 'raised', { dark: ShadowStyle; light: ShadowStyle }> = {
  elevated: {
    dark: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 2,
    },
    light: {
      shadowColor: '#2D2B3D',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
  },
  raised: {
    dark: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 4,
    },
    light: {
      shadowColor: '#2D2B3D',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 4,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// TEXT COLORS — per mode
// ═══════════════════════════════════════════════════════════════════

export const textColors = {
  primary:   { dark: '#F0EFF4', light: '#2D2B3D' },
  secondary: { dark: '#9A98A6', light: '#7A7888' },
  tertiary:  { dark: '#6A6878', light: '#A8A6B4' },
  inverse:   { dark: '#0E0E14', light: '#FFFFFF' },
} as const;

// ═══════════════════════════════════════════════════════════════════
// HERO GRADIENTS — per mode
// Dark: deep indigo → midnight. Light: warm lavender → linen.
// ═══════════════════════════════════════════════════════════════════

export const heroGradient = {
  dark:  ['#1A1830', '#0E0E14'] as const,
  light: ['#F0EDF8', '#F7F6F3'] as const,
} as const;

export const ambientGradient = {
  dark:  ['#0B0B12', '#0E0E14', '#0E0E14'] as const,
  light: ['#F5F3FF', '#F7F6F3', '#F7F6F3'] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════
// OVERLAYS — per mode
// ═══════════════════════════════════════════════════════════════════

export const overlays = {
  backdrop: {
    dark:  'rgba(0,0,0,0.5)',
    light: 'rgba(0,0,0,0.3)',
  },
  crisisBackdrop: {
    dark:  'rgba(0,0,0,0.7)',
    light: 'rgba(0,0,0,0.5)',
  },
  primaryTint: {
    dark:  'rgba(108,99,255,0.18)',
    light: 'rgba(108,99,255,0.12)',
  },
  selectedTint: {
    dark:  'rgba(108,99,255,0.08)',
    light: 'rgba(108,99,255,0.06)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// GENERATION ORB — per mode
// ═══════════════════════════════════════════════════════════════════

export const orbGlow = {
  dark:  { ringOpacity: 0.18, ringColor: 'rgba(108,99,255,0.18)' },
  light: { ringOpacity: 0.12, ringColor: 'rgba(108,99,255,0.12)' },
} as const;

// ═══════════════════════════════════════════════════════════════════
// EMOTION TAG OPACITY — light needs stronger tints for legibility
// ═══════════════════════════════════════════════════════════════════

export const emotionTagOpacity = {
  dark:  { base: 0.15, intense: 0.25 },
  light: { base: 0.20, intense: 0.30 },
} as const;

// ═══════════════════════════════════════════════════════════════════
// TAB BAR — per mode
// ═══════════════════════════════════════════════════════════════════

export const tabBar = {
  dark: {
    background: 'rgba(14,14,20,0.92)',
    border: 'rgba(255,255,255,0.08)',
  },
  light: {
    background: 'rgba(247,246,243,0.92)',
    border: 'rgba(0,0,0,0.06)',
  },
} as const;
