import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import JournalCard from '../../components/journal/JournalCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { JournalStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as journalService from '../../services/journalService';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalList'>;

interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: { emotion: string; intensity: number }[];
  image: { id: string; image_url: string; thumbnail_url?: string } | null;
  created_at: string;
  word_count: number;
}

function EmptyState() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.empty}>
      <Ionicons name="book-outline" size={64} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>No Reflections Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start your first creative reflection by tapping Create
      </Text>
    </View>
  );
}

export default function JournalListScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>Your reflections and insights</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.subtitle}>Your reflections and insights</Text>

        <FlatList
          data={journals}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            journals.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={EmptyState}
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
        />
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  list: {
    paddingBottom: 120,
  },
  separator: {
    height: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
