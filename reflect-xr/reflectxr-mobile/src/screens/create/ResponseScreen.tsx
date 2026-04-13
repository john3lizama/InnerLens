import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  withRepeat,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import ImageGrid from '../../components/create/ImageGrid';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { CreateStackParamList } from '../../navigation/types';
import { GeneratedImage } from '../../types/image';
import * as generateService from '../../services/generateService';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Response'>;
type Route = RouteProp<CreateStackParamList, 'Response'>;

const ORB_SIZE = 80;

const LOADING_MESSAGES = [
  'Translating your thoughts into form…',
  'Shaping your inner world…',
  'Bringing your emotions to light…',
];

export default function ResponseScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const { prompt, style, concept } = route.params;

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  // Orb animations
  const orbScale = useSharedValue(0.85);
  const glowOpacity = useSharedValue(0.3);
  const overlayOpacity = useSharedValue(0);
  const orbContainerScale = useSharedValue(0);
  const textOpacity = useSharedValue(1);

  const startOrbAnimations = useCallback(() => {
    // Morph in
    orbContainerScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    overlayOpacity.value = withTiming(0.3, { duration: 400 });

    // Breathing
    orbScale.value = withRepeat(
      withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    glowOpacity.value = withRepeat(
      withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [orbScale, glowOpacity, overlayOpacity, orbContainerScale]);

  const stopOrbAnimations = useCallback(() => {
    orbContainerScale.value = withTiming(0, { duration: 300 });
    overlayOpacity.value = withTiming(0, { duration: 300 });
  }, [orbContainerScale, overlayOpacity]);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startOrbAnimations();
    generateArt();
  }, []);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 }),
      );
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 300);
    }, 3000);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Image generation failed:', err);
      Alert.alert('Generation Failed', 'Could not generate images. Please try again.', [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
    } finally {
      stopOrbAnimations();
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

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

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const orbContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbContainerScale.value }],
    opacity: orbContainerScale.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          {/* Dim overlay */}
          <Animated.View style={[styles.overlay, overlayAnimatedStyle]} />

          {/* Orb */}
          <Animated.View style={[styles.orbWrapper, orbContainerAnimatedStyle]}>
            {/* Glow ring */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: ORB_SIZE * 1.6,
                  height: ORB_SIZE * 1.6,
                  borderRadius: (ORB_SIZE * 1.6) / 2,
                  backgroundColor: colors.primary + '18',
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
                colors={[...colors.gradient.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: ORB_SIZE, height: ORB_SIZE }}
              />
            </Animated.View>
          </Animated.View>

          {/* Rotating text */}
          <Animated.Text
            style={[styles.loadingMessage, { color: colors.textSecondary }, textAnimatedStyle]}
          >
            {LOADING_MESSAGES[messageIndex]}
          </Animated.Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)}>
          <Text style={styles.title}>Your Artwork</Text>
          <Text style={styles.subtitle}>
            Tap an image that resonates with you
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <ImageGrid
            images={images}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Animated.View>

        {selectedId && (
          <Animated.View
            entering={FadeInUp.duration(400).delay(300)}
            style={styles.footer}
          >
            <Button
              title="Reflect on This"
              onPress={handleReflect}
              fullWidth
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  orbWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMessage: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
});
