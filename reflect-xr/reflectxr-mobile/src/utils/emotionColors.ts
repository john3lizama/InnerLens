import { colors as defaultColors, type AppColors } from '../theme/colors';

const DEFAULT_COLOR = '#B8B8D4';

export function getEmotionColor(emotion: string, colors?: AppColors): string {
  const palette = colors ?? defaultColors;
  return palette.emotion[emotion.toLowerCase()] ?? DEFAULT_COLOR;
}

export function getEmotionColorWithOpacity(
  emotion: string,
  intensity: number,
  colors?: AppColors,
): string {
  const hex = getEmotionColor(emotion, colors);
  const alpha = Math.max(0.3, Math.min(1, intensity));
  return hexToRgba(hex, alpha);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
