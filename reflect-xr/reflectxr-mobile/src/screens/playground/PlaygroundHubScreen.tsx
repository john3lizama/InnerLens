/**
 * PlaygroundHubScreen — landing screen for the Playground tab.
 *
 * Shows a vertical stack of feature banners. Each banner is the entry point
 * to one of the app's "playground" features:
 *
 *   1. ReflectXR Immersive → external Calendly link (Annaliese Schultz)
 *   2. MindMate            → Chat (existing chat experience)
 *   3. MindMate × Alexa    → AlexaSetup (BETA — skill-linking instructions)
 *   4. Siri Integration    → ReflectionEnvironment (TBD stub, coming soon)
 *
 * Each banner is a single tap target — tapping anywhere on the card
 * (including the visual button drawn inside the artwork) triggers the
 * destination. This mirrors the user's design intent: "User should be
 * able to click on the button in the banner or just simply tap on the
 * banner to enter that feature."
 *
 * Asset wiring: banners 1–3 use raster PNGs from `src/assets/images/`
 * (cropped to remove the dark-navy frame). Banner 4 (Siri Integration)
 * has `bannerImage: null` and renders the native PlaceholderCard with a
 * "COMING SOON" eyebrow until the design lands.
 */

import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Linking,
  Alert,
  ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import PressableSurface from '../../components/ui/PressableSurface';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Calendly booking link for the immersive AR/VR session with Annaliese Schultz.
const IMMERSIVE_BOOKING_URL = 'https://calendly.com/33_lieges-true/30min';

// Uniform card frame. 16:9 matches the banners' natural average
// (1.69 / 1.82 / 1.76) so each source is cropped by at most a few pixels on
// the edges under `contentFit="cover"`. Using aspectRatio (not a fixed
// pixel height) keeps the cards scaling cleanly across device widths.
const CARD_ASPECT_RATIO = 16 / 9;

interface PlaygroundCardConfig {
  key: string;
  /** Raster banner PNG. Pass `null` to render the native placeholder/stub. */
  bannerImage: ImageSourcePropType | null;
  /** Used by the placeholder/stub when bannerImage is null. */
  placeholder: {
    eyebrow: string;       // small label above title (e.g. "BETA")
    title: string;
    subtitle: string;
    /** Ionicons name; used on Android, or on iOS when `symbolName` is unset. */
    icon: keyof typeof Ionicons.glyphMap;
    /** Optional SF Symbol name. iOS only — falls back to `icon` on Android. */
    symbolName?: string;
    /** Optional dark-mode gradient for the card background.
        Mirrors the MindMate teaser on HomeScreen so the two placeholder
        surfaces share a visual family. */
    gradientColors?: readonly [string, string];
  };
  onPress: () => void;
  accessibilityLabel: string;
}

