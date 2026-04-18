const shared = {
  primary: '#6C63FF',
  primaryLight: '#8B7EC8',
  primaryDark: '#5A52D5',
  secondary: '#7FB69E',
  secondaryLight: '#A8D8C8',
  accent: '#E8837C',
  accentLight: '#F2ADA8',

  success: '#7FB69E',
  warning: '#F5D76E',
  error: '#E8837C',
  info: '#7BA7CC',

  gradient: {
    primary: ['#8B7EC8', '#6C63FF'] as const,
    warm: ['#F2ADA8', '#E8837C'] as const,
    calm: ['#A8D8C8', '#7FB69E'] as const,
  },

  emotion: {
    joy: '#F5D76E',
    sadness: '#7BA7CC',
    anger: '#D4A0A0',
    fear: '#C4A8D4',
    calm: '#A8D8C8',
    anxiety: '#D4A0A0',
    hope: '#A8D8C8',
    overwhelm: '#C4B8D8',
    stress: '#D4B8A0',
    love: '#E8B8C8',
    strength: '#B8C8D8',
    gratitude: '#C8D8A8',
    loneliness: '#B8B8D4',
    grief: '#A0A8C4',
    courage: '#D8C8A0',
    clarity: '#A8C8D8',
    renewal: '#B8D8B8',
    resilience: '#C8B8A8',
  } as Record<string, string>,

  // Mood-graph legend buckets (3: valence-only). Same hex in light and
  // dark. Each bucket borrows from one of the app's concept-card auras
  // so the graph reads like the rest of the app rather than a generic
  // traffic-light palette:
  //
  //   positive → "A Safe Space" aura — soft, luminous mint-teal.
  //              Same hex as `secondaryLight` / `emotion.calm` /
  //              `emotion.hope`. Growth + safety without the clinical
  //              feel of a standard "success" green.
  //   neutral  → "Emotional Waves" aura — light-saturated brand
  //              indigo-lavender (derived from `primary`/`primaryLight`;
  //              HSL ~256° / 62% / 78%). Balanced, reflective baseline.
  //   negative → "The Weight I Carry" aura — muted, earthy plum-rose.
  //              Crafted (no direct palette twin) to acknowledge a
  //              heavy mood with empathy and warmth, not an "error
  //              red." Warmer than `emotion.anger` (dusty rose) with a
  //              slight shift toward plum so it stays visually distinct
  //              from the neutral lavender.
  //
  // All three pass AA against `#2D2B3D` body text
  // (8.73 / 5.96 / 6.24 : 1 for positive / negative / neutral), so a
  // single dark label color works on every chip without per-bucket
  // inversion.
  mood: {
    positive: '#A8D8C8', // soft, luminous mint-teal ("A Safe Space")
    negative: '#C8A0AE', // muted, earthy plum-rose ("The Weight I Carry")
    neutral:  '#B7A4EA', // indigo-lavender ("Emotional Waves")
  },

  // Vertical gradient stops for the mood-graph bars. Each band inside a
  // stacked pill fills with `[top, bottom]` — lighter at top, darker at
  // bottom, roughly ±18% luminance around the solid `mood[bucket]` hex.
  //
  // Why: three flat pastels stacked together read as a single mass at a
  // glance. A per-band gradient adds depth AND sharpens the boundary
  // between adjacent bands, because the upper band's darkest row lands
  // directly against the lower band's lightest row — so every hue
  // transition is reinforced by a luminance transition, with no hairline
  // gap to bleed the card bg through. The legend chips stay solid:
  // gradients on small chips with dark labels create uneven contrast.
  //
  // Applied by MoodGraphCard via `colors.moodGradient[bucket]`; the flat
  // `mood[bucket]` value is still used for the legend chips, the empty
  // track opacity fill, and anywhere a single "bucket color" is needed.
  moodGradient: {
    positive: ['#B8DFD2', '#8AB1A4'] as const, // light mint → deeper mint
    negative: ['#D2B1BD', '#A4838F'] as const, // light plum-rose → deeper plum-rose
    neutral:  ['#C4B4EE', '#9686C0'] as const, // light lavender → deeper lavender
  },
};

export const lightColors = {
  ...shared,
  background: '#FAFAF8',
  surface: '#F5F3F0',
  card: '#FFFFFF',
  border: '#E8E6E3',
  borderLight: '#F0EEEB',
  cardBorder: 'rgba(0, 0, 0, 0.04)',

  text: '#2D2B3D',
  textSecondary: '#8E8C9A',
  textTertiary: '#B5B3BF',
  textInverse: '#FFFFFF',

  tabBar: 'rgba(255, 255, 255, 0.92)',
  tabBarBorder: 'rgba(0, 0, 0, 0.06)',

  gradient: {
    ...shared.gradient,
    hero: ['#E8E4F8', '#FAFAF8'] as const,
    card: ['#FFFFFF', '#F9F8FF'] as const,
    ambient: ['#F0EEFF', '#FAFAF8', '#FAFAF8'] as const,
    cardInner: ['rgba(255,255,255,0.9)', 'rgba(249,248,255,0.3)'] as const,
    radialGlow: ['rgba(108,99,255,0.08)', 'rgba(108,99,255,0.0)'] as const,
  },

  overlay: {
    light: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(45, 43, 61, 0.5)',
    primary: 'rgba(108, 99, 255, 0.12)',
  },
} as const;

export const darkColors = {
  ...shared,
  background: '#121218',
  surface: '#1C1C24',
  card: '#24242E',
  border: '#2E2E3A',
  borderLight: '#1E1E28',
  cardBorder: 'rgba(255, 255, 255, 0.06)',

  text: '#F0EFF4',
  textSecondary: '#9A98A6',
  textTertiary: '#6A6878',
  textInverse: '#121218',

  tabBar: 'rgba(18, 18, 24, 0.92)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',

  gradient: {
    ...shared.gradient,
    hero: ['#1E1A2E', '#121218'] as const,
    card: ['#24242E', '#1E1E28'] as const,
    ambient: ['#0B0B12', '#12121A', '#12121A'] as const,
    cardInner: ['rgba(36,36,46,0.8)', 'rgba(30,30,40,0.3)'] as const,
    radialGlow: ['rgba(108,99,255,0.12)', 'rgba(108,99,255,0.0)'] as const,
  },

  overlay: {
    light: 'rgba(30, 30, 40, 0.85)',
    dark: 'rgba(0, 0, 0, 0.6)',
    primary: 'rgba(108, 99, 255, 0.18)',
  },
} as const;

// Default export for backward compatibility — components that import `colors`
// directly will get light colors. Use `useTheme()` for dynamic theme.
export const colors = lightColors;

export type AppColors = typeof lightColors | typeof darkColors;
export type EmotionName = keyof typeof shared.emotion;
