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
import { typography, spacing, borderRadius } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import { formatRelativeDate } from '../../utils/formatDate';
import * as journalService from '../../services/journalService';
import type { StreakData } from '../../services/journalService';

interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  created_at: string;
  word_count: number;
}

export default function HomeScreen() {
  const { surfaces, colors } = useTheme();
  const styles = makeStyles(surfaces, colors);
  const navigation = useNavigation() as any;
  const { user } = useAuth();
  const { concepts } = useConcepts();
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(true);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakModalVisible, setStreakModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadJournals();
      loadStreak();
    }, [])
  );

  const loadJournals = async () => {
    try {
      const res = await journalService.getJournals(1, 0);
      setRecentJournals(res.entries);
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setJournalsLoading(false);
    }
  };

  const loadStreak = async () => {
    try {
      const data = await journalService.getStreak();
      setStreakData(data);
    } catch (err) {
      console.error('Failed to load streak:', err);
    }
  };

  const hasReflections = !journalsLoading && recentJournals.length > 0;
  const todaysConcept = concepts[2] || concepts[0];
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
                onPress={() => setStreakModalVisible(true)}
              />
            )}
          </View>
        </Animated.View>

        {/* Hero CTA — the primary invitation */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(60)}>
          <PressableSurface
            role="elevated"
            onPress={() => navigation.navigate('Create')}
            hapticType="medium"
            radius="xl"
            style={styles.heroCard}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>
                Turn what you're feeling{'\n'}into something you can see.
              </Text>
              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>Create</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="sparkles" size={28} color="rgba(108,99,255,0.4)" />
            </View>
          </PressableSurface>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════
            ZONE 2: Continuation
            One item: recent reflection OR today's concept
            ══════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(120)}>
          {hasReflections && recentJournals[0] ? (
            // Most recent reflection — image-forward
            <PressableSurface
              role="ground"
              onPress={() => {
                haptic.selection();
                navigation.navigate('Journal', {
                  screen: 'JournalDetail',
                  params: { journalId: recentJournals[0].id },
                  initial: false,
                });
              }}
              radius="xl"
              style={styles.continuationCard}
            >
              {recentJournals[0].image && (
                <Image
                  source={{ uri: recentJournals[0].image.image_url }}
                  style={styles.continuationImage}
                  contentFit="cover"
                  transition={200}
                />
              )}
              <View style={styles.continuationMeta}>
                <Text style={styles.continuationLabel}>Your last reflection</Text>
                <Text style={styles.continuationDate}>
                  {formatRelativeDate(recentJournals[0].created_at)}
                </Text>
                <Text style={styles.continuationPreview} numberOfLines={1}>
                  {recentJournals[0].content}
                </Text>
              </View>
            </PressableSurface>
          ) : todaysConcept ? (
            // Today's concept — for new or returning users with no journals
            <PressableSurface
              role="ground"
              onPress={() => {
                haptic.selection();
                navigation.navigate('Create', {
                  screen: 'PromptDesign',
                  params: { concept: todaysConcept },
                });
              }}
              padded
              radius="xl"
              style={styles.continuationCard}
            >
              <Text style={styles.continuationLabel}>A starting point</Text>
              <View style={styles.conceptRow}>
                <View style={styles.conceptIcon}>
                  <Ionicons
                    name={(conceptIcons[todaysConcept.slug] || 'color-palette-outline') as any}
                    size={20}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.conceptContent}>
                  <Text style={styles.conceptTitle}>{todaysConcept.title}</Text>
                  <Text style={styles.conceptDesc} numberOfLines={1}>
                    {todaysConcept.reflection_prompt}
                  </Text>
                </View>
              </View>
            </PressableSurface>
          ) : null}
        </Animated.View>

        {/* ══════════════════════════════════════════════════════
            ZONE 3: Discovery — quiet, secondary
            ══════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(180)}>
          {/* MindMate teaser */}
          <PressableSurface
            role="ground"
            onPress={() => {
              haptic.selection();
              navigation.navigate('MindMate');
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

  // Hero CTA
  heroCard: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    ...typography.h3,
    color: surfaces.text.primary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#6C63FF',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  heroButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: surfaces.overlay.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },

  // Continuation zone
  continuationCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  continuationImage: {
    width: '100%',
    height: 140,
  },
  continuationMeta: {
    padding: spacing.lg,
  },
  continuationLabel: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    marginBottom: spacing.xs,
  },
  continuationDate: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    marginBottom: spacing.xs,
  },
  continuationPreview: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
  },
  conceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  conceptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.accent}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
