/**
 * Surface — The core container primitive for ReflectXR.
 *
 * Replaces the need to manually pick background color, border, and shadow
 * for every container. Just specify a role and the Surface resolves the
 * correct visual treatment for the current theme mode (dark or light).
 *
 * Usage:
 *   <Surface role="elevated" radius="xl" padded>
 *     <Text>Content on an elevated card</Text>
 *   </Surface>
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { borderRadius as radiusTokens } from '../../theme';
import type { SurfaceRole } from '../../theme/tokens';

interface SurfaceProps {
  /** Visual role determines background, border, and shadow automatically */
  role: SurfaceRole;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Apply standard padding (24px) */
  padded?: boolean;
  /** Border radius token key. Default: 'xl' (20px) */
  radius?: keyof typeof radiusTokens;
}

export default function Surface({
  role,
  children,
  style,
  padded = false,
  radius = 'xl',
}: SurfaceProps) {
  const { surfaces } = useTheme();
  const resolved = surfaces.resolve(role);

  return (
    <View
      style={[
        {
          backgroundColor: resolved.backgroundColor,
          borderRadius: radiusTokens[radius],
          // Edge treatment
          ...(resolved.borderWidth !== undefined && {
            borderWidth: resolved.borderWidth,
            borderColor: resolved.borderColor,
          }),
          // Shadow (only elevated + raised roles have these)
          ...(resolved.shadowColor !== undefined && {
            shadowColor: resolved.shadowColor,
            shadowOffset: resolved.shadowOffset,
            shadowOpacity: resolved.shadowOpacity,
            shadowRadius: resolved.shadowRadius,
            elevation: resolved.elevation,
          }),
        },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: 24,
  },
});
