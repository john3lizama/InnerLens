export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  full: 9999,
} as const;

// Unified elevation system
export const elevation = {
  level1: {
    shadowColor: '#2D2B3D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 2,
  },
  level2: {
    shadowColor: '#2D2B3D',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
} as const;

// Glow system (restricted: CTA + loading orb only)
export const glow = {
  strong: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

// Backward-compatible aliases
export const shadow = {
  sm: elevation.level1,
  md: elevation.level1,
  lg: elevation.level2,
  glow: glow.strong,
  glowSubtle: glow.subtle,
} as const;
