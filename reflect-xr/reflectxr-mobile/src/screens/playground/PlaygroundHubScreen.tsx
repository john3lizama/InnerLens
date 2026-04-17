/**
 * PlaygroundHubScreen — landing screen for the Playground tab.
 *
 * Shows a vertical stack of feature banners. Each banner is the entry point
 * to one of the app's "playground" features:
 *
 *   1. ReflectXR Immersive → external Calendly link (Annaliese Schultz)
 *   2. MindMate            → Chat (existing chat experience)
 *   3. MindMate × Alexa    → AlexaSetup (BETA — skill-linking instructions)
 *   4. Reflection Env.     → ReflectionEnvironment (TBD stub)
 *
 * Each banner is a single tap target — tapping anywhere on the card
 * (including the visual button drawn inside the artwork) triggers the
 * destination. This mirrors the user's design intent: "User should be
 * able to click on the button in the banner or just simply tap on the
 * banner to enter that feature."
 *
 * Asset wiring: banners 1–3 use raster PNGs from `src/assets/images/`
 * (cropped to remove the dark-navy frame). Banner 4 (Reflection Env.)
 * has `bannerImage: null` and renders the native PlaceholderCard with a
 * "COMING SOON" eyebrow until the design lands.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Linking,
  Alert,
  ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import PressableSurface from '../../components/ui/PressableSurface';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Calendly booking link for the immersive AR/VR session with Annaliese Schultz.
const IMMERSIVE_BOOKING_URL = 'https://calendly.com/33_lieges-true/30min';

interface PlaygroundCardConfig {
  key: string;
  /** Raster banner PNG. Pass `null` to render the native placeholder/stub. */
  bannerImage: ImageSourcePropType | null;
  /**
   * Aspect ratio (width / height) of the banner artwork. Each cropped
   * screenshot has slightly different proportions, so we set this per
   * card rather than forcing a uniform 16:9.
   */
  bannerAspect: number;
  /** Used by the placeholder/stub when bannerImage is null. */
  placeholder: {
    eyebrow: string;       // small label above title (e.g. "BETA")
    title: string;
    subtitle: string;
    cta: string;
    icon: keyof typeof Ionicons.glyphMap;
  };
  onPress: () => void;
  accessibilityLabel: string;
}

