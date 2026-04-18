import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import BentoConceptCard from '../../components/create/BentoConceptCard';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useConcepts } from '../../hooks/useConcepts';
import { conceptIcons } from '../../data/mockConcepts';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';

// ── Accent palette — cycles across concepts in list order.
//    Same 5 colors as the pre-redesign ConceptCard so the emotional
//    assignment each concept has (water = violet, safety = green, etc.)
//    doesn't shift under users' feet.
const CONCEPT_COLORS = [
  '#6C63FF', // primary
  '#7FB69E', // secondary
  '#E8837C', // accent
  '#C4A8D4', // lavender
  '#B8C8D8', // steel
];

// Row gap inside half-pair rows.
const ROW_GAP = 12;

// ──────────────────────────────────────────────────────────────────
// Layout builder — bento rhythm.
// For each concept at position `i`:
//   i % 3 === 0 → full-width feature tile
//   i % 3 === 1 → buffered (waits for partner)
//   i % 3 === 2 → flushes the buffered half + self as a pair row
// A trailing lone half at the end renders as a single half tile on
// its own row (no orphan full-expansion — keeps the visual grid
// honest even when list length doesn't divide by 3).
// ──────────────────────────────────────────────────────────────────
type Row =
  | { type: 'full'; item: any; index: number }
  | { type: 'pair'; items: Array<{ item: any; index: number }> };

function buildBentoRows(concepts: any[]): Row[] {
  const rows: Row[] = [];
  let buffer: { item: any; index: number } | null = null;

  concepts.forEach((item, index) => {
    if (index % 3 === 0) {
      // Flush any trailing half into its own row before starting
      // a new full-width section.
      if (buffer) {
        rows.push({ type: 'pair', items: [buffer] });
        buffer = null;
      }
      rows.push({ type: 'full', item, index });
    } else if (index % 3 === 1) {
      buffer = { item, index };
    } else {
      // index % 3 === 2 — close the pair
      if (buffer) {
        rows.push({ type: 'pair', items: [buffer, { item, index }] });
        buffer = null;
      }
    }
  });

  // Trailing lone half at the list tail.
  if (buffer) {
    rows.push({ type: 'pair', items: [buffer] });
  }

  return rows;
}

// ──────────────────────────────────────────────────────────────────
// BentoItem — animated wrapper that staggers entrance.
// Combines fade + up-translate + scale so each tile "rises and
// settles into place" as the screen mounts. Uses Reanimated shared
// values directly (rather than FadeInUp presets) because the preset
// entering animations don't compose scale into the fade/translate.
// ──────────────────────────────────────────────────────────────────
function BentoItem({
  index,
  style,
  children,
}: {
  index: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  const translateY = useSharedValue(16);

  useEffect(() => {
    const delay = index * enterConfig.staggerDelay;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 18, stiffness: 140 })
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 18, stiffness: 140 })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

export default function ConceptsScreen() {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const navigation = useNavigation() as any;
  const { concepts, loading } = useConcepts();

  const rows = useMemo(() => buildBentoRows(concepts ?? []), [concepts]);

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
        <Animated.View
          entering={FadeIn.duration(enterConfig.quiet.duration)}
          style={styles.header}
        >
          <Text style={styles.title}>Where would you like to begin?</Text>
          <Text style={styles.subtitle}>
            Each of these holds a different kind of space.
          </Text>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {rows.map((row, rowIndex) => {
            if (row.type === 'full') {
              const { item, index } = row;
              return (
                <BentoItem key={item.id} index={index} style={styles.rowSpacing}>
                  <BentoConceptCard
                    variant="full"
                    title={item.title}
                    description={item.reflection_prompt}
                    icon={conceptIcons[item.slug] || 'sparkles-outline'}
                    accentColor={
                      CONCEPT_COLORS[index % CONCEPT_COLORS.length]
                    }
                    onPress={() => {
                      haptic.selection();
                      navigation.navigate('PromptDesign', { concept: item });
                    }}
                  />
                </BentoItem>
              );
            }

            // Half-pair row. May contain 1 or 2 items (tail orphan).
            return (
              <View
                key={`pair-${rowIndex}`}
                style={[styles.halfRow, styles.rowSpacing]}
              >
                {row.items.map(({ item, index }) => (
                  <BentoItem
                    key={item.id}
                    index={index}
                    style={styles.halfItem}
                  >
                    <BentoConceptCard
                      variant="half"
                      title={item.title}
                      description={item.reflection_prompt}
                      icon={conceptIcons[item.slug] || 'sparkles-outline'}
                      accentColor={
                        CONCEPT_COLORS[index % CONCEPT_COLORS.length]
                      }
                      onPress={() => {
                        haptic.selection();
                        navigation.navigate('PromptDesign', { concept: item });
                      }}
                    />
                  </BentoItem>
                ))}
                {/* Tail orphan: a lone half gets an invisible spacer so
                    it sits on the left half of its row instead of
                    stretching to full-width. */}
                {row.items.length === 1 && <View style={styles.halfItem} />}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
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
    // Every row — full or half-pair — gets the same vertical gap,
    // replacing the old `ItemSeparatorComponent` pattern.
    rowSpacing: {
      marginBottom: spacing.md,
    },
    halfRow: {
      flexDirection: 'row',
      gap: ROW_GAP,
    },
    halfItem: {
      flex: 1,
    },
  });
