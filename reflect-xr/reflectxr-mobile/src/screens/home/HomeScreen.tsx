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
import { LinearGradient } from 'expo-linear-gradient';
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
import { formatRelativeDate } from '../../utils/formatDate';
import * as journalService from '../../services/journalService';
import type { StreakData } from '../../services/journalService';

// ── Two-column geometry (matches ImageGrid.tsx) ───────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const ROW_GAP = 12;
const AVAILABLE = SCREEN_WIDTH - spacing.lg * 2 - ROW_GAP;
// Asymmetric split: hero tile gets more room so the headline breathes.
const HERO_WIDTH = AVAILABLE * 0.54;
const CONT_WIDTH = AVAILABLE * 0.46;

interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  created_at: string;
  word_count: number;
}

export default function HomeScreen() {
  const { surfaces, colors, isDark } = useTheme();
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
  // Show the two-card row when a continuation card (reflection or
  // concept) will fill the right column. When neither exists, the hero
  // CTA renders full-width by itself.
  const showRow = hasReflections || !!todaysConcept;

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

        {/* ══════════════════════════════════════════════════════
            Hero CTA — full-width
            ══════════════════════════════════════════════════════ */}
        <Animated.View
          entering={FadeInUp.duration(enterConfig.content.duration).delay(60)}
        >
          <PressableSurface
            role="raised"
            onPress={() => navigation.navigate('Create')}
            hapticType="medium"
            radius="xxxl"
            style={[styles.heroCard, styles.heroSurface,
              { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(108,99,255,0.08)' },
              { backgroundColor: isDark ? '#262040' : '#F4F0FC' },
              { marginBottom: spacing.md }]}
          >
            {/* Gradient background — sculpted: lighter top-left, deeper lower-right */}
            <LinearGradient
              colors={isDark ? ['#262040', '#1C1A32', '#101024'] : ['#F4F0FC', '#EEEAF6', '#FAFAF8']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Faint top-edge rim light */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 20,
                right: 20,
                height: StyleSheet.hairlineWidth,
                backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(108,99,255,0.08)',
              }}
            />
            {/* Ambient sparkle — ghosted, bleeds off the edge */}
            <Ionicons
              name="sparkles"
              size={90}
              color={isDark ? 'rgba(139,126,200,0.15)' : 'rgba(108,99,255,0.12)'}
              style={styles.heroAmbient}
            />
            <Text style={styles.heroTitle}>
              Turn what you feel into something you can see.
            </Text>
            <View style={{ height: spacing.md }} />
            <View style={styles.heroButton}>
              <LinearGradient
                colors={['#736BA8', '#625CB8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.heroButtonText}>Reflect</Text>
              <Ionicons name="arrow-forward" size={10} color="rgba(255,255,255,0.55)" />
            </View>
          </PressableSurface>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════
            Last reflection — horizontal card (same style as MindMate)
            ══════════════════════════════════════════════════════ */}
        {hasReflections && recentJournals[0] && (
          <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(90)}>
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
              padded
              radius="xl"
              style={styles.discoveryCard}
            >
              <View style={styles.discoveryRow}>
                {recentJournals[0].image && (
                  <Image
                    source={{ uri: recentJournals[0].image.thumbnail_url || recentJournals[0].image.image_url }}
                    style={styles.reflectionThumb}
                    contentFit="cover"
                    transition={200}
                  />
                )}
                <View style={styles.discoveryContent}>
                  <Text style={styles.discoveryTitle}>Last reflection</Text>
                  <Text style={styles.discoverySubtitle}>
                    {formatRelativeDate(recentJournals[0].created_at)}
                  </Text>
                </View>
              </View>
            </PressableSurface>
          </Animated.View>
        )}

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

  // Card row (hero CTA + continuation side-by-side)
  cardRow: {
    flexDirection: 'row',
    gap: ROW_GAP,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },

  // Hero CTA — premium surface with gradient background
  heroCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'column',
  },
  heroSurface: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  heroAmbient: {
    position: 'absolute',
    top: '30%',
    right: -14,
  },
  heroTitle: {
    ...typography.body,
    fontWeight: '600',
    color: surfaces.text.primary,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
  },
  heroButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#FFFFFF',
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
  reflectionThumb: {
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
