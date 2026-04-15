/**
 * PrivacyScreen — destructive data controls.
 *
 * Currently hosts one action: bulk-delete every MindMate conversation.
 * More privacy tools (export, delete account, etc.) will land here later.
 *
 * The cascade on the backend removes messages, generated art, and any
 * journal entries linked to those chats, so the confirmation copy states
 * that explicitly.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Surface from '../../components/ui/Surface';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, borderRadius } from '../../theme';
import * as chatService from '../../services/chatService';

export default function PrivacyScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAllChats = () => {
    Alert.alert(
      'Delete all MindMate chats?',
      'Every conversation on this account will be permanently removed, along with any reflections and artwork created from them. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await chatService.deleteAllSessions();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done', 'All of your MindMate chats have been deleted.');
            } catch (err) {
              console.error('Failed to delete all sessions:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Could not delete', 'Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
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
          <Text style={styles.title}>Privacy</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Text style={styles.sectionLabel}>Data</Text>
          <Surface role="ground" radius="xl" style={styles.section}>
            <Pressable
              onPress={deleting ? undefined : handleDeleteAllChats}
              disabled={deleting}
              style={({ pressed }) => [
                styles.row,
                pressed && !deleting && { opacity: 0.6 },
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#D93B3B"
                style={styles.rowIcon}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Delete all MindMate chats</Text>
                <Text style={styles.rowSub}>
                  Includes any reflections and artwork from those chats.
                </Text>
              </View>
              {deleting ? (
                <ActivityIndicator size="small" color="#D93B3B" />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={surfaces.text.tertiary}
                />
              )}
            </Pressable>
          </Surface>

          <Text style={styles.footnote}>
            Reflections and artwork made from your chats are tied to those
            conversations. Deleting a chat removes them, too.
          </Text>
        </ScrollView>
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
    scroll: {
      paddingTop: spacing.md,
      paddingBottom: 120,
    },
    sectionLabel: {
      ...typography.caption,
      color: surfaces.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginLeft: spacing.sm,
    },
    section: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rowIcon: {
      width: 24,
      textAlign: 'center',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      ...typography.body,
      color: '#D93B3B',
      fontWeight: '600',
    },
    rowSub: {
      ...typography.caption,
      color: surfaces.text.secondary,
    },
    footnote: {
      ...typography.caption,
      color: surfaces.text.tertiary,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.sm,
      lineHeight: 18,
    },
  });
