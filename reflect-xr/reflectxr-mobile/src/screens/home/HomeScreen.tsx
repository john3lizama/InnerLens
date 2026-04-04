import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  FlatList,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Card from '../../components/ui/Card';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { mockJournals } from '../../data/mockJournals';
import { formatRelativeDate } from '../../utils/formatDate';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const recentJournals = mockJournals.slice(0, 3);

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
              <Text style={styles.greeting}>Welcome back,</Text>
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
        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
          <Pressable onPress={() => navigation.navigate('Create')}>
            <LinearGradient
              colors={[...colors.gradient.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaCard}
            >
              <View style={styles.ctaContent}>
                <Text style={styles.ctaTitle}>Begin Creating</Text>
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

        {/* MindMate Teaser */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)}>
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

        {/* Recent Reflections */}
        {recentJournals.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.section}>
            <View style={styles.sectionHeader}>
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
  mindmateCard: {
    marginBottom: spacing.lg,
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
  section: {
    marginTop: spacing.sm,
  },
  sectionHeader: {
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
    position: 'relative',
  },
  journalImage: {
    width: '100%',
    height: 120,
  },
  journalImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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
});
