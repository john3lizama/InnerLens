import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import Dropdown from '../../components/ui/Dropdown';
import StylePicker from '../../components/create/StylePicker';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useConcepts } from '../../hooks/useConcepts';
import { CreateStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'PromptDesign'>;
type Route = RouteProp<CreateStackParamList, 'PromptDesign'>;

export default function PromptDesignScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
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
          {selectedOption || `[${concept.dropdown_label}]`}
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
        <Text style={styles.title}>{concept.title}</Text>

        {/* Prompt Preview */}
        <View style={styles.previewCard}>
          {renderPromptPreview()}
        </View>

        {/* Emotion Dropdown */}
        <View style={styles.section}>
          <Dropdown
            label={concept.dropdown_label}
            options={concept.dropdown_options}
            selectedValue={selectedOption}
            onSelect={setSelectedOption}
            placeholder={`Choose ${concept.dropdown_label.toLowerCase()}...`}
          />
        </View>

        {/* Style Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pick a Style</Text>
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
            title="Next"
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

const makeStyles = (colors: any) => StyleSheet.create({
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
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  promptPreview: {
    ...typography.body,
    color: colors.text,
    lineHeight: 26,
  },
  promptHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
