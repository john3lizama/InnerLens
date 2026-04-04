import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type AppColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadow } from '../theme/spacing';

interface ThemeContextType {
  colors: AppColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadow: typeof shadow;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
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
