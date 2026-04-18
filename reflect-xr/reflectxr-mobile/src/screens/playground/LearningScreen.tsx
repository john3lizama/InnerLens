/**
 * LearningScreen — TBD stub for the upcoming "Learning" experience.
 *
 * Pattern-identical to ReflectionEnvironmentScreen (the Siri coming-soon
 * surface): back button, SF Symbol in a bubble, "COMING SOON" chip,
 * title, body copy, sign-off. Kept intentionally parallel so the two
 * stubs feel like a cohesive family while the real features are still
 * being designed.
 *
 * The iconography uses `hand.draw.fill` — a hand holding a pencil —
 * which reads as "learn by doing" / "hands-on practice," matching the
 * intent for the Learning flow (guided exercises, not passive content).
 * SF Symbols are iOS-only; on Android we fall back to an Ionicon that
 * carries the same affordance.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function LearningScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={surfaces.text.primary} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.iconBubble}>
            {/* `hand.draw.fill` is SF Symbols 3+ (iOS 15+). Android has
                no SF Symbols, so fall back to an Ionicon that reads as
                the same "hands-on / create" gesture. */}
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="hand.draw.fill"
                size={40}
                type="monochrome"
                tintColor="#A89BFF"
              />
            ) : (
              <Ionicons name="create-outline" size={40} color="#A89BFF" />
            )}
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>COMING SOON</Text>
          </View>

          <Text style={styles.title}>Learning</Text>

          <Text style={styles.body__text}>
            A hands-on way to learn the craft of reflection, short lessons,
            guided practices you can return to, and prompts that grow with you.
          </Text>
          <Text style={styles.body__text}>
            Build the habit. Notice the patterns. Turn insight into practice.
          </Text>
          <Text style={[styles.body__text, styles.signoff]}>
            On its way. Stay tuned.
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    backButton: {
      paddingVertical: spacing.sm,
      alignSelf: 'flex-start',
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    iconBubble: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(108, 99, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    chip: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(108, 99, 255, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(108, 99, 255, 0.4)',
      marginBottom: spacing.lg,
    },
    chipText: {
      ...typography.caption,
      color: '#A89BFF',
      letterSpacing: 1.4,
      fontWeight: '700',
    },
    title: {
      ...typography.h1,
      color: surfaces.text.primary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    body__text: {
      ...typography.body,
      color: surfaces.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      lineHeight: 24,
    },
    signoff: {
      color: surfaces.text.tertiary,
      marginTop: spacing.lg,
    },
  });
