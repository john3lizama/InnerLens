import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface DropdownProps {
  label: string;
  options: string[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export default function Dropdown({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select...',
}: DropdownProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [visible, setVisible] = useState(false);
  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);

  const openSheet = useCallback(() => {
    setVisible(true);
    translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
    backdropOpacity.value = withTiming(1, { duration: 200 });
  }, [translateY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    translateY.value = withSpring(300, { damping: 20, stiffness: 90 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => setVisible(false), 300);
  }, [translateY, backdropOpacity]);

  const handleSelect = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(value);
    closeSheet();
  }, [onSelect, closeSheet]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={openSheet} style={styles.trigger}>
          <Text style={[styles.triggerText, !selectedValue && styles.placeholder]}>
            {selectedValue || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Modal visible={visible} transparent animationType="none">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={[
                  styles.option,
                  selectedValue === item && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedValue === item && styles.optionTextSelected,
                  ]}
                >
                  {item}
                </Text>
                {selectedValue === item && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const makeStyles = (colors: any) => StyleSheet.create({
  label: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  triggerText: {
    ...typography.body,
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 43, 61, 0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingBottom: spacing.xxl,
    ...shadow.lg,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.overlay.primary,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
})
