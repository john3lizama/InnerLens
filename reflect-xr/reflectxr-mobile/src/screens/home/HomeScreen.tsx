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
import JournalCard from '../../components/journal/JournalCard';
import { typography, spacing, borderRadius } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useMindMate } from '../../context/MindMateContext';
import { useAuth } from '../../hooks/useAuth';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import * as journalService from '../../services/journalService';
import type { StreakData } from '../../services/journalService';
import type { JournalEntry } from '../../types/journal';

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
  const { hasUnread: hasUnreadMindMate } = useMindMate();
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [latestReflection, setLatestReflection] = useState<JournalEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStreak();
      loadLatestReflection();
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

  // Pulls the newest journal entry (limit 1). Called on every focus so
  // returning to Home after creating a reflection reflects it without
  // any global store or observer — same pattern as `loadStreak` and
  // `JournalListScreen`'s focus-based reload.
  const loadLatestReflection = async () => {
    try {
      const res = await journalService.getJournals(1, 0);
      setLatestReflection(res.entries[0] ?? null);
    } catch (err) {
      console.error('Failed to load latest reflection:', err);
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
              //
              // `initial: false` is load-bearing: without it, React
              // Navigation makes `Chat` the INITIAL route of the Playground
              // stack (not a push on top of `PlaygroundHub`), which leaves
              // nothing to pop back to — the back button exits to the Home
              // tab and tapping the Playground tab icon does nothing because
              // the stack is already at its root. Passing `false` preserves
              // the natural hub → chat hierarchy so back and tab-tap both
              // land on PlaygroundHub as expected.
              navigation.navigate('Playground', {
                screen: 'Chat',
                initial: false,
              });
            }}
            padded
            radius="xl"
            style={styles.discoveryCard}
          >
            {/* Dark-mode-only violet gradient. Top-left stop (`#3B2E7A`)
                matches the MindMate icon's inner radial gradient so the
                card feels connected to the artwork; bottom-right stop
                (`#1E1A2E`) is the hero gradient endpoint, keeping the
                card rooted in the existing dark palette. Absolute-filled
                so it sits behind the row without affecting layout. */}
            {isDark && (
              <LinearGradient
                colors={['#3B2E7A', '#1E1A2E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.xl }]}
                pointerEvents="none"
              />
            )}
            <View style={styles.discoveryRow}>
              {/* Custom MindMate icon (same asset ChatScreen uses in its
                  header). Expo-image renders the SVG natively on both
                  platforms — no transformer needed. When a reply is
                  waiting (tracked by MindMateContext, cleared on
                  Playground tab press), a small coral dot overlays the
                  top-right corner to convey the unread state. */}
              <View style={styles.discoveryIcon}>
                <Image
                  source={require('../../../assets/mindmate-icon.svg')}
                  style={styles.discoveryIconImage}
                  contentFit="contain"
                />
                {hasUnreadMindMate && <View style={styles.discoveryIconBadge} />}
              </View>
              <View style={styles.discoveryContent}>
                <Text style={styles.discoveryTitle}>MindMate</Text>
                <Text style={styles.discoverySubtitle}>
                  A conversation that can become art
                </Text>
              </View>
            </View>
          </PressableSurface>

          {/* ══════════════════════════════════════════════════════
              Latest reflection — surfaces the user's newest journal
              entry so Home mirrors what they've most recently made.
              Refreshes on focus (see useFocusEffect above), so a new
              reflection appears here automatically on return. Hides
              entirely for fresh accounts with no entries.
              ══════════════════════════════════════════════════════ */}
          {latestReflection && (
            <Animated.View
              entering={FadeInUp.duration(enterConfig.content.duration).delay(240)}
              style={styles.latestReflectionSection}
            >
              <JournalCard
                id={latestReflection.id}
                // Inline the "Your latest reflection:" framing directly into
                // the preview text so the card doesn't need a separate label
                // row above it. Truncation (2 lines via `numberOfLines` on
                // JournalCard's preview Text) still works normally.
                content={`Your latest reflection: ${latestReflection.content}`}
                emotionTags={latestReflection.emotion_tags}
                imageUrl={latestReflection.image?.thumbnail_url ?? latestReflection.image?.image_url}
                createdAt={latestReflection.created_at}
                onPress={(id) => {
                  haptic.selection();
                  navigation.navigate('Journal', {
                    screen: 'JournalDetail',
                    params: { journalId: id },
                    initial: false,
                  });
                }}
              />
            </Animated.View>
          )}

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

  // Latest-reflection section — sits under MindMate, above concept
  // chips. No marginTop: the preceding `discoveryCard` already brings
  // its own marginBottom, so we only need spacing below this block.
  // The "Your latest reflection:" framing lives inline in the card's
  // content prop, so no separate label style is needed here.
  latestReflectionSection: {
    marginBottom: spacing.md,
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
    // `md` matches the other card-to-card gaps on this screen
    // (hero → MoodGraph, MoodGraph → MindMate, latest → concepts).
    marginBottom: spacing.md,
  },
  discoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // MindMate-icon container. The layout box stays 40×40 so the card
  // height (currently driven by this element) doesn't grow; the visual
  // size is bumped via `transform: scale` which leaves layout untouched.
  // `position: relative` anchors the unread-badge overlay.
  discoveryIcon: {
    width: 40,
    height: 40,
    marginRight: spacing.md,
    position: 'relative',
    transform: [{ scale: 1.3 }],
  },
  discoveryIconImage: {
    width: '100%',
    height: '100%',
  },
  // Small dot in the top-right of the icon when a MindMate reply is
  // unread. Coral (= `accent` / `error`) is the app's conventional
  // attention color; the 2px border cuts a clean gap against whatever
  // the icon's own dark-violet bg shows through.
  discoveryIconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.card,
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

  // Concept chips — no marginTop: the preceding section's
  // marginBottom (`latestReflectionSection` or `discoveryCard`) already
  // provides the `spacing.md` gap, consistent with every other card
  // pair on the screen.
  conceptPreview: {},
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
