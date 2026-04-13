import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Card from '../../components/ui/Card';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import { formatRelativeDate } from '../../utils/formatDate';
import * as journalService from '../../services/journalService';

const STEPS = [
  { icon: 'color-palette-outline' as const, title: 'Choose a Concept', desc: 'Pick a creative theme that speaks to you' },
  { icon: 'brush-outline' as const, title: 'Generate Art', desc: 'AI creates artwork based on your emotions' },
  { icon: 'journal-outline' as const, title: 'Reflect & Journal', desc: 'Write about what the art means to you' },
];

interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  created_at: string;
  word_count: number;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { concepts, loading: conceptsLoading } = useConcepts();
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadJournals();
    }, [])
  );

  const loadJournals = async () => {
    try {
      const res = await journalService.getJournals(3, 0);
      setRecentJournals(res.entries);
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setJournalsLoading(false);
    }
  };

  // CTA glow pulse animation
  const ctaGlowOpacity = useSharedValue(0.2);
  useEffect(() => {
    ctaGlowOpacity.value = withRepeat(
      withTiming(0.35, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [ctaGlowOpacity]);
  const ctaGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: ctaGlowOpacity.value,
  }));

  const isNewUser = !journalsLoading && recentJournals.length === 0;

  // Curated concept picks from real data
  const todaysPrompt = concepts[2] || concepts[0];
  const mostPopular = concepts[0];
  const exploreConcepts = concepts.slice(1, 4);

  const navigateToConcept = (concept: typeof concepts[0]) => {
    if (!concept) return;
    Haptics.selectionAsync();
    navigation.navigate('Create', {
      screen: 'PromptDesign',
      params: { concept },
    });
  };

  return (
    <SafeAreaWrapper gradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(400).delay(0)}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                {isNewUser ? 'Welcome,' : 'Welcome back,'}
              </Text>
              <Text style={styles.name}>{user?.display_name || 'Friend'}</Text>
            </View>
            <Pressable
              style={styles.avatar}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Create CTA */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={ctaGlowStyle}>
          <Pressable onPress={() => navigation.navigate('Create')}>
            <LinearGradient
              colors={[...colors.gradient.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <View style={styles.ctaContent}>
                <Text style={styles.ctaTitle}>
                  {isNewUser ? 'Start Your First Reflection' : 'Begin Creating'}
                </Text>
                <Text style={styles.ctaSubtitle}>
                  Explore your emotions through AI-generated art
                </Text>
              </View>
              <View style={styles.ctaIcon}>
                <Ionicons name="sparkles" size={32} color="rgba(255,255,255,0.9)" />
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Today's Prompt */}
        {todaysPrompt && (
          <Animated.View entering={FadeInUp.duration(400).delay(200)}>
            <Pressable onPress={() => navigateToConcept(todaysPrompt)}>
              <View style={styles.todayCard}>
                <LinearGradient
                  colors={[`${colors.accent}18`, `${colors.primary}10`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.todayGradient}
                />
                <View style={styles.todayHeader}>
                  <Ionicons name="sunny-outline" size={16} color={colors.accent} />
                  <Text style={styles.todayLabel}>Today's Prompt</Text>
                </View>
                <View style={styles.todayRow}>
                  <View style={styles.todayIconWrap}>
                    <Ionicons name={(conceptIcons[todaysPrompt.slug] || 'color-palette-outline') as any} size={24} color={colors.accent} />
                  </View>
                  <View style={styles.todayContent}>
                    <Text style={styles.todayTitle}>{todaysPrompt.title}</Text>
                    <Text style={styles.todayDesc} numberOfLines={1}>
                      {todaysPrompt.prompt_template.replace('[DROPDOWN]', todaysPrompt.dropdown_options[0])}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* MindMate Teaser */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)}>
          <Card
            onPress={() => {
              Haptics.selectionAsync();
              navigation.navigate('MindMate');
            }}
            style={styles.mindmateCard}
          >
            <View style={styles.mindmateRow}>
              <View style={styles.mindmateIcon}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color={colors.secondary}
                />
              </View>
              <View style={styles.mindmateContent}>
                <Text style={styles.mindmateTitle}>Talk to MindMate</Text>
                <Text style={styles.mindmateSubtitle}>
                  Share how you feel — art happens naturally
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Card>
        </Animated.View>

        {/* Most Popular */}
        {mostPopular && (
          <Animated.View entering={FadeInUp.duration(400).delay(400)}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Most Popular</Text>
            </View>
            <Pressable onPress={() => navigateToConcept(mostPopular)}>
              <View style={styles.popularCard}>
                <View style={styles.popularIconWrap}>
                  <Ionicons name={(conceptIcons[mostPopular.slug] || 'color-palette-outline') as any} size={26} color={colors.primary} />
                </View>
                <View style={styles.popularContent}>
                  <Text style={styles.popularTitle}>{mostPopular.title}</Text>
                  <Text style={styles.popularDesc} numberOfLines={2}>
                    {mostPopular.prompt_template.replace('[DROPDOWN]', `your ${mostPopular.dropdown_label.toLowerCase()}`)}
                  </Text>
                </View>
                <View style={styles.popularBadge}>
                  <Ionicons name="flame" size={14} color={colors.accent} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Explore Concepts */}
        {exploreConcepts.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(500)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Explore Concepts</Text>
              <Pressable onPress={() => navigation.navigate('Create')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.conceptsList}
            >
              {exploreConcepts.map((concept) => (
                <Pressable
                  key={concept.id}
                  style={styles.conceptChip}
                  onPress={() => navigateToConcept(concept)}
                >
                  <Ionicons name={(conceptIcons[concept.slug] || 'color-palette-outline') as any} size={18} color={colors.primary} />
                  <Text style={styles.conceptChipTitle}>{concept.title}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Recent Reflections (returning user) */}
        {!isNewUser && recentJournals.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(600)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Reflections</Text>
              <Pressable onPress={() => navigation.navigate('Journal')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={recentJournals}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.journalList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.journalCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                  }}
                >
                  {item.image && (
                    <View style={styles.journalImageContainer}>
                      <Image
                        source={{ uri: item.image.image_url }}
                        style={styles.journalImage}
                        contentFit="cover"
                        transition={200}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.4)']}
                        style={styles.journalImageOverlay}
                      />
                    </View>
                  )}
                  <View style={styles.journalMeta}>
                    <Text style={styles.journalDate}>
                      {formatRelativeDate(item.created_at)}
                    </Text>
                    <Text style={styles.journalPreview} numberOfLines={2}>
                      {item.content}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </Animated.View>
        )}

        {/* How It Works (new user) */}
        {isNewUser && (
          <Animated.View entering={FadeInUp.duration(400).delay(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.stepsContainer}>
              {STEPS.map((step, index) => (
                <Animated.View
                  key={step.title}
                  entering={FadeInUp.duration(350).delay(700 + index * 100)}
                >
                  <View style={styles.stepRow}>
                    <View style={styles.stepIconContainer}>
                      <View style={styles.stepIcon}>
                        <Ionicons name={step.icon} size={22} color={colors.primary} />
                      </View>
                      {index < STEPS.length - 1 && <View style={styles.stepLine} />}
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepNumber}>Step {index + 1}</Text>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h1,
    color: colors.text,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.overlay.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.lg,
    ...shadow.glow,
  },
  ctaContent: {
    flex: 1,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  ctaSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
  },
  ctaIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },

  // Today's Prompt
  todayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.sm,
  },
  todayGradient: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.xl,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  todayLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  todayContent: {
    flex: 1,
  },
  todayTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  todayDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // MindMate
  mindmateCard: {
    marginBottom: spacing.md,
  },
  mindmateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mindmateIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.secondary}25`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  mindmateContent: {
    flex: 1,
  },
  mindmateTitle: {
    ...typography.h3,
    color: colors.text,
  },
  mindmateSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Most Popular
  popularCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  popularIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  popularContent: {
    flex: 1,
  },
  popularTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  popularDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  popularBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  // Sections
  section: {
    marginTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  seeAll: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },

  // Explore Concepts
  conceptsList: {
    gap: spacing.sm,
  },
  conceptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
  conceptChipTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },

  // Journals
  journalList: {
    gap: spacing.md,
  },
  journalCard: {
    width: 200,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  journalImageContainer: {
    position: 'relative' as const,
  },
  journalImage: {
    width: '100%',
    height: 120,
  },
  journalImageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  journalMeta: {
    padding: spacing.md,
  },
  journalDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  journalPreview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // How It Works (new user)
  stepsContainer: {
    marginTop: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIconContainer: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: `${colors.primary}20`,
    marginVertical: spacing.xs,
  },
  stepContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
