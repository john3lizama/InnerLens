/**
 * StylePicker — Redesigned with Chip primitive.
 *
 * Changes:
 * - Uses Chip component instead of custom StyleChip
 * - Removed gradient selected state and glow shadow
 * - Selected state now uses primary border + subtle tint (via Chip)
 * - Cleaner, more restrained visual treatment
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import Chip from '../ui/Chip';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface StyleOption {
  id: string;
  name: string;
  category: string;
}

interface StylePickerProps {
  styles_list: StyleOption[];
  categories: ReadonlyArray<{ key: string; label: string }>;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
}

export default function StylePicker({
  styles_list,
  categories,
  selectedId,
  onSelect,
}: StylePickerProps) {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  return (
    <View>
      {categories.map((cat) => {
        const catStyles = styles_list.filter((s) => s.category === cat.key);
        if (catStyles.length === 0) return null;
        return (
          <View key={cat.key} style={styles.section}>
            <Text style={styles.sectionLabel}>{cat.label}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {catStyles.map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  selected={selectedId === item.id}
                  onPress={() => onSelect(item.id, item.name)}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
});
