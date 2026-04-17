/**
 * HomeScreen — Redesigned as editorial entry point.
 *
 * Three zones instead of 7+ stacked modules:
 * 1. Greeting + Hero CTA (dominant, invites creation)
 * 2. Continuation (most recent reflection OR today's concept)
 * 3. Discovery (MindMate teaser + concept preview)
 *
 * Removed: Alexa card (moved to Profile), "How It Works" steps,
 * "Most Popular" badge, glow pulse animation, horizontal journal scroll.
 */

import React, { useState, useCallback } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import PressableSurface from '../../components/ui/PressableSurface';
import Surface from '../../components/ui/Surface';
import StreakBadge from '../../components/profile/StreakBadge';
import StreakModal from '../../components/profile/StreakModal';
import MoodGraphCard from '../../components/home/MoodGraphCard';
import { typography, spacing, borderRadius } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import * as journalService from '../../services/journalService';
import type { StreakData } from '../../services/journalService';

// ── Two-column geometry (matches ImageGrid.tsx) ───────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const ROW_GAP = 12;
const AVAILABLE = SCREEN_WIDTH - spacing.lg * 2 - ROW_GAP;
// Asymmetric split: hero tile gets more room so the headline breathes.
const HERO_WIDTH = AVAILABLE * 0.54;
const CONT_WIDTH = AVAILABLE * 0.46;

export default function HomeScreen() {
  const { surfaces, colors, isDark } = useTheme();
  const styles = makeStyles(surfaces, colors);
  const navigation = useNavigation() as any;
  const { user } = useAuth();
  const { concepts } = useConcepts();
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakModalVisible, setStreakModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStreak();
    }, [])
  );

  const loadStreak = async () => {
    try {
      const data = await journalService.getStreak();
      setStreakData(data);
    } catch (err) {
      console.error('Failed to load streak:', err);
    }
  };

  const previewConcepts = concepts.slice(0, 3);

  return (
    <SafeAreaWrapper gradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════
            ZONE 1: Greeting + Hero CTA
            ══════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeIn.duration(enterConfig.quiet.duration)}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.name}>{user?.display_name || 'Friend'}</Text>
            </View>
            {streakData && (
              <StreakBadge
                streak={streakData.current_streak}
                isTodayActive={streakData.is_today_active}
                onPress={() => setStreakModalVisible(true)}
              />
            )}
          </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════
            Hero CTA — full-width banner artwork
            The card content (headline, body, CTA button, imagery) lives
            entirely inside reflect.png; the wrapper's only job is to
            handle the tap and clip to rounded corners. Navigates to the
            Reflect & Create flow (unchanged from the previous hero card).
            ══════════════════════════════════════════════════════ */}
        <Animated.View
          entering={FadeInUp.duration(enterConfig.content.duration).delay(60)}
          style={{ marginBottom: spacing.md }}
        >
          <PressableSurface
            role="raised"
            onPress={() => navigation.navigate('Create')}
            hapticType="medium"
            radius="xxxl"
            style={styles.heroBanner}
            accessibilityLabel="Turn what you feel into something you can see. Open Reflect and Create."
          >
            <Image
              source={require('../../assets/images/reflect.png')}
              style={styles.heroBannerImage}
              contentFit="cover"
            />
          </PressableSurface>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════
            MOOD GRAPH — 14-day trend from chats + journals
            Renders locked/example for new users; real data at 3+ entries.
            ══════════════════════════════════════════════════════ */}
        <MoodGraphCard />

        {/* ══════════════════════════════════════════════════════
            ZONE 3: Discovery — quiet, secondary
            ══════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(180)}>
          {/* MindMate teaser */}
          <PressableSurface
            role="ground"
            onPress={() => {
              haptic.selection();
              // Tab was renamed MindMate → Playground; jump straight to the
              // Chat screen inside the Playground stack so the home teaser
              // still opens the chat directly (not the hub).
              navigation.navigate('Playground', { screen: 'Chat' });
            }}
            padded
            radius="xl"
            style={styles.discoveryCard}
          >
            <View style={styles.discoveryRow}>
              <Image
                source={require('../../../assets/mindmate-icon.svg')}
                style={styles.discoveryIcon}
                contentFit="cover"
              />
              <View style={styles.discoveryContent}>
                <Text style={styles.discoveryTitle}>MindMate</Text>
                <Text style={styles.discoverySubtitle}>
                  A conversation that can become art
                </Text>
              </View>
            </View>
          </PressableSurface>

          {/* Concept preview chips */}
          {previewConcepts.length > 0 && (
            <View style={styles.conceptPreview}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.conceptChipRow}
              >
                {previewConcepts.map((concept) => (
                  <Pressable
                    key={concept.id}
                    style={[styles.conceptChip, { borderColor: surfaces.edge('input').borderColor }]}
                    onPress={() => {
                      haptic.selection();
                      navigation.navigate('Create', {
                        screen: 'PromptDesign',
                        params: { concept },
                      });
                    }}
                  >
                    <Ionicons
                      name={(conceptIcons[concept.slug] || 'color-palette-outline') as any}
                      size={16}
                      color={surfaces.text.secondary}
                    />
                    <Text style={styles.conceptChipText}>{concept.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <StreakModal
        visible={streakModalVisible}
        onClose={() => setStreakModalVisible(false)}
        streakData={streakData}
      />
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
  },
  name: {
    ...typography.h2,
    color: surfaces.text.primary,
  },

  // Card row (hero CTA + continuation side-by-side)
  cardRow: {
    flexDirection: 'row',
    gap: ROW_GAP,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },

  // Hero banner — full-width PNG artwork. The art IS the card; the
  // wrapper just handles the tap and clips to rounded corners, so all
  // visual content (headline, body copy, CTA button, imagery) lives
  // in reflect.png rather than in composed RN views.
  heroBanner: {
    overflow: 'hidden',
  },
  heroBannerImage: {
    width: '100%',
    // reflect.png: 1947×653 cropped (drops the dark-navy frame).
    aspectRatio: 1947 / 653,
  },

  // Continuation zone (right column in the card row)
  continuationCard: {
    overflow: 'hidden',
  },
  continuationCardPadded: {
    padding: spacing.md,
  },
  continuationImage: {
    width: '100%',
    height: 110,
  },
  continuationMeta: {
    padding: spacing.sm + 2,
  },
  continuationLabel: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    marginBottom: spacing.xs,
  },
  continuationDate: {
    ...typography.caption,
    fontSize: 10,
    color: surfaces.text.tertiary,
  },
  continuationPreview: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
  },
  conceptRow: {
    flexDirection: 'column',
    marginTop: spacing.sm,
  },
  conceptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.accent}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  conceptContent: {
    flex: 1,
  },
  conceptTitle: {
    ...typography.h3,
    color: surfaces.text.primary,
    marginBottom: 2,
  },
  conceptDesc: {
    ...typography.caption,
    color: surfaces.text.secondary,
  },

  // Discovery zone
  discoveryCard: {
    marginBottom: spacing.md,
  },
  discoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoveryIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  discoveryContent: {
    flex: 1,
  },
  discoveryTitle: {
    ...typography.h3,
    color: surfaces.text.primary,
  },
  discoverySubtitle: {
    ...typography.caption,
    color: surfaces.text.secondary,
    marginTop: 2,
  },

  // Concept chips
  conceptPreview: {
    marginTop: spacing.xs,
  },
  conceptChipRow: {
    gap: spacing.sm,
  },
  conceptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  conceptChipText: {
    ...typography.caption,
    fontWeight: '500',
    color: surfaces.text.secondary,
  },
});
