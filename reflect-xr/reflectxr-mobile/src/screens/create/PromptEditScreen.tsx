/**
 * PromptEditScreen — Redesigned.
 *
 * Changes:
 * - Refined copy: "Your words" title, invitational subtitle
 * - Style badge uses surface tokens
 * - Input uses surface-token-aware Input component
 * - "Create" instead of "Generate Artwork" (single word, less aggressive)
 * - Uses medium haptic weight on the primary action
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { typography, spacing, borderRadius } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

export default function PromptEditScreen() {
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { surfaces } = useTheme();
  const { prompt, style, concept } = route.params;

  const [editedPrompt, setEditedPrompt] = useState(prompt);

  const handleSubmit = () => {
    navigation.navigate('Response', {
      prompt: editedPrompt,
      style,
      concept,
    });
  };

  const styles = makeStyles(surfaces);

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Animated.View entering={FadeIn.duration(enterConfig.quiet.duration)}>
            <Text style={styles.title}>Your words</Text>
            <Text style={styles.subtitle}>
              Add anything you'd like. Or leave it as is.
            </Text>
          </Animated.View>

          {/* Context badge: concept + style */}
          <View style={styles.contextRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{concept.title}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{style}</Text>
            </View>
          </View>

          <Input
            value={editedPrompt}
            onChangeText={setEditedPrompt}
            multiline
            containerStyle={styles.inputContainer}
            placeholder="Say more, if you want to..."
          />

          <View style={styles.footer}>
            <Button
              title="Create"
              onPress={handleSubmit}
              disabled={editedPrompt.trim().length === 0}
              fullWidth
              hapticWeight="medium"
            />
          </View>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h2,
    color: surfaces.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  contextRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: surfaces.overlay.primaryTint,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#6C63FF',
  },
  inputContainer: {
    flex: 1,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
});