export default function PlaygroundHubScreen() {
  const navigation = useNavigation() as any;
  const { surfaces, isDark } = useTheme();
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
  //   4. Siri Integration (coming soon — native placeholder + gradient)
  const cards: PlaygroundCardConfig[] = [
    {
      key: 'immersive',
      bannerImage: require('../../assets/images/banner-immersive.png'),
      placeholder: {
        eyebrow: 'IMMERSIVE SESSIONS',
        title: 'Step Into Guided Reflection',
        subtitle:
          'Emotional healing through AR/VR, guided by Annaliese Schultz, MA — Art Therapy & XR Specialist.',
        icon: 'sparkles',
      },
      onPress: openImmersiveBooking,
      accessibilityLabel: 'Book an immersive session with Annaliese Schultz',
    },
    {
      key: 'mindmate',
      bannerImage: require('../../assets/images/banner-mindmate.png'),
      placeholder: {
        eyebrow: 'YOUR EMOTIONAL BUDDY',
        title: 'Chat, Feel, Create with MindMate',
        subtitle:
          'A safe space to talk, reflect, and turn emotions into beautiful visuals.',
        icon: 'chatbubbles',
      },
      onPress: () => navigation.navigate('Chat'),
      accessibilityLabel: 'Open MindMate chat',
    },
    {
      key: 'alexa',
      bannerImage: require('../../assets/images/banner-alexa.png'),
      placeholder: {
        eyebrow: 'HANDS-FREE SUPPORT · BETA',
        title: 'Talk It Out with MindMate + Alexa',
        subtitle:
          'Speak your feelings aloud. Reflect, release, and feel supported — just by talking.',
        icon: 'mic',
      },
      onPress: () => navigation.navigate('AlexaSetup'),
      accessibilityLabel: 'Connect Alexa to MindMate',
    },
    {
      key: 'siri',
      // No banner — this feature is still being designed.
      bannerImage: null,
      placeholder: {
        eyebrow: 'COMING SOON',
        title: 'Integration with Siri',
        subtitle:
          'Reflect with your voice. Siri shortcuts for quick thoughts, on their way.',
        icon: 'sparkles-outline', // Android fallback
        symbolName: 'siri',       // iOS: SF Symbols 5 (iOS 17+)
        // Same stops as the MindMate teaser on HomeScreen.
        gradientColors: ['#3B2E7A', '#1E1A2E'],
      },
      // Navigation target stays on the existing "TBD stub" screen — it's
      // the generic coming-soon surface and doesn't need a Siri-specific
      // route until the real integration lands.
      onPress: () => navigation.navigate('ReflectionEnvironment'),
      accessibilityLabel: 'Siri integration, coming soon',
    },
    {
      key: 'learning',
      // No banner — also a coming-soon stub, same pattern as Siri above.
      bannerImage: null,
      placeholder: {
        eyebrow: 'COMING SOON',
        title: 'Learning',
        subtitle:
          'Hands-on practices and guided lessons to deepen your reflection.',
        icon: 'create-outline',   // Android fallback — hand-drawn gesture
        symbolName: 'hand.draw.fill', // iOS: SF Symbols 3+ (iOS 15+)
        // Cooler indigo variant of the Siri purple — shifted hue so the
        // two placeholder cards read as siblings but are clearly
        // distinguishable sitting next to each other.
        gradientColors: ['#2E3D7A', '#1A1F2E'],
      },
      onPress: () => navigation.navigate('Learning'),
      accessibilityLabel: 'Learning, coming soon',
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
                  style={styles.bannerImage}
                  contentFit="cover"
                  accessibilityLabel={card.accessibilityLabel}
                />
              ) : (
                <>
                  {/* Dark-mode violet gradient behind the placeholder.
                      Mirrors the MindMate teaser on HomeScreen so the
                      two placeholder surfaces feel like the same
                      family. `pointerEvents="none"` keeps the whole
                      card pressable. `overflow: 'hidden'` on the card
                      style clips the gradient to the card's rounded
                      corners; the explicit `borderRadius` here is
                      defensive parity with the HomeScreen usage. */}
                  {isDark && card.placeholder.gradientColors && (
                    <LinearGradient
                      colors={card.placeholder.gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: borderRadius.xl },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  <PlaceholderCard
                    eyebrow={card.placeholder.eyebrow}
                    title={card.placeholder.title}
                    subtitle={card.placeholder.subtitle}
                    icon={card.placeholder.icon}
                    symbolName={card.placeholder.symbolName}
                    surfaces={surfaces}
                  />
                </>
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
  icon: keyof typeof Ionicons.glyphMap;
  /** Optional SF Symbol. iOS only — falls back to `icon` on Android. */
  symbolName?: string;
  surfaces: any;
}

// Horizontal, banner-like layout — chosen so the placeholder reads as a
// first-class sibling of the real banner cards in the shared 16:9 frame
// (~201 px tall at iPhone width). The prior vertical stack with a labeled
// CTA needed ~240 px and overflowed. The whole card is already pressable,
// so the chevron on the right is sufficient affordance — no explicit CTA
// button to mirror what the image-based banners show (none either).
function PlaceholderCard({
  eyebrow,
  title,
  subtitle,
  icon,
  symbolName,
  surfaces,
}: PlaceholderProps) {
  const styles = placeholderStyles(surfaces);
  return (
    <View style={styles.container}>
      <View style={styles.iconBubble}>
        {/* SF Symbols exist only on iOS. On Android (or when no
            `symbolName` is provided) fall back to the Ionicon. The
            `siri` glyph requires SF Symbols 5 / iOS 17+. */}
        {symbolName && Platform.OS === 'ios' ? (
          <SymbolView
            name={symbolName as any}
            size={24}
            type="monochrome"
            tintColor="#A89BFF"
          />
        ) : (
          <Ionicons name={icon} size={22} color="#A89BFF" />
        )}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={22}
        color={surfaces.text.secondary}
      />
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
      // so the rounded corners apply to the inner image cleanly. The shared
      // `aspectRatio` forces every card — banner or placeholder — to render
      // at the same height; prior per-card aspect ratios produced a ragged
      // column (≈197 → 260 px spread).
      overflow: 'hidden',
      aspectRatio: CARD_ASPECT_RATIO,
    },
    bannerImage: {
      // Fill the card's 16:9 frame; `contentFit="cover"` on the <Image>
      // element handles any minor mismatch between source art aspect and
      // the uniform frame with a symmetric edge crop.
      width: '100%',
      height: '100%',
    },
  });

const placeholderStyles = (surfaces: any) =>
  StyleSheet.create({
    // flex: 1 lets the container fill the parent card's 16:9 frame — the
    // iconBubble and chevron are fixed-width; textBlock claims the rest.
    container: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(108, 99, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      flex: 1,
    },
    eyebrow: {
      ...typography.caption,
      color: '#A89BFF',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      ...typography.h3,
      color: surfaces.text.primary,
      marginTop: 2,
    },
    subtitle: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
      marginTop: spacing.xs,
    },
  });
