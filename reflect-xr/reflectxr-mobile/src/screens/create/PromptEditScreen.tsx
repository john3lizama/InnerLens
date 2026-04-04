import React, { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { CreateStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'PromptEdit'>;
type Route = RouteProp<CreateStackParamList, 'PromptEdit'>;

export default function PromptEditScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const { prompt, style, concept } = route.params;

  const [editedPrompt, setEditedPrompt] = useState(prompt);

  const handleSubmit = () => {
    navigation.navigate('Response', {
      prompt: editedPrompt,
      style,
      concept,
    });
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Edit Your Prompt</Text>
          <Text style={styles.subtitle}>
            Fine-tune the prompt before generating your artwork
          </Text>

          <View style={styles.styleBadge}>
            <Text style={styles.styleLabel}>Style:</Text>
            <Text style={styles.styleName}>{style}</Text>
          </View>

          <Input
            label="Your Prompt"
            value={editedPrompt}
            onChangeText={setEditedPrompt}
            multiline
            containerStyle={styles.inputContainer}
            placeholder="Describe what you'd like to create..."
          />

          <View style={styles.footer}>
            <Button
              title="Generate Artwork"
              onPress={handleSubmit}
              disabled={editedPrompt.trim().length === 0}
              fullWidth
            />
          </View>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  styleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlay.primary,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  styleLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  styleName: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  inputContainer: {
    flex: 1,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
});
