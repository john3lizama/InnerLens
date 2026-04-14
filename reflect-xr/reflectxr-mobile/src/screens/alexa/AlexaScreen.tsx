import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmotionTag from '../../components/ui/EmotionTag';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeDate } from '../../utils/formatDate';
import * as alexaService from '../../services/alexaService';
import type { AlexaGalleryItem } from '../../services/alexaService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = spacing.md;
const IMAGE_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - COLUMN_GAP) / 2;

export default function AlexaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation() as any;
  const [items, setItems] = useState<AlexaGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGallery();
    }, []),
  );

  const loadGallery = async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await alexaService.getAlexaGallery();
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load Alexa gallery:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Flatten to individual images with session context
  const galleryImages = items.flatMap((item) =>
    item.images.map((img) => ({
      ...img,
      emotion_tags: item.emotion_tags,
      session_created_at: item.created_at,
    })),
  );

  return (
    <SafeAreaWrapper gradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Alexa Voice Art</Text>
          </View>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="mic" size={28} color={colors.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Talk to MindMate via Alexa</Text>
                <Text style={styles.infoDesc}>
                  Say{' '}
                  <Text style={styles.invocation}>"Alexa, open Mind Mate"</Text>
                  {' '}and share how you feel. Artwork is generated from your
                  voice conversation and appears here.
                </Text>
              </View>
            </View>
            <View style={styles.stepsRow}>
              {[
                { icon: 'mic-outline' as const, label: 'Speak' },
                { icon: 'chatbubble-ellipses-outline' as const, label: 'Chat' },
                { icon: 'color-palette-outline' as const, label: 'Art appears' },
              ].map((step, i) => (
                <View key={step.label} style={styles.step}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={step.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  {i < 2 && (
                    <Ionicons
                      name="arrow-forward"
                      size={12}
                      color={colors.textTertiary}
                      style={styles.stepArrow}
                    />
                  )}
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Gallery Section */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)}>
          <Text style={styles.sectionTitle}>Voice Artwork</Text>
        </Animated.View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Could not load gallery</Text>
            <Button title="Retry" variant="secondary" onPress={loadGallery} />
          </View>
        )}

        {!loading && !error && galleryImages.length === 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.centered}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No artwork yet</Text>
            <Text style={styles.emptyText}>
              Try saying "Alexa, open Mind Mate" and have a conversation.
              After a few messages, artwork will be generated automatically.
            </Text>
          </Animated.View>
        )}

        {!loading && !error && galleryImages.length > 0 && (
          <View style={styles.grid}>
            {galleryImages.map((img, index) => (
              <Animated.View
                key={img.id}
                entering={FadeInUp.duration(350).delay(300 + index * 60)}
              >
                <Pressable
                  style={styles.galleryCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate('AlexaImageReveal', {
                      imageUrl: img.image_url,
                    });
                  }}
                >
                  <Image
                    source={{ uri: img.thumbnail_url || img.image_url }}
                    style={styles.galleryImage}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.galleryMeta}>
                    <Text style={styles.galleryDate}>
                      {formatRelativeDate(img.session_created_at)}
                    </Text>
                    {img.emotion_tags && img.emotion_tags.length > 0 && (
                      <View style={styles.emotionRow}>
                        {img.emotion_tags.slice(0, 2).map((tag) => (
                          <EmotionTag
                            key={tag.emotion}
                            emotion={tag.emotion}
                            intensity={tag.intensity}
                            size="small"
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.overlay.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    title: {
      ...typography.h1,
      color: colors.text,
    },

    // Info card
    infoCard: {
      marginBottom: spacing.xl,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    infoIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: `${colors.accent}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    infoDesc: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    invocation: {
      fontWeight: '700',
      color: colors.primary,
    },
    stepsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${colors.primary}12`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    stepLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    stepArrow: {
      marginHorizontal: spacing.sm,
    },

    // Gallery
    sectionTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: COLUMN_GAP,
    },
    galleryCard: {
      width: IMAGE_SIZE,
      backgroundColor: colors.card,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      ...shadow.md,
    },
    galleryImage: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
    },
    galleryMeta: {
      padding: spacing.sm,
    },
    galleryDate: {
      ...typography.caption,
      color: colors.textTertiary,
      marginBottom: spacing.xs,
    },
    emotionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },

    // States
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.md,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.textTertiary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.text,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
  });
