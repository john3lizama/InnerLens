/**
 * ChatHistoryScreen — list of past MindMate conversations.
 *
 * Taps a row → navigates back to `Chat` with `loadSessionId` set so the
 * ChatScreen rehydrates that session. Empty state mirrors JournalList.
 */

import React, { createRef, useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import * as chatService from '../../services/chatService';
import type { ChatSessionSummary } from '../../services/chatService';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}

function EmptyState() {
  const { surfaces } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="chatbubbles-outline" size={40} color={surfaces.text.tertiary} />
      <Text style={[emptyStyles.title, { color: surfaces.text.secondary }]}>
        No conversations yet
      </Text>
      <Text style={[emptyStyles.subtitle, { color: surfaces.text.tertiary }]}>
        Your MindMate chats will show up here once you start one.
      </Text>
    </View>
  );
}

export default function ChatHistoryScreen() {
  const navigation = useNavigation() as any;
  const { surfaces, colors } = useTheme();
  const styles = makeStyles(surfaces);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await chatService.listSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openSession = (id: string) => {
    navigation.navigate('Chat', { loadSessionId: id });
  };

  // One ref per row so we can imperatively close the swipe after the user
  // cancels a delete. Keyed by session id; entries are lazily created the
  // first time we render each row. ReanimatedSwipeable's ref prop expects a
  // RefObject (not a callback), so we pre-allocate with createRef.
  const swipeRefs = useRef(
    new Map<string, RefObject<SwipeableMethods | null>>()
  );
  const getSwipeRef = (id: string): RefObject<SwipeableMethods | null> => {
    let ref = swipeRefs.current.get(id);
    if (!ref) {
      ref = createRef<SwipeableMethods | null>();
      swipeRefs.current.set(id, ref);
    }
    return ref;
  };

  const confirmDelete = (item: ChatSessionSummary) => {
    const parts: string[] = [];
    if (item.journal_count > 0) {
      parts.push(
        `${item.journal_count} reflection${item.journal_count === 1 ? '' : 's'}`
      );
    }
    if (item.has_image) parts.push('any artwork from it');
    const tail = parts.length > 0
      ? `\n\nThis will also remove ${parts.join(' and ')}.`
      : '';
    Alert.alert(
      'Delete this conversation?',
      `This cannot be undone.${tail}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            swipeRefs.current.get(item.id)?.current?.close();
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteSession(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSessions((prev) => prev.filter((s) => s.id !== item.id));
              swipeRefs.current.delete(item.id);
            } catch (err) {
              console.error('Failed to delete session:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              swipeRefs.current.get(item.id)?.current?.close();
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderRightAction = (item: ChatSessionSummary) => () => (
    <Pressable
      onPress={() => confirmDelete(item)}
      style={({ pressed }) => [
        styles.deleteAction,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityLabel="Delete conversation"
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: ChatSessionSummary }) => {
    const preview = item.preview?.trim() || 'New conversation';
    return (
      <ReanimatedSwipeable
        ref={getSwipeRef(item.id)}
        renderRightActions={renderRightAction(item)}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
      >
        <Pressable
          onPress={() => openSession(item.id)}
          style={({ pressed }) => [
            styles.row,
            pressed && { opacity: 0.6 },
          ]}
        >
          <View style={styles.rowMain}>
            <Text numberOfLines={2} style={styles.preview}>
              {preview}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaTime}>{relativeTime(item.created_at)}</Text>
              {item.journal_count > 0 && (
                <View style={styles.badge}>
                  <Ionicons
                    name="book-outline"
                    size={11}
                    color={surfaces.text.secondary}
                  />
                  <Text style={styles.badgeText}>
                    {item.journal_count} reflection{item.journal_count === 1 ? '' : 's'}
                  </Text>
                </View>
              )}
              {item.has_image && (
                <View style={styles.badge}>
                  <Ionicons
                    name="sparkles-outline"
                    size={11}
                    color={surfaces.text.secondary}
                  />
                  <Text style={styles.badgeText}>art</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={surfaces.text.tertiary}
          />
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={surfaces.text.primary}
            />
          </Pressable>
          <Text style={styles.title}>History</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    backBtn: {
      width: 32,
      alignItems: 'flex-start',
    },
    title: {
      ...typography.h3,
      color: surfaces.text.primary,
    },
    list: {
      paddingBottom: 120,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: surfaces.colors.ground,
    },
    rowMain: {
      flex: 1,
      gap: spacing.xs,
    },
    preview: {
      ...typography.body,
      color: surfaces.text.primary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    metaTime: {
      ...typography.caption,
      color: surfaces.text.tertiary,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: surfaces.colors.sunken,
    },
    badgeText: {
      ...typography.caption,
      color: surfaces.text.secondary,
    },
    separator: {
      height: spacing.sm,
    },
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteAction: {
      backgroundColor: '#D93B3B',
      justifyContent: 'center',
      alignItems: 'center',
      width: 88,
      borderTopRightRadius: borderRadius.lg,
      borderBottomRightRadius: borderRadius.lg,
      gap: 4,
    },
    deleteActionText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '600',
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
