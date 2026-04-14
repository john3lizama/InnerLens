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
import { StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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
import ImageGrid from '../../components/create/ImageGrid';
import { typography, spacing } from '../../theme';
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

  const generateArt = async () => {
    try {
      const res = await generateService.generateImages(prompt, style, concept.id, 2);
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

          {selectedId && (
            <Animated.View
              entering={FadeInUp.duration(enterConfig.content.duration)}
              style={styles.footer}
            >
              <Button
                title="Sit with this"
                onPress={handleReflect}
                fullWidth
              />
            </Animated.View>
          )}
        </ScrollView>
      )}
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
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
});
