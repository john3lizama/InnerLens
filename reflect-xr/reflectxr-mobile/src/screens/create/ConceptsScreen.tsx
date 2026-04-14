import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import ConceptCard from '../../components/create/ConceptCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';

const CONCEPT_COLORS = [
  '#6C63FF', // primary
  '#7FB69E', // secondary
  '#E8837C', // accent
  '#C4A8D4', // lavender
  '#B8C8D8', // steel
];

export default function ConceptsScreen() {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const navigation = useNavigation() as any;
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
        {/* Header — calm, invitational */}
        <Animated.View entering={FadeIn.duration(enterConfig.quiet.duration)} style={styles.header}>
          <Text style={styles.title}>Where would you like to begin?</Text>
          <Text style={styles.subtitle}>
            Each of these holds a different kind of space.
          </Text>
        </Animated.View>

        <FlatList
          data={concepts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInUp
                .duration(enterConfig.content.duration)
                .delay(index * enterConfig.staggerDelay)
              }
            >
              <ConceptCard
                title={item.title}
                description={item.reflection_prompt}
                icon={conceptIcons[item.slug] || 'sparkles-outline'}
                accentColor={CONCEPT_COLORS[index % CONCEPT_COLORS.length]}
                onPress={() => {
                  haptic.selection();
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

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: surfaces.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: surfaces.text.secondary,
    marginTop: spacing.sm,
  },
  list: {
    paddingBottom: 120,
  },
  separator: {
    height: spacing.md,
  },
});
