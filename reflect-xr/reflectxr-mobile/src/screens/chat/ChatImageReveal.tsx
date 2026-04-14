import React from 'react';
import { StyleSheet, View, Pressable, Text, Dimensions, Alert, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatImageReveal() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { colors } = useTheme();
  const { imageUrl } = route.params;
  const styles = makeStyles(colors);

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out this artwork created by MindMate!\n\n${imageUrl}`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Close button */}
      <Animated.View entering={FadeIn.delay(300)} style={styles.closeContainer}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.textInverse} />
        </Pressable>
      </Animated.View>

      {/* Image */}
      <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={300}
        />
      </Animated.View>

      {/* Caption */}
      <Animated.View entering={FadeIn.delay(400)} style={styles.caption}>
        <Text style={styles.captionTitle}>Your MindMate Artwork</Text>
        <Text style={styles.captionSubtitle}>
          Created from the emotions in your conversation
        </Text>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeIn.delay(500)} style={styles.actions}>
        <Pressable onPress={handleReport} style={styles.actionButton} hitSlop={8}>
          <MaterialCommunityIcons name="message-alert-outline" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.actionText}>Report</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={styles.actionButton} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeContainer: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  captionTitle: {
    ...typography.h2,
    color: colors.textInverse,
    textAlign: 'center',
  },
  captionSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
});
