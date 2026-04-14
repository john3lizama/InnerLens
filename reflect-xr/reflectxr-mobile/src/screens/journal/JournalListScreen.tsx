/**
 * JournalListScreen — Redesigned.
 *
 * Changes:
 * - Title: "Your reflections" (was "Journal")
 * - Removed subtitle (title is sufficient)
 * - Monthly section grouping with subtle headers
 * - Empty state: warm copy, smaller icon
 * - Uses surface tokens for mode-aware styling
 */

import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, SectionList, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import JournalCard from '../../components/journal/JournalCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as journalService from '../../services/journalService';

interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  created_at: string;
  word_count: number;
}

interface MonthSection {
  title: string;
  data: JournalEntry[];
}

function groupByMonth(entries: JournalEntry[]): MonthSection[] {
  const groups: Record<string, JournalEntry[]> = {};
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
    // Store label on the key for retrieval
    (groups as any)[`__label__${key}`] = label;
  }

  return Object.keys(groups)
    .filter((k) => !k.startsWith('__label__'))
    .sort((a, b) => b.localeCompare(a)) // newest first
    .map((key) => ({
      title: (groups as any)[`__label__${key}`],
      data: groups[key],
    }));
}

function EmptyState() {
  const { surfaces } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="book-outline" size={40} color={surfaces.text.tertiary} />
      <Text style={[emptyStyles.title, { color: surfaces.text.secondary }]}>
        Nothing here yet
      </Text>
      <Text style={[emptyStyles.subtitle, { color: surfaces.text.tertiary }]}>
        When you create something and reflect on it, it'll live here.
      </Text>
    </View>
  );
}

export default function JournalListScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadJournals();
    }, [])
  );

  const loadJournals = async () => {
    try {
      const res = await journalService.getJournals(50, 0);
      setJournals(res.entries);
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setLoading(false);
    }
  };

  const sections = useMemo(() => groupByMonth(journals), [journals]);

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.title}>Your reflections</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (journals.length === 0) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.title}>Your reflections</Text>
          <EmptyState />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Your reflections</Text>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <JournalCard
              id={item.id}
              content={item.content}
              emotionTags={item.emotion_tags}
              imageUrl={item.image?.thumbnail_url || item.image?.image_url || ''}
              createdAt={item.created_at}
              onPress={(id) => navigation.navigate('JournalDetail', { journalId: id })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h2,
    color: surfaces.text.primary,
    marginBottom: spacing.lg,
  },
  list: {
    paddingBottom: 120,
  },
  separator: {
    height: spacing.md,
  },
  sectionHeader: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionSeparator: {
    height: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  title: {
    ...typography.h3,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
