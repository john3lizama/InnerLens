import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import JournalCard from '../../components/journal/JournalCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { mockJournals } from '../../data/mockJournals';
import { JournalStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalList'>;

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

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.subtitle}>Your reflections and insights</Text>

        <FlatList
          data={mockJournals}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            mockJournals.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={EmptyState}
          renderItem={({ item }) => (
            <JournalCard
              id={item.id}
              content={item.content}
              emotionTags={item.emotion_tags}
              imageUrl={item.image.thumbnail_url || item.image.image_url}
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
});
