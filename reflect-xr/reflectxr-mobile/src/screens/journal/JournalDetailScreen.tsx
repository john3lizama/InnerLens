/**
 * JournalDetailScreen — Redesigned.
 *
 * Changes:
 * - Full-width artwork at 3:4 aspect ratio (was 4:3)
 * - Removed word count (adds quantification to a reflective space)
 * - Removed "Back" text label — just chevron
 * - Reflection text with generous line height (28px)
 * - Removed card wrapper around journal content
 * - Uses surface tokens for mode-aware styling
 * - Date and tags as quiet metadata
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import EmotionTagList from '../../components/journal/EmotionTagList';
import { typography, spacing, borderRadius } from '../../theme';
import { fade } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { formatFullDate, formatTime } from '../../utils/formatDate';
import * as journalService from '../../services/journalService';

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
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { journalId } = route.params;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const saveImageToPhone = async () => {
    if (!journal?.image?.image_url || saving) return;

    setSaving(true);
    haptic.selection();

    try {
      // Request permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow access to your photo library to save images.',
        );
        setSaving(false);
        return;
      }

      // Download to a temporary file using SDK 55 File API
      const fileExt = journal.image.image_url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `reflectxr-${journal.id}-${Date.now()}.${fileExt}`;
      const destination = new File(Paths.cache, fileName);

      // Remove if it already exists
      if (destination.exists) {
        destination.delete();
      }

      const downloadedFile = await File.downloadFileAsync(
        journal.image.image_url,
        destination,
      );

      // Save to camera roll / media library
      await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);

      haptic.success();
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (err) {
      console.error('Failed to save image:', err);
      Alert.alert('Error', 'Could not save the image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error || !journal) {
    return (
      <SafeAreaWrapper>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Journal entry not found</Text>
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
        {/* Back button — chevron only */}
        <Pressable
          onPress={() => {
            // If the Journal stack has history, go back normally.
            // Otherwise navigate to JournalList (e.g. when deep-linked from Home tab).
            if (navigation.canGoBack()) {
              const state = navigation.getState();
              if (state && state.index > 0) {
                navigation.goBack();
              } else {
                navigation.navigate('JournalList' as never);
              }
            } else {
              navigation.navigate('JournalList' as never);
            }
          }}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={surfaces.text.primary} />
        </Pressable>

        {/* Artwork — full width, 3:4 aspect */}
        {journal.image && (
          <Animated.View
            entering={FadeIn.duration(fade.reverent)}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: journal.image.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
          </Animated.View>
        )}

        {/* Date + Save button row */}
        <View style={styles.metaRow}>
          <Text style={styles.date}>
            {formatFullDate(journal.created_at)} at {formatTime(journal.created_at)}
          </Text>
          {journal.image && (
            <Pressable
              onPress={saveImageToPhone}
              style={styles.saveButton}
              hitSlop={12}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={surfaces.text.secondary} />
              ) : (
                <Ionicons name="download-outline" size={22} color={surfaces.text.secondary} />
              )}
            </Pressable>
          )}
        </View>

        {/* Emotion Tags */}
        {journal.emotion_tags.length > 0 && (
          <View style={styles.tagsSection}>
            <EmotionTagList tags={journal.emotion_tags} />
          </View>
        )}

        {/* Journal Content — no card wrapper, generous line height */}
        <Text style={styles.journalText}>{journal.content}</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  saveButton: {
    padding: spacing.xs,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  date: {
    ...typography.caption,
    color: surfaces.text.tertiary,
    flex: 1,
  },
  tagsSection: {
    marginBottom: spacing.lg,
  },
  journalText: {
    ...typography.body,
    color: surfaces.text.primary,
    lineHeight: 28,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.body,
    color: surfaces.text.secondary,
  },
});
