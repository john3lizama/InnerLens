import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import EmotionTagList from '../../components/journal/EmotionTagList';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { formatFullDate, formatTime } from '../../utils/formatDate';
import { JournalStackParamList } from '../../navigation/types';
import * as journalService from '../../services/journalService';

type Route = RouteProp<JournalStackParamList, 'JournalDetail'>;

interface JournalDetail {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  reflection_prompt_used?: string;
  created_at: string;
  word_count: number;
}

export default function JournalDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { journalId } = route.params;
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadJournal();
  }, [journalId]);

  const loadJournal = async () => {
    try {
      const data = await journalService.getJournalById(journalId);
      setJournal(data);
    } catch (err) {
      console.error('Failed to load journal:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error || !journal) {
    return (
      <SafeAreaWrapper>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Journal entry not found</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {/* Image */}
        {journal.image && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: journal.image.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
          </View>
        )}

        {/* Date */}
        <Text style={styles.date}>
          {formatFullDate(journal.created_at)} at {formatTime(journal.created_at)}
        </Text>

        {/* Emotion Tags */}
        <View style={styles.tagsSection}>
          <EmotionTagList tags={journal.emotion_tags} />
        </View>

        {/* Journal Content */}
        <View style={styles.contentCard}>
          <Text style={styles.journalText}>{journal.content}</Text>
        </View>

        {/* Word count */}
        <Text style={styles.wordCount}>
          {journal.word_count} words
        </Text>

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
    paddingTop: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  date: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tagsSection: {
    marginBottom: spacing.lg,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadow.sm,
  },
  journalText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 26,
  },
  wordCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: spacing.md,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