export default function PlaygroundHubScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  const openImmersiveBooking = async () => {
    try {
      await Linking.openURL(IMMERSIVE_BOOKING_URL);
    } catch (err) {
      console.error('Failed to open booking URL:', err);
      Alert.alert(
        'Cannot open link',
        'Please try again, or copy this link into your browser:\n\n' +
          IMMERSIVE_BOOKING_URL,
      );
    }
  };

  // Display order (top → bottom):
  //   1. Guided Reflection (immersive AR/VR) — headline feature
  //   2. MindMate (chat)
  //   3. MindMate + Alexa (beta voice support)
  //   4. Reflection Environment (coming soon — native placeholder)
  const cards: PlaygroundCardConfig[] = [
    {
      key: 'immersive',
      bannerImage: require('../../assets/images/banner-immersive.png'),
      bannerAspect: 1211 / 715,
      placeholder: {
        eyebrow: 'IMMERSIVE SESSIONS',
        title: 'Step Into Guided Reflection',
        subtitle:
          'Emotional healing through AR/VR, guided by Annaliese Schultz, MA — Art Therapy & XR Specialist.',
        cta: 'Start Session',
        icon: 'sparkles',
      },
      onPress: openImmersiveBooking,
      accessibilityLabel: 'Book an immersive session with Annaliese Schultz',
    },
    {
      key: 'mindmate',
      bannerImage: require('../../assets/images/banner-mindmate.png'),
      bannerAspect: 1413 / 778,
      placeholder: {
        eyebrow: 'YOUR EMOTIONAL BUDDY',
        title: 'Chat, Feel, Create with MindMate',
        subtitle:
          'A safe space to talk, reflect, and turn emotions into beautiful visuals.',
        cta: 'Chat with MindMate',
        icon: 'chatbubbles',
      },
      onPress: () => navigation.navigate('Chat'),
      accessibilityLabel: 'Open MindMate chat',
    },
    {
      key: 'alexa',
      bannerImage: require('../../assets/images/banner-alexa.png'),
      bannerAspect: 1915 / 1091,
      placeholder: {
        eyebrow: 'HANDS-FREE SUPPORT · BETA',
        title: 'Talk It Out with MindMate + Alexa',
        subtitle:
          'Speak your feelings aloud. Reflect, release, and feel supported — just by talking.',
        cta: 'Connect Alexa',
        icon: 'mic',
      },
      onPress: () => navigation.navigate('AlexaSetup'),
      accessibilityLabel: 'Connect Alexa to MindMate',
    },
    {
      key: 'reflection-env',
      // No banner — this feature is still being designed.
      bannerImage: null,
      bannerAspect: 16 / 9,
      placeholder: {
        eyebrow: 'COMING SOON',
        title: 'Reflection Environment',
        subtitle:
          'Step into ambient scenes designed to settle your mind. Crafted with care, on its way.',
        cta: 'Preview',
        icon: 'leaf',
      },
      onPress: () => navigation.navigate('ReflectionEnvironment'),
      accessibilityLabel: 'Preview Reflection Environments (coming soon)',
    },
  ];

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Playground</Text>
        <Text style={styles.subtitle}>
          A collection of our most immersive features.
        </Text>

        <View style={styles.cards}>
          {cards.map((card) => (
            <PressableSurface
              key={card.key}
              role="raised"
              radius="xl"
              onPress={() => {
                Haptics.selectionAsync();
                card.onPress();
              }}
              style={styles.card}
            >
              {card.bannerImage ? (
                <Image
                  source={card.bannerImage}
                  style={[styles.bannerImage, { aspectRatio: card.bannerAspect }]}
                  contentFit="cover"
                  accessibilityLabel={card.accessibilityLabel}
                />
              ) : (
                <PlaceholderCard
                  eyebrow={card.placeholder.eyebrow}
                  title={card.placeholder.title}
                  subtitle={card.placeholder.subtitle}
                  cta={card.placeholder.cta}
                  icon={card.placeholder.icon}
                  surfaces={surfaces}
                />
              )}
            </PressableSurface>
          ))}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaceholderCard — used until the cropped banner PNGs are available.
// Also used permanently for the "Reflection Environment" tile (no banner).
// ─────────────────────────────────────────────────────────────────────────────

interface PlaceholderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  surfaces: any;
}

function PlaceholderCard({
  eyebrow,
  title,
  subtitle,
  cta,
  icon,
  surfaces,
}: PlaceholderProps) {
  const styles = placeholderStyles(surfaces);
  return (
    <View style={styles.container}>
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={28} color="#A89BFF" />
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>{cta}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 120,
    },
    title: {
      ...typography.h1,
      color: surfaces.text.primary,
    },
    subtitle: {
      ...typography.body,
      color: surfaces.text.secondary,
      marginTop: spacing.xs,
      marginBottom: spacing.xl,
    },
    cards: {
      gap: spacing.lg,
    },
    card: {
      // The card itself is just a tap-target wrapper. The banner image (or
      // placeholder) sits inside and handles its own layout. We clip overflow
      // so the rounded corners apply to the inner image cleanly.
      overflow: 'hidden',
    },
    bannerImage: {
      width: '100%',
      // aspectRatio is set per-card via inline style (each cropped banner
      // has slightly different proportions).
    },
  });

const placeholderStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      padding: spacing.xl,
      gap: spacing.sm,
    },
    iconBubble: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(108, 99, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    eyebrow: {
      ...typography.caption,
      color: '#A89BFF',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      ...typography.h2,
      color: surfaces.text.primary,
    },
    subtitle: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
      marginTop: spacing.xs,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: '#6C63FF',
      borderRadius: borderRadius.lg,
      alignSelf: 'flex-start',
    },
    cta: {
      ...typography.button,
      color: '#fff',
    },
  });
