/**
 * surfaces.ts — Surface resolver for ReflectXR
 *
 * Resolves token values to concrete styles based on the current theme mode.
 * Used by the Surface primitive and by ThemeContext to provide resolved values.
 */

import { ViewStyle } from 'react-native';
import {
  surfaceColors,
  edges,
  shadows,
  textColors,
  heroGradient,
  ambientGradient,
  overlays,
  orbGlow,
  emotionTagOpacity,
  tabBar,
  type SurfaceRole,
  type EdgeRole,
} from './tokens';

type Mode = 'dark' | 'light';

// ═══════════════════════════════════════════════════════════════════
// RESOLVED SURFACE STYLES — complete ViewStyle for a surface role
// ═══════════════════════════════════════════════════════════════════

export interface ResolvedSurface {
  backgroundColor: string;
  borderWidth?: number;
  borderColor?: string;
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}

/**
 * Get the complete resolved style for a surface role in the given mode.
 * Combines background color + edge treatment + shadow into one ViewStyle.
 */
export function resolveSurface(role: SurfaceRole, mode: Mode): ResolvedSurface {
  const bg = surfaceColors[role][mode];
  const result: ResolvedSurface = { backgroundColor: bg };

  // Add edge treatment
  if (role === 'elevated' || role === 'raised' || role === 'input') {
    const edge = edges[role][mode];
    result.borderWidth = edge.borderWidth;
    result.borderColor = edge.borderColor;
  }

  // Add shadow (only elevated and raised get shadows)
  if (role === 'elevated') {
    const s = shadows.elevated[mode];
    Object.assign(result, s);
  } else if (role === 'raised') {
    const s = shadows.raised[mode];
    Object.assign(result, s);
  }

  return result;
}

/**
 * Get edge style for a specific edge role (used for dynamic states like focus).
 */
export function resolveEdge(role: Exclude<EdgeRole, 'none'>, mode: Mode) {
  return edges[role][mode];
}

// ═══════════════════════════════════════════════════════════════════
// RESOLVED THEME — all mode-resolved values in one object
// ═══════════════════════════════════════════════════════════════════

export interface ResolvedSurfaceTheme {
  /** Get resolved style for any surface role */
  resolve: (role: SurfaceRole) => ResolvedSurface;
  /** Get edge style for dynamic states */
  edge: (role: Exclude<EdgeRole, 'none'>) => { borderWidth: number; borderColor: string };
  /** Raw surface background colors (for when you need just the color) */
  colors: Record<SurfaceRole, string>;
  /** Resolved text colors */
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  /** Resolved gradient arrays (typed as tuples for LinearGradient compatibility) */
  gradient: {
    hero: readonly [string, string, ...string[]];
    ambient: readonly [string, string, ...string[]];
  };
  /** Resolved overlay colors */
  overlay: {
    backdrop: string;
    crisisBackdrop: string;
    primaryTint: string;
    selectedTint: string;
  };
  /** Resolved orb glow values */
  orb: { ringOpacity: number; ringColor: string };
  /** Resolved emotion tag opacity thresholds */
  emotionOpacity: { base: number; intense: number };
  /** Resolved tab bar values */
  tabBar: { background: string; border: string };
}

/**
 * Create a fully resolved surface theme for the given mode.
 * Called once per mode change by ThemeContext.
 */
export function createSurfaceTheme(mode: Mode): ResolvedSurfaceTheme {
  return {
    resolve: (role: SurfaceRole) => resolveSurface(role, mode),
    edge: (role: Exclude<EdgeRole, 'none'>) => resolveEdge(role, mode),
    colors: {
      canvas: surfaceColors.canvas[mode],
      sunken: surfaceColors.sunken[mode],
      ground: surfaceColors.ground[mode],
      elevated: surfaceColors.elevated[mode],
      raised: surfaceColors.raised[mode],
      input: surfaceColors.input[mode],
      critical: surfaceColors.critical[mode],
    },
    text: {
      primary: textColors.primary[mode],
      secondary: textColors.secondary[mode],
      tertiary: textColors.tertiary[mode],
      inverse: textColors.inverse[mode],
    },
    gradient: {
      hero: heroGradient[mode],
      ambient: ambientGradient[mode],
    },
    overlay: {
      backdrop: overlays.backdrop[mode],
      crisisBackdrop: overlays.crisisBackdrop[mode],
      primaryTint: overlays.primaryTint[mode],
      selectedTint: overlays.selectedTint[mode],
    },
    orb: orbGlow[mode],
    emotionOpacity: emotionTagOpacity[mode],
    tabBar: tabBar[mode],
  };
}
