/**
 * AlexaSetupScreen — Onboarding for the MindMate × Alexa Beta integration.
 *
 * Walks the user through enabling the MindMate skill in their Alexa app,
 * then links into the existing AlexaScreen (gallery of past voice sessions).
 *
 * Wake phrase: "Alexa, talk to MindMate"
 *
 * Flow:
 *   PlaygroundHub → AlexaSetup → (button) → AlexaGallery
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Surface from '../../components/ui/Surface';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Deep link to the Alexa app on iOS / Android. Falls back to App Store / Play
// Store if the app isn't installed.
const ALEXA_APP_DEEP_LINK = 'alexa://';
const ALEXA_APP_FALLBACK_URL =
  'https://www.amazon.com/Amazon-Alexa/dp/B00P03D4D2'; // Amazon Alexa app page

const STEPS = [
  {
    title: 'Open the Alexa app',
    body: 'On your phone, launch the Amazon Alexa app.',
  },
  {
    title: 'Find the MindMate skill',
    body: 'Tap More → Skills & Games → Search, then look up “MindMate”.',
  },
  {
    title: 'Enable it',
    body: 'Tap Enable to add MindMate to your Alexa account.',
  },
  {
    title: 'Just say the word',
    body: 'Say “Alexa, talk to MindMate” on any Echo device or in the Alexa app.',
  },
];

export default function AlexaSetupScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  const openAlexaApp = async () => {
    Haptics.selectionAsync();
    // Strategy: try the custom scheme first (opens the installed Alexa app
    // instantly when available). If that throws — either because the scheme
    // isn't whitelisted in LSApplicationQueriesSchemes yet or the app isn't
    // installed — silently fall back to the App Store / Amazon listing.
    // We avoid `Linking.canOpenURL` because iOS rejects it for any scheme
    // not in the Info.plist allowlist, which would defeat the purpose on
    // builds where the allowlist entry hasn't shipped yet.
    try {
      await Linking.openURL(ALEXA_APP_DEEP_LINK);
      return;
    } catch {
      // fall through to the web fallback
    }
    try {
      await Linking.openURL(ALEXA_APP_FALLBACK_URL);
    } catch (err) {
      console.error('Failed to open Alexa fallback URL:', err);
      Alert.alert(
        'Cannot open Alexa',
        'Please open the Amazon Alexa app manually from your home screen.',
      );
    }
  };

  const openGallery = () => {
    Haptics.selectionAsync();
    navigation.navigate('AlexaGallery');
  };

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={surfaces.text.primary} />
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Connect Alexa</Text>
          <View style={styles.betaChip}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Speak your feelings aloud. MindMate is now on Alexa, so you can
          reflect, release, and feel supported — just by talking.
        </Text>

        {/* ── Wake-phrase callout ─────────────────────────────────────── */}
        <Surface role="ground" radius="lg" style={styles.wakePhrase}>
          <Ionicons name="mic" size={20} color="#A89BFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.wakePhraseLabel}>Wake phrase</Text>
            <Text style={styles.wakePhraseText}>“Alexa, talk to MindMate”</Text>
          </View>
        </Surface>

        {/* ── Steps ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>How to set up</Text>
        <View style={styles.stepsContainer}>
          {STEPS.map((step, i) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <Pressable
          onPress={openAlexaApp}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open the Alexa app"
        >
          <Text style={styles.primaryButtonText}>Open Alexa app</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={openGallery}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View my voice gallery"
        >
          <Ionicons
            name="images-outline"
            size={18}
            color={surfaces.text.secondary}
          />
          <Text style={styles.secondaryButtonText}>View my voice gallery</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 120,
    },
    backButton: {
      paddingVertical: spacing.sm,
      alignSelf: 'flex-start',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    title: {
      ...typography.h2,
      color: surfaces.text.primary,
    },
    betaChip: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(108, 99, 255, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(108, 99, 255, 0.4)',
    },
    betaText: {
      ...typography.caption,
      color: '#A89BFF',
      letterSpacing: 1,
      fontWeight: '700',
    },
    subtitle: {
      ...typography.body,
      color: surfaces.text.secondary,
      marginTop: spacing.sm,
    },
    wakePhrase: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginTop: spacing.xl,
    },
    wakePhraseLabel: {
      ...typography.caption,
      color: surfaces.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    wakePhraseText: {
      ...typography.h3,
      color: surfaces.text.primary,
      marginTop: 2,
    },
    sectionHeader: {
      ...typography.caption,
      color: surfaces.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    stepsContainer: {
      gap: spacing.lg,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(108, 99, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    stepNumberText: {
      ...typography.caption,
      color: '#A89BFF',
      fontWeight: '700',
    },
    stepTitle: {
      ...typography.body,
      color: surfaces.text.primary,
      fontWeight: '600',
    },
    stepBody: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
      marginTop: 2,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: '#6C63FF',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.xxl,
    },
    primaryButtonText: {
      ...typography.button,
      color: '#fff',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    secondaryButtonText: {
      ...typography.button,
      color: surfaces.text.secondary,
    },
  });
