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
 * - Inline edit mode: text becomes editable in-place with Save/Cancel below
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator,
  Alert, TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
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
  is_favorite?: boolean;
}

export default function JournalDetailScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { journalId, editMode: initialEditMode } = route.params;
  const { surfaces, colors } = useTheme();
  const styles = makeStyles(surfaces);

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // ── Edit mode state ───────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadJournal();
  }, [journalId]);

  // Enter edit mode if navigated with editMode param
  useEffect(() => {
    if (initialEditMode && journal && !isEditing) {
      enterEditMode();
    }
  }, [initialEditMode, journal]);

  // Stop any in-flight TTS when leaving the screen — audio should never
  // leak into the next screen the user navigates to.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

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

  const enterEditMode = () => {
    if (!journal) return;
    setEditedContent(journal.content);
    setIsEditing(true);
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const saveEdit = async () => {
    if (!journal || !editedContent.trim()) return;

    setIsSavingEdit(true);
    try {
      const updated = await journalService.updateJournal(journal.id, editedContent.trim());
      setJournal(updated);
      setIsEditing(false);
      setEditedContent('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to update journal:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle the favorite flag. Optimistic update — flip state immediately,
  // call the backend in the background, roll back on failure. Keeps the
  // heart responsive even on slow networks.
  const toggleFavorite = useCallback(async () => {
    if (!journal || isTogglingFavorite) return;
    const next = !journal.is_favorite;
    haptic.light();
    setJournal({ ...journal, is_favorite: next });
    setIsTogglingFavorite(true);
    try {
      const updated = await journalService.toggleJournalFavorite(journal.id, next);
      setJournal(updated);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Roll back to prior state
      setJournal(prev => prev ? { ...prev, is_favorite: !next } : prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [journal, isTogglingFavorite]);

  // Toggle text-to-speech playback of the journal body.
  // Tap once to start, tap again to stop. The state flips back on its own
  // when speech finishes naturally (onDone) or is cancelled (onStopped).
  const toggleSpeech = useCallback(() => {
    if (!journal?.content?.trim()) return;
    haptic.light();
    if (isSpeaking) {
      Speech.stop();
      return;
    }
    setIsSpeaking(true);
    Speech.speak(journal.content, {
      language: 'en',
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [journal?.content, isSpeaking]);

  const saveImageToPhone = async () => {
    if (!journal?.image?.image_url || saving) return;

    setSaving(true);
    haptic.selection();

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow access to your photo library to save images.',
        );
        setSaving(false);
        return;
      }

      const fileExt = journal.image.image_url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `reflectxr-${journal.id}-${Date.now()}.${fileExt}`;
      const destination = new File(Paths.cache, fileName);

      if (destination.exists) {
        destination.delete();
      }

      const downloadedFile = await File.downloadFileAsync(
        journal.image.image_url,
        destination,
      );

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
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row — back chevron + edit button */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (isEditing) {
                cancelEdit();
                return;
              }
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
        </View>

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

        {/* Date + meta actions (speak / save-image) */}
        <View style={styles.metaRow}>
          <Text style={styles.date} numberOfLines={1}>
            {formatFullDate(journal.created_at)} at {formatTime(journal.created_at)}
          </Text>
          {!isEditing && (
            <View style={styles.metaActions}>
              <Pressable
                onPress={toggleSpeech}
                style={styles.saveButton}
                hitSlop={12}
                disabled={!journal.content?.trim()}
                accessibilityRole="button"
                accessibilityLabel={isSpeaking ? 'Stop reading journal aloud' : 'Read journal aloud'}
              >
                <Feather
                  name="volume-2"
                  size={22}
                  color={isSpeaking ? '#6C63FF' : surfaces.text.secondary}
                />
              </Pressable>
              {journal.image && (
                <Pressable
                  onPress={saveImageToPhone}
                  style={styles.saveButton}
                  hitSlop={12}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Save image to photos"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={surfaces.text.secondary} />
                  ) : (
                    <Feather name="download" size={22} color={surfaces.text.secondary} />
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={toggleFavorite}
                style={styles.saveButton}
                hitSlop={12}
                disabled={isTogglingFavorite}
                accessibilityRole="button"
                accessibilityLabel={journal.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Ionicons
                  name={journal.is_favorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={journal.is_favorite ? '#FF2D55' : surfaces.text.secondary}
                />
              </Pressable>
              <Pressable
                onPress={enterEditMode}
                style={styles.saveButton}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Edit journal"
              >
                <Feather name="edit-3" size={22} color={surfaces.text.secondary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Emotion Tags */}
        {journal.emotion_tags.length > 0 && (
          <View style={styles.tagsSection}>
            <EmotionTagList tags={journal.emotion_tags} />
          </View>
        )}

        {/* Journal Content — inline editable or read-only */}
        {isEditing ? (
          <TextInput
            ref={textInputRef}
            style={styles.journalText}
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholderTextColor={surfaces.text.tertiary}
            placeholder="Write your reflection..."
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.journalText}>{journal.content}</Text>
        )}

        {/* Inline Save / Cancel — sits right below the text */}
        {isEditing && (
          <View style={styles.inlineActions}>
            <Pressable
              onPress={cancelEdit}
              style={[styles.inlineButton, { backgroundColor: surfaces.colors.ground }]}
              disabled={isSavingEdit}
            >
              <Text style={[styles.inlineButtonText, { color: surfaces.text.secondary }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              style={[styles.inlineButton, styles.saveEditButton]}
              disabled={isSavingEdit || !editedContent.trim()}
            >
              {isSavingEdit ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.inlineButtonText, { color: '#fff' }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={{ height: 120 }} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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

  // Inline edit actions — scroll with content
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  inlineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditButton: {
    backgroundColor: '#6C63FF',
  },
  inlineButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});
