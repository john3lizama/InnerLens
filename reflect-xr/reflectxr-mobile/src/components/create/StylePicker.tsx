import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { typography, spacing, borderRadius, shadow } from '../../theme';
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
  const { colors } = useTheme();
  const pickerStyles = makeStyles(colors);

  return (
    <View>
      {categories.map((cat) => {
        const catStyles = styles_list.filter((s) => s.category === cat.key);
        if (catStyles.length === 0) return null;
        return (
          <View key={cat.key} style={pickerStyles.section}>
            <Text style={pickerStyles.sectionLabel}>{cat.label}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pickerStyles.chipRow}
            >
              {catStyles.map((style) => {
                const isSelected = selectedId === style.id;
                if (isSelected) {
                  return (
                    <Pressable
                      key={style.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onSelect(style.id, style.name);
                      }}
                    >
                      <LinearGradient
                        colors={[...colors.gradient.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[pickerStyles.chip, shadow.glowSubtle]}
                      >
                        <Text style={[pickerStyles.chipText, pickerStyles.chipTextSelected]}>
                          {style.name}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={style.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(style.id, style.name);
                    }}
                  >
                    <View style={[pickerStyles.chip, pickerStyles.chipUnselected]}>
                      <Text style={pickerStyles.chipText}>{style.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipUnselected: {
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  chipText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
});
