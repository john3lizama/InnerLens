/**
 * ResponseScreen — Redesigned generation moment.
 *
 * Changes:
 * - Orb size increased to 100, breathing slowed to 2800ms (more meditative)
 * - Loading text rotates every 4s with calmer copy
 * - Removed dim overlay (orb on regular background, not dramatic)
 * - Orb dissolves outward (scale 1→1.3, opacity 1→0) when images arrive
 * - Images emerge with gentle fade + scale after orb dissolves
 * - Uses motion tokens and haptic tokens throughout
 * - Refined copy: "What emerged" / "Take your time."
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Alert, Pressable, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ImageGrid from '../../components/create/ImageGrid';
import { typography, spacing, borderRadius } from '../../theme';
import { generation, fade, enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { GeneratedImage } from '../../types/image';
import * as generateService from '../../services/generateService';

const ORB_SIZE = 100;

const LOADING_MESSAGES = [
  'Holding what you shared\u2026',
  'Finding the right form\u2026',
  'Almost there\u2026',
];

export default function ResponseScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { colors, surfaces } = useTheme();
  const { prompt, style, concept } = route.params;

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [refinement, setRefinement] = useState('');
  // Editable base prompt. Seeded from route params; updated when the user
  // submits an edit from the prompt-editor modal. Subsequent regenerates
  // and refinements both compose off this value (not the original param),
  // so "Edit prompt" is a true replacement.
  const [basePrompt, setBasePrompt] = useState<string>(prompt);
  const [promptEditOpen, setPromptEditOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string>('');

  // Orb animations
  const orbScale = useSharedValue(generation.breathMin);
  const glowOpacity = useSharedValue(generation.glowMin);
  const orbContainerScale = useSharedValue(0);
  const orbContainerOpacity = useSharedValue(1);
  const textOpacity = useSharedValue(1);

  const startOrbAnimations = useCallback(() => {
    // Bloom in using signature spring
    orbContainerScale.value = withSpring(1, { damping: 16, stiffness: 90, mass: 1.2 });

    // Meditative breathing
    orbScale.value = withRepeat(
      withTiming(generation.breathMax, {
        duration: generation.breathDuration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    glowOpacity.value = withRepeat(
      withTiming(generation.glowMax, {
        duration: generation.breathDuration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [orbScale, glowOpacity, orbContainerScale]);

  const dissolveOrb = useCallback(() => {
    // Orb dissolves outward — becomes the artwork
    orbContainerScale.value = withTiming(generation.dissolve.scaleTo, {
      duration: generation.dissolve.duration,
    });
    orbContainerOpacity.value = withTiming(generation.dissolve.opacityTo, {
      duration: generation.dissolve.duration,
    });
    textOpacity.value = withTiming(0, { duration: fade.fast });

    // Brief pause, then show results
    setTimeout(() => {
      setShowResults(true);
    }, generation.dissolve.duration * 0.6);
  }, [orbContainerScale, orbContainerOpacity, textOpacity]);

  useEffect(() => {
    haptic.medium();
    startOrbAnimations();
    generateArt();
  }, []);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: generation.textFadeDuration }),
        withTiming(1, { duration: generation.textFadeDuration }),
      );
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, generation.textFadeDuration);
    }, generation.textRotateInterval);
    return () => clearInterval(interval);
  }, [loading, textOpacity]);

  const generateArt = async (overridePrompt?: string) => {
    try {
      const effective = overridePrompt ?? prompt;
      const res = await generateService.generateImages(effective, style, concept.id, 4);
      setSessionId(res.session_id);
      setImages(res.images.map((img: any) => ({
        ...img,
        is_selected: false,
        source: 'concept' as const,
        created_at: new Date().toISOString(),
      })));
      haptic.heavy();
    } catch (err) {
      console.error('Image generation failed:', err);
      Alert.alert('Generation Failed', 'Could not generate images. Please try again.', [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
      return;
    } finally {
      setLoading(false);
      dissolveOrb();
    }
  };

  const selectedImage = images.find((img) => img.id === selectedId);

  const handleReflect = async () => {
    if (!selectedImage || !sessionId) return;
    try {
      await generateService.selectImage(selectedImage.id, sessionId);
    } catch (err) {
      console.error('Failed to select image:', err);
    }
    navigation.navigate('Reflect', { image: selectedImage, concept, sessionId });
  };

  // Shared reset block for the three "run a new generation" actions
  // (regenerate, regenerate-with-refinement, submit-edited-prompt).
  const resetAndStartOrb = useCallback(() => {
    setImages([]);
    setSelectedId(null);
    setSessionId(null);
    setShowResults(false);
    setMessageIndex(0);
    setLoading(true);
    orbContainerScale.value = 0;
    orbContainerOpacity.value = 1;
    textOpacity.value = 1;
    orbScale.value = generation.breathMin;
    glowOpacity.value = generation.glowMin;
    startOrbAnimations();
  }, [startOrbAnimations]);

  // Regenerate — discard current set, run a fresh generation with the
  // current basePrompt (which may have been edited via the prompt-editor).
  const regenerate = useCallback(() => {
    haptic.light();
    resetAndStartOrb();
    generateArt(basePrompt);
  }, [basePrompt, resetAndStartOrb]);

  // Regenerate with an appended user refinement — composed against the
  // current basePrompt so refinements stack on top of any prompt edits.
  // The refinement text is NOT cleared after send so the user can
  // edit/extend it across iterations.
  const regenerateWithRefinement = useCallback(() => {
    const trimmed = refinement.trim();
    if (!trimmed) return;
    const effective = `${basePrompt}. Additional change: ${trimmed}`;
    haptic.light();
    resetAndStartOrb();
    generateArt(effective);
  }, [refinement, basePrompt, resetAndStartOrb]);

  // Open / close / submit the prompt-editor modal. Submitting replaces
  // basePrompt entirely and kicks off a fresh generation with the new text.
  const openPromptEditor = useCallback(() => {
    haptic.light();
    setEditingPrompt(basePrompt);
    setPromptEditOpen(true);
  }, [basePrompt]);

  const closePromptEditor = useCallback(() => {
    setPromptEditOpen(false);
  }, []);

  const submitPromptEdit = useCallback(() => {
    const trimmed = editingPrompt.trim();
    if (!trimmed) return;
    haptic.light();
    setBasePrompt(trimmed);
    setPromptEditOpen(false);
    resetAndStartOrb();
    generateArt(trimmed);
  }, [editingPrompt, resetAndStartOrb]);

  const styles = makeStyles(surfaces);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const orbContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbContainerScale.value }],
    opacity: orbContainerOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <SafeAreaWrapper>
      {/* Generation orb — visible while loading and during dissolution */}
      {!showResults && (
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.orbWrapper, orbContainerAnimatedStyle]}>
            {/* Glow ring */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: ORB_SIZE * 1.6,
                  height: ORB_SIZE * 1.6,
                  borderRadius: (ORB_SIZE * 1.6) / 2,
                  backgroundColor: surfaces.orb.ringColor,
                },
                glowAnimatedStyle,
              ]}
            />
            {/* Main orb */}
            <Animated.View
              style={[
                {
                  width: ORB_SIZE,
                  height: ORB_SIZE,
                  borderRadius: ORB_SIZE / 2,
                  overflow: 'hidden',
                },
                orbAnimatedStyle,
              ]}
            >
              <LinearGradient
                colors={colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: ORB_SIZE, height: ORB_SIZE }}
              />
            </Animated.View>
          </Animated.View>

          {/* Rotating text */}
          <Animated.Text
            style={[styles.loadingMessage, textAnimatedStyle]}
          >
            {LOADING_MESSAGES[messageIndex]}
          </Animated.Text>
        </View>
      )}

      {/* Results — emerge after orb dissolves */}
      {showResults && (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeIn.duration(fade.slow)}>
            <Text style={styles.title}>What emerged</Text>
            <Text style={styles.subtitle}>
              Take your time. Tap the one that feels right.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(fade.reverent).delay(generation.emerge.delay)}>
            <ImageGrid
              images={images}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Animated.View>

          {/* Refinement input — type a change to apply on top of the original prompt. */}
          <Animated.View entering={FadeIn.duration(fade.slow).delay(generation.emerge.delay + 150)}>
            <View style={styles.refinementRow}>
              <TextInput
                style={styles.refinementInput}
                value={refinement}
                onChangeText={setRefinement}
                placeholder="Describe a change…"
                placeholderTextColor={surfaces.text.tertiary}
                multiline
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={regenerateWithRefinement}
                blurOnSubmit
              />
              <Pressable
                onPress={regenerateWithRefinement}
                disabled={!refinement.trim()}
                style={[
                  styles.refinementSend,
                  !refinement.trim() && styles.refinementSendDisabled,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Apply this change and regenerate"
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={refinement.trim() ? '#FFFFFF' : surfaces.text.tertiary}
                />
              </Pressable>
            </View>
          </Animated.View>

          {/* Regenerate — reshuffle with the current base prompt. */}
          <Animated.View entering={FadeIn.duration(fade.slow).delay(generation.emerge.delay + 200)}>
            <Pressable
              onPress={regenerate}
              style={({ pressed }) => [
                styles.tryAgainButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Generate a new set of images"
            >
              <Ionicons name="refresh" size={16} color={surfaces.text.secondary} />
              <Text style={styles.tryAgainText}>Regenerate</Text>
            </Pressable>
          </Animated.View>

          {/* Edit prompt — replace the base prompt entirely, then regenerate. */}
          <Animated.View entering={FadeIn.duration(fade.slow).delay(generation.emerge.delay + 250)}>
            <Pressable
              onPress={openPromptEditor}
              style={({ pressed }) => [
                styles.editPromptButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit the prompt that generated these images"
            >
              <Ionicons name="pencil-outline" size={16} color={surfaces.text.secondary} />
              <Text style={styles.tryAgainText}>Edit prompt</Text>
            </Pressable>
          </Animated.View>

          {selectedId && (
            <Animated.View
              entering={FadeInUp.duration(enterConfig.content.duration)}
              style={styles.footer}
            >
              <Button
                title="Reflect"
                onPress={handleReflect}
                fullWidth
              />
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* Prompt editor — bottom sheet for replacing the base prompt. */}
      <Modal
        visible={promptEditOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePromptEditor}
      >
        <SafeAreaWrapper>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.editorContainer}>
              <View style={styles.editorHeader}>
                <Pressable
                  onPress={closePromptEditor}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                >
                  <Text style={styles.editorCancel}>Cancel</Text>
                </Pressable>
              </View>
              <Text style={styles.editorTitle}>Edit prompt</Text>
              <Text style={styles.editorSubtitle}>
                Rewrite what generated these.
              </Text>
              <Input
                value={editingPrompt}
                onChangeText={setEditingPrompt}
                multiline
                autoFocus
                containerStyle={styles.editorInput}
                placeholder="Describe what you want to see..."
              />
              <View style={styles.editorFooter}>
                <Button
                  title="Submit"
                  onPress={submitPromptEdit}
                  disabled={
                    editingPrompt.trim().length === 0 ||
                    editingPrompt.trim() === basePrompt.trim()
                  }
                  fullWidth
                  hapticWeight="medium"
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaWrapper>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMessage: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    color: surfaces.text.secondary,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    color: surfaces.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  editPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  tryAgainText: {
    ...typography.body,
    color: surfaces.text.secondary,
    fontWeight: '500',
  },
  // Prompt-editor modal
  editorContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: spacing.sm,
  },
  editorCancel: {
    ...typography.body,
    color: surfaces.text.secondary,
  },
  editorTitle: {
    ...typography.h2,
    color: surfaces.text.primary,
    marginTop: spacing.sm,
  },
  editorSubtitle: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  editorInput: {
    flex: 1,
  },
  editorFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  refinementRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: surfaces.colors.input,
    borderRadius: borderRadius.xxl,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
  },
  refinementInput: {
    flex: 1,
    ...typography.body,
    color: surfaces.text.primary,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  refinementSend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  refinementSendDisabled: {
    backgroundColor: surfaces.colors.ground,
  },
});
