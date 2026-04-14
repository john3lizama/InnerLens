/**
 * PromptDesignScreen — Redesigned.
 *
 * Changes:
 * - Replaced Dropdown with inline Chip selectors (flexWrap layout)
 * - Uses surface tokens throughout
 * - Refined copy: "Choose a style" instead of "Pick a Style"
 * - Prompt preview uses elevated Surface
 * - One meaningful decision per visual section
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Surface from '../../components/ui/Surface';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import StylePicker from '../../components/create/StylePicker';
import { typography, spacing } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useConcepts } from '../../hooks/useConcepts';

export default function PromptDesignScreen() {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { concept } = route.params;
  const { styles: artStyles, styleCategories } = useConcepts();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedStyleName, setSelectedStyleName] = useState<string>('');

  const canProceed = selectedOption !== null && selectedStyleId !== null;

  const handleNext = () => {
    if (!canProceed) return;
    const assembledPrompt = concept.prompt_template.replace(
      '[DROPDOWN]',
      selectedOption!
    );
    navigation.navigate('PromptEdit', {
      prompt: assembledPrompt,
      style: selectedStyleName,
      concept,
    });
  };

  // Render the prompt template with the selected word highlighted
  const renderPromptPreview = () => {
    const parts = concept.prompt_template.split('[DROPDOWN]');
    return (
      <Text style={styles.promptPreview}>
        {parts[0]}
        <Text style={styles.promptHighlight}>
          {selectedOption || `[${concept.dropdown_label.toLowerCase()}]`}
        </Text>
        {parts[1]}
      </Text>
    );
  };

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(enterConfig.quiet.duration)}>
          <Text style={styles.title}>{concept.title}</Text>
        </Animated.View>

        {/* Prompt Preview */}
        <Surface role="elevated" padded radius="xl" style={styles.previewCard}>
          {renderPromptPreview()}
        </Surface>

        {/* Emotion/Option Selection — inline chips instead of dropdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {concept.dropdown_label}
          </Text>
          <View style={styles.chipGrid}>
            {concept.dropdown_options.map((option: string) => (
              <Chip
                key={option}
                label={option}
                selected={selectedOption === option}
                onPress={() => setSelectedOption(option)}
              />
            ))}
          </View>
        </View>

        {/* Style Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose a style</Text>
          <StylePicker
            styles_list={artStyles}
            categories={styleCategories}
            selectedId={selectedStyleId}
            onSelect={(id, name) => {
              setSelectedStyleId(id);
              setSelectedStyleName(name);
            }}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Continue"
            onPress={handleNext}
            disabled={!canProceed}
            fullWidth
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h2,
    color: surfaces.text.primary,
    marginBottom: spacing.lg,
  },
  previewCard: {
    marginBottom: spacing.xl,
  },
  promptPreview: {
    ...typography.body,
    color: surfaces.text.primary,
    lineHeight: 26,
  },
  promptHighlight: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: surfaces.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
