/**
 * MoodGraphCard — 14-day mood trend on the Home tab.
 *
 * One bar per day. Bar direction encodes valence (up = positive,
 * down = negative), magnitude = intensity of that day's dominant emotion,
 * color = theme color for that emotion. Days with no signal render as a
 * faint tick on the midline — the column stays visually present so the
 * chart reads as a rhythm, not a void.
 *
 * Color fallback: the theme palette (`colors.emotion`) covers ~18 canonical
 * feelings, but GPT-4o-mini returns a much wider vocabulary. When an
 * emotion isn't in the palette, we tint the bar using the theme's
 * secondary (positive) or accent (negative) color — so unknown emotions
 * still carry meaning, not just neutral lavender.
 *
 * States:
 *   - loading  — 3-bar faded skeleton
 *   - locked   — example bars @ opacity 0.35 + "Example" corner badge
 *                (when conversation_count + journal_count < 3)
 *   - unlocked — real bars at full opacity
 *
 * The card fetches its own data on focus; Home doesn't know or care.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import Surface from '../ui/Surface';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { getEmotionColor } from '../../utils/emotionColors';
import { enterConfig } from '../../theme/motion';
import type { AppColors } from '../../theme/colors';
import * as moodService from '../../services/moodService';
import type { MoodDay, MoodTimeseries } from '../../services/moodService';

// ── Geometry ────────────────────────────────────────────────────────────
const WINDOW_DAYS = 14;
const CHART_HEIGHT = 64;        // total chart area
const MID = CHART_HEIGHT / 2;   // y of the zero line
const MAX_BAR = MID - 4;        // leave a hair of top/bottom margin
const MIN_BAR = 3;              // still show something for tiny intensities
const BAR_GAP = 4;
const EMPTY_TICK_HEIGHT = 2;    // faint horizontal stub on days with no data

// `getEmotionColor` returns this string when the palette has no entry.
// Kept in sync with utils/emotionColors.ts DEFAULT_COLOR.
const DEFAULT_PALETTE_COLOR = '#B8B8D4';

// ── Example data (14 days, realistic spread) ───────────────────────────
// Used in the locked state. Emotion names intentionally chosen from the
// theme palette so colors render with real hues, not the neutral fallback.
const EXAMPLE_DAYS: MoodDay[] = [
  { date: 'e0',  dominant_emotion: 'joy',        intensity: 0.7, valence: 1 },
  { date: 'e1',  dominant_emotion: 'calm',       intensity: 0.55, valence: 1 },
  { date: 'e2',  dominant_emotion: 'gratitude',  intensity: 0.8, valence: 1 },
  { date: 'e3',  dominant_emotion: 'stress',     intensity: 0.65, valence: -1 },
  { date: 'e4',  dominant_emotion: 'hope',       intensity: 0.6, valence: 1 },
  { date: 'e5',  dominant_emotion: 'anxiety',    intensity: 0.45, valence: -1 },
  { date: 'e6',  dominant_emotion: 'calm',       intensity: 0.7, valence: 1 },
  { date: 'e7',  dominant_emotion: 'clarity',    intensity: 0.85, valence: 1 },
  { date: 'e8',  dominant_emotion: 'overwhelm',  intensity: 0.5, valence: -1 },
  { date: 'e9',  dominant_emotion: 'courage',    intensity: 0.75, valence: 1 },
  { date: 'e10', dominant_emotion: 'gratitude',  intensity: 0.6, valence: 1 },
  { date: 'e11', dominant_emotion: 'joy',        intensity: 0.8, valence: 1 },
  { date: 'e12', dominant_emotion: 'hope',       intensity: 0.7, valence: 1 },
  { date: 'e13', dominant_emotion: 'calm',       intensity: 0.65, valence: 1 },
];

/**
 * Resolve the bar color for an emotion:
 *   1. theme palette if it covers the emotion,
 *   2. else a valence-tinted fallback (secondary for +, accent for –),
 *   3. else the palette's neutral default.
 *
 * This is the fix for "gray line" complaints when real data contains
 * emotions the palette doesn't list explicitly.
 */
function resolveBarColor(
  emotion: string,
  valence: number,
  colors: AppColors,
): string {
  const themed = getEmotionColor(emotion, colors);
  if (themed && themed !== DEFAULT_PALETTE_COLOR) return themed;
  if (valence > 0) return colors.secondaryLight ?? colors.secondary;
  if (valence < 0) return colors.accentLight ?? colors.accent;
  return DEFAULT_PALETTE_COLOR;
}

// Build a fixed-length slot array for the last N days (oldest → newest).
// Backend returns only days that had signal; we project onto the window
// so the chart always has 14 equally-spaced columns.
function alignToWindow(days: MoodDay[]): (MoodDay | null)[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const slots: (MoodDay | null)[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Local-date ISO slug (YYYY-MM-DD). Using toISOString() here would
    // silently shift by the UTC offset and mis-align the window.
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    slots.push(byDate.get(iso) ?? null);
  }
  return slots;
}

