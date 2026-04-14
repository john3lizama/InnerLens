/**
 * ReflectScreen — Redesigned as emotional payoff.
 *
 * Changes:
 * - Artwork presented at 3:4 aspect ratio (taller, more gallery-like)
 * - Report/Share are icon-only, small, near artwork (not near save)
 * - Reflection prompt is quiet secondary text, not a bordered card
 * - Input has no label — the space is self-evident
 * - Placeholder: "If anything comes to mind, this is a place for it."
 * - Save confirmation: in-screen animation instead of Alert dialog
 * - "Save" instead of "Save Reflection" (less formal)
 * - Uses surface tokens and motion tokens
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ReflectionPrompt from '../../components/create/ReflectionPrompt';
import { typography, spacing, borderRadius } from '../../theme';
import { fade, enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import * as journalService from '../../services/journalService';

export default function ReflectScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { surfaces } = useTheme();
  const { image, concept, sessionId } = route.params;

  const [journalText, setJournalText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  // Save confirmation animation
  const confirmOpacity = useSharedValue(0);
  const confirmScale = useSharedValue(0.8);

  const confirmStyle = useAnimatedStyle(() => ({
    opacity: confirmOpacity.value,
    transform: [{ scale: confirmScale.value }],
  }));

  const styles = makeStyles(surfaces);

  const handleReport = () => {
    haptic.light();
    Alert.alert(
      'Report Image',
      'Why are you reporting this image?',
      [
        { text: 'Inappropriate Content', onPress: () => Alert.alert('Report Submitted', 'Thank you. We will review this image.') },
        { text: 'Low Quality', onPress: () => Alert.alert('Report Submitted', 'Thank you for your feedback.') },
        { text: 'Other', onPress: () => Alert.alert('Report Submitted', 'Thank you. We will review this image.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShare = async () => {
    haptic.light();
    try {
      await Share.share({
        message: `Check out this artwork I created with ReflectXR!\n\n${image.image_url}`,
      });
    } catch {}
  };

  const saveImageToPhone = async () => {
    if (!image?.image_url || savingImage) return;

    setSavingImage(true);
    haptic.selection();

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow access to your photo library to save images.',
        );
        setSavingImage(false);
        return;
      }

      const fileExt = image.image_url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `reflectxr-${image.id}-${Date.now()}.${fileExt}`;
      const destination = new File(Paths.cache, fileName);

      if (destination.exists) {
        destination.delete();
      }

      const downloadedFile = await File.downloadFileAsync(
        image.image_url,
        destination,
      );

      await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);

      haptic.success();
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (err) {
      console.error('Failed to save image:', err);
      Alert.alert('Error', 'Could not save the image. Please try again.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleSave = async () => {
    if (!journalText.trim()) return;
    setSaving(true);

    try {
      await journalService.createJournal(
        image.id,
        sessionId,
        journalText.trim(),
        concept.reflection_prompt,
      );

      // In-screen save confirmation
      haptic.success();
      setSaved(true);
      confirmOpacity.value = withSpring(1, { damping: 20, stiffness: 300 });
      confirmScale.value = withSpring(1, { damping: 14, stiffness: 200 });

      // Fade out and navigate after 1.5s
      setTimeout(() => {
        confirmOpacity.value = withTiming(0, { duration: fade.normal });
        setTimeout(() => navigation.popToTop(), fade.normal);
      }, 1500);
    } catch (err) {
      console.error('Failed to save journal:', err);
      Alert.alert('Save Failed', 'Could not save your reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Artwork — presented with care */}
          <Animated.View
            entering={FadeIn.duration(fade.reverent)}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: image.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={400}
            />
          </Animated.View>

          {/* Utility actions — small, near artwork, not prominent */}
          <View style={styles.actionRow}>
            <Pressable onPress={handleReport} style={styles.actionButton} hitSlop={12}>
              <MaterialCommunityIcons name="message-alert-outline" size={20} color={surfaces.text.tertiary} />
            </Pressable>
            <Pressable onPress={saveImageToPhone} style={styles.actionButton} hitSlop={12} disabled={savingImage}>
              {savingImage ? (
                <ActivityIndicator size="small" color={surfaces.text.tertiary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={surfaces.text.tertiary} />
              )}
            </Pressable>
          </View>

          {/* Breathing room */}
          <View style={styles.spacer} />

          {/* Reflection prompt — quiet invitation */}
          <ReflectionPrompt prompt={concept.reflection_prompt} />

          {/* Journal Input — no label, self-evident */}
          <Input
            value={journalText}
            onChangeText={setJournalText}
            multiline
            placeholder="If anything comes to mind, this is a place for it."
            containerStyle={styles.journalInput}
          />

          {/* Save button */}
          <View style={styles.footer}>
            <Button
              title="Save"
              onPress={handleSave}
              loading={saving}
              disabled={journalText.trim().length === 0 || saved}
              fullWidth
              hapticWeight="medium"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* In-screen save confirmation overlay */}
        {saved && (
          <View style={styles.confirmOverlay} pointerEvents="none">
            <Animated.View style={[styles.confirmCard, confirmStyle]}>
              <Ionicons name="checkmark-circle" size={32} color="#7FB69E" />
              <Text style={[styles.confirmText, { color: surfaces.text.primary }]}>
                Saved
              </Text>
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.xl,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  spacer: {
    height: spacing.md,
  },
  journalInput: {
    minHeight: 140,
  },
  footer: {
    marginTop: spacing.lg,
  },
  // Save confirmation overlay
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  confirmCard: {
    backgroundColor: surfaces.colors.elevated,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmText: {
    ...typography.h3,
  },
});
