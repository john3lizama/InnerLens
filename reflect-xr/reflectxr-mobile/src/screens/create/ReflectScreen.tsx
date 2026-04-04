import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ReflectionPrompt from '../../components/create/ReflectionPrompt';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { CreateStackParamList } from '../../navigation/types';

type Route = RouteProp<CreateStackParamList, 'Reflect'>;

export default function ReflectScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const { image, concept } = route.params;

  const [journalText, setJournalText] = useState('');
  const [saving, setSaving] = useState(false);
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
        message: `Check out this artwork I created with ReflectXR!\n\n${image.image_url}`,
      });
    } catch {}
  };

  const handleSave = async () => {
    if (!journalText.trim()) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Simulate saving to backend
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);

    Alert.alert(
      'Reflection Saved',
      'Your journal entry has been saved.',
      [
        {
          text: 'Done',
          onPress: () => navigation.popToTop(),
        },
      ]
    );
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
          <Text style={styles.title}>Reflect</Text>

          {/* Selected Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: image.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <Pressable onPress={handleReport} style={styles.actionButton} hitSlop={8}>
              <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>Report</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={styles.actionButton} hitSlop={8}>
              <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
          </View>

          {/* Reflection Question */}
          <ReflectionPrompt prompt={concept.reflection_prompt} />

          {/* Journal Input */}
          <View style={styles.journalSection}>
            <Input
              label="Your Thoughts"
              value={journalText}
              onChangeText={setJournalText}
              multiline
              placeholder="What stands out to you about this artwork? How does it connect to how you feel?"
              containerStyle={styles.journalInput}
            />
          </View>

          <View style={styles.footer}>
            <Button
              title="Save Reflection"
              onPress={handleSave}
              loading={saving}
              disabled={journalText.trim().length === 0}
              fullWidth
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
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
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  journalSection: {
    marginTop: spacing.lg,
  },
  journalInput: {
    minHeight: 140,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
