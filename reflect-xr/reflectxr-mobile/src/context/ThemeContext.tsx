import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type AppColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadow } from '../theme/spacing';
import { createSurfaceTheme, type ResolvedSurfaceTheme } from '../theme/surfaces';

interface ThemeContextType {
  /** Legacy color object — backward compatible with all existing screens */
  colors: AppColors;
  /** NEW: Role-based surface system with resolved values per mode */
  surfaces: ResolvedSurfaceTheme;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  /** @deprecated Use surfaces.resolve() for new components */
  shadow: typeof shadow;
  isDark: boolean;
}

const defaultSurfaces = createSurfaceTheme('light');

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  surfaces: defaultSurfaces,
  typography,
  spacing,
  borderRadius,
  shadow,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = useMemo<ThemeContextType>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      surfaces: createSurfaceTheme(isDark ? 'dark' : 'light'),
      typography,
      spacing,
      borderRadius,
      shadow,
      isDark,
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
