import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import ConceptCard from '../../components/create/ConceptCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import { CreateStackParamList } from '../../navigation/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Concepts'>;

export default function ConceptsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<Nav>();

  const CONCEPT_COLORS = [
    colors.primary,
    colors.secondary,
    colors.accent,
    '#C4A8D4',
    '#B8C8D8',
  ];
  const { concepts, loading } = useConcepts();

  if (loading) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a Concept</Text>
          <Text style={styles.subtitle}>
            Each concept guides your creative exploration
          </Text>
        </View>
        <FlatList
          data={concepts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.duration(350).delay(index * 80)}>
              <ConceptCard
                title={item.title}
                description={item.prompt_template.replace('[DROPDOWN]', `[${item.dropdown_label}]`)}
                icon={conceptIcons[item.slug] || '✨'}
                accentColor={CONCEPT_COLORS[index % CONCEPT_COLORS.length]}
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate('PromptDesign', { concept: item });
                }}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    paddingBottom: 120,
  },
  separator: {
    height: spacing.md,
  },
});