interface BarsProps {
  slots: (MoodDay | null)[];
  midlineColor: string;
  colors: AppColors;
}

function Bars({ slots, midlineColor, colors }: BarsProps) {
  return (
    <View style={[styles.chart, { height: CHART_HEIGHT }]}>
      {slots.map((slot, i) => (
        <View key={slot?.date ?? `gap-${i}`} style={styles.column}>
          {slot ? (
            <Bar slot={slot} color={resolveBarColor(slot.dominant_emotion, slot.valence, colors)} />
          ) : (
            // Empty-day tick: keeps the column visually present without
            // implying a neutral reading. Thin stub centered on the midline.
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: MID - EMPTY_TICK_HEIGHT / 2,
                height: EMPTY_TICK_HEIGHT,
                borderRadius: 1,
                backgroundColor: midlineColor,
                opacity: 0.25,
              }}
            />
          )}
        </View>
      ))}
      {/* Mid-line — drawn above the bars so both directions read from it */}
      <View
        pointerEvents="none"
        style={[
          styles.midline,
          { top: MID, backgroundColor: midlineColor },
        ]}
      />
    </View>
  );
}

function Bar({ slot, color }: { slot: MoodDay; color: string }) {
  const magnitude = Math.max(MIN_BAR, Math.round(slot.intensity * MAX_BAR));
  // Positive valence: grow upward from mid; negative: grow downward.
  // Neutrals (valence 0) get a small centered bar straddling the midline.
  const isPositive = slot.valence > 0;
  const isNegative = slot.valence < 0;
  const top = isPositive
    ? MID - magnitude
    : isNegative
    ? MID
    : MID - Math.round(magnitude / 2);
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: magnitude,
        borderRadius: 3,
        backgroundColor: color,
      }}
    />
  );
}

export default function MoodGraphCard() {
  const { surfaces, colors } = useTheme();
  const styles2 = makeStyles(surfaces);
  const [data, setData] = useState<MoodTimeseries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await moodService.getMoodTimeseries(WINDOW_DAYS);
          if (!cancelled) {
            setData(res);
            setError(false);
          }
        } catch (err) {
          // Treat network/auth failures as "locked" — shows example data.
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Decide render state.
  const unlocked = !!data?.unlocked && !error;
  const progressTotal =
    (data?.conversation_count ?? 0) + (data?.journal_count ?? 0);
  const remaining = Math.max(0, 3 - progressTotal);

  const realSlots = data ? alignToWindow(data.days) : [];
  const exampleSlots: (MoodDay | null)[] = EXAMPLE_DAYS;
  const slotsToRender = unlocked ? realSlots : exampleSlots;

  const midlineColor = surfaces.text.tertiary;

  // Copy
  let sublabel = '';
  if (loading) sublabel = '';
  else if (unlocked) sublabel = 'Last 14 days';
  else if (progressTotal === 0) sublabel = 'Example';
  else sublabel = `${remaining} more to unlock`;

  return (
    <Animated.View entering={FadeIn.duration(enterConfig.content.duration).delay(150)}>
      <Surface role="ground" radius="xl" padded style={styles2.card}>
        <View style={styles2.header}>
          <Text style={styles2.title}>Your mood</Text>
          {sublabel ? (
            <Text style={styles2.sublabel}>{sublabel}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={[styles.chart, { height: CHART_HEIGHT }]}>
            {[0.4, 0.6, 0.3, 0.5, 0.35, 0.55, 0.45].map((h, i) => (
              <View key={i} style={styles.column}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: MID - h * 20,
                    height: h * 20,
                    borderRadius: 3,
                    backgroundColor: surfaces.text.tertiary,
                    opacity: 0.2,
                  }}
                />
              </View>
            ))}
            <View
              pointerEvents="none"
              style={[styles.midline, { top: MID, backgroundColor: midlineColor, opacity: 0.25 }]}
            />
          </View>
        ) : (
          <View style={unlocked ? undefined : styles2.lockedWrap}>
            <Bars slots={slotsToRender} midlineColor={midlineColor} colors={colors} />
          </View>
        )}

        {!loading && !unlocked ? (
          <Text style={styles2.lockedCopy}>
            {progressTotal === 0
              ? 'What your mood might look like — start a conversation or save a reflection to see your own trend.'
              : 'Keep going — your mood will show here after a few entries.'}
          </Text>
        ) : null}
      </Surface>
    </Animated.View>
  );
}

// ── Static (non-themed) styles ──────────────────────────────────────────
const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    gap: BAR_GAP,
    position: 'relative',
  },
  column: {
    flex: 1,
    position: 'relative',
  },
  midline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.35,
  },
});

// ── Themed styles ───────────────────────────────────────────────────────
const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.md,
      paddingVertical: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h3,
      color: surfaces.text.primary,
    },
    sublabel: {
      ...typography.caption,
      color: surfaces.text.tertiary,
    },
    lockedWrap: {
      opacity: 0.35,
    },
    lockedCopy: {
      ...typography.caption,
      color: surfaces.text.secondary,
      marginTop: spacing.md,
      lineHeight: 16,
    },
  });
