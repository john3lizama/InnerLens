/**
 * MoodGraphCard — 7-day mood trend on the Home tab.
 *
 * Stacked-segment pill design: every day renders as one rounded pill
 * that fills 100% of the chart height, with vertical bands proportional
 * to each valence bucket's intensity-weighted share of that day. A day
 * with only positive activity is a solid mint pill; a day mixing all
 * three valences shows three stacked bands summing to the full pill
 * height — largest at the base. A faint single-color track marks days
 * with no signal. A single-letter weekday label sits below each column.
 * The card closes with a 3-chip legend (Positive / Negative / Neutral)
 * so bar colors are self-explanatory without requiring hover.
 *
 * Bucket resolution: the backend already folds raw emotions onto their
 * valence sign (+1/-1/0) and emits shares keyed as "positive" /
 * "negative" / "neutral", so the client just maps bucket → color via
 * `colors.mood.<bucket>`. Same hex in light and dark so each chip
 * reads against both card fills.
 *
 * States:
 *   - loading  — 7 faded pill silhouettes
 *   - locked   — example bars @ opacity 0.35 + "start a conversation…"
 *                copy (when conversation_count + journal_count < 3)
 *   - unlocked — real bars at full opacity
 *
 * The card fetches its own data on focus; Home doesn't know or care.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import Surface from '../ui/Surface';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { enterConfig } from '../../theme/motion';
import type { AppColors } from '../../theme/colors';
import {
  MOOD_BUCKETS,
  bucketFor,
  toSegments,
  type BucketKey,
} from '../../utils/emotionBuckets';
import { formatDayOfWeek } from '../../utils/formatDate';
import * as moodService from '../../services/moodService';
import type { MoodDay, MoodTimeseries } from '../../services/moodService';

// ── Geometry ────────────────────────────────────────────────────────────
const WINDOW_DAYS = 7;
const CHART_HEIGHT = 96;
const BAR_GAP = 8;
const PILL_RADIUS = 9999;
const EMPTY_TRACK_OPACITY = 0.08;
const BUCKET_LABELS: Record<BucketKey, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral:  'Neutral',
};

// Label color per bucket. All three bucket hexes are soft light tints
// (mint / rose / periwinkle), so dark body text reads cleanly on every
// band in both light and dark mode — no per-bucket inversion needed.
const BUCKET_LABEL_COLOR: Record<BucketKey, string> = {
  positive: '#2D2B3D',
  negative: '#2D2B3D',
  neutral:  '#2D2B3D',
};

// ── Example data (7 days, 3 valence buckets) ──────────────────────────
// Drives the locked-state preview. Mix of solid pills (one bucket), 2-
// band (two buckets), and one 3-band day so the segmented look is
// visible before a real user has any data. Shape mirrors the backend
// /mood/timeseries payload — `emotion` is already "positive" /
// "negative" / "neutral" with matching valence sign, so the client
// rendering path is exercised identically to the unlocked view.
const EXAMPLE_EMOTIONS: MoodDay[] = [
  {
    date: 'e0',
    emotions: [
      { emotion: 'positive', share: 0.8, valence: 1 },
      { emotion: 'neutral',  share: 0.2, valence: 0 },
    ],
  },
  {
    date: 'e1',
    emotions: [
      { emotion: 'positive', share: 0.5, valence: 1 },
      { emotion: 'negative', share: 0.3, valence: -1 },
      { emotion: 'neutral',  share: 0.2, valence: 0 },
    ],
  },
  {
    date: 'e2',
    emotions: [
      { emotion: 'positive', share: 1.0, valence: 1 },
    ],
  },
  {
    date: 'e3',
    emotions: [
      { emotion: 'negative', share: 0.6, valence: -1 },
      { emotion: 'positive', share: 0.4, valence: 1 },
    ],
  },
  {
    date: 'e4',
    emotions: [
      { emotion: 'negative', share: 0.7, valence: -1 },
      { emotion: 'neutral',  share: 0.3, valence: 0 },
    ],
  },
  {
    date: 'e5',
    emotions: [
      { emotion: 'negative', share: 1.0, valence: -1 },
    ],
  },
  {
    date: 'e6',
    emotions: [
      { emotion: 'neutral',  share: 0.6, valence: 0 },
      { emotion: 'positive', share: 0.4, valence: 1 },
    ],
  },
];

interface Slot {
  date: string;          // YYYY-MM-DD (local) — drives weekday letter
  mood: MoodDay | null;
}

// Build a 7-slot array (oldest → newest) keyed on the local calendar
// date, then project the backend signal onto it. Absent dates stay null.
function alignToWindow(days: MoodDay[]): Slot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const slots: Slot[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Local-date ISO slug. `toISOString()` would silently shift by the
    // UTC offset and mis-align the window for users west of UTC.
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    slots.push({ date: iso, mood: byDate.get(iso) ?? null });
  }
  return slots;
}

// Example slots still carry real local dates so the weekday letters
// rotate naturally day-to-day, even though the mood values are synthetic.
function buildExampleSlots(): Slot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return EXAMPLE_EMOTIONS.map((mood, idx) => {
    const daysBack = WINDOW_DAYS - 1 - idx;
    const d = new Date(today);
    d.setDate(today.getDate() - daysBack);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date: iso, mood };
  });
}

// ── Aggregate shares for legend ────────────────────────────────────────
// Sum each bucket's share across all days in the window, then normalize
// so the three percentages add to 100%.
function aggregateShares(slots: Slot[]): Record<BucketKey, number> {
  const totals: Record<BucketKey, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const slot of slots) {
    for (const e of slot.mood?.emotions ?? []) {
      const { bucket } = bucketFor(e.emotion, e.valence);
      totals[bucket] += e.share;
    }
  }
  const sum = totals.positive + totals.negative + totals.neutral;
  if (sum <= 0) return totals;
  return {
    positive: totals.positive / sum,
    negative: totals.negative / sum,
    neutral: totals.neutral / sum,
  };
}

// ── Legend (bottom row of chips) ────────────────────────────────────────
interface LegendProps {
  colors: AppColors;
  shares: Record<BucketKey, number>;
}

function Legend({ colors, shares }: LegendProps) {
  return (
    <View style={styles.legend}>
      {MOOD_BUCKETS.map((key) => {
        const pct = Math.round(shares[key] * 100);
        return (
          <View
            key={key}
            style={[styles.legendPill, { backgroundColor: colors.mood[key] }]}
          >
            <Text style={[styles.legendLabel, { color: BUCKET_LABEL_COLOR[key] }]}>
              {pct > 0 ? `${pct}% ${BUCKET_LABELS[key]}` : BUCKET_LABELS[key]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Bars + weekday labels ──────────────────────────────────────────────
interface BarsProps {
  slots: Slot[];
  colors: AppColors;
  emptyTrackColor: string;
  weekdayColor: string;
}

function Bars({ slots, colors, emptyTrackColor, weekdayColor }: BarsProps) {
  return (
    <View style={styles.chartWrap}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {slots.map((slot) => (
          <View key={slot.date} style={styles.column}>
            <BarColumn
              slot={slot}
              colors={colors}
              emptyTrackColor={emptyTrackColor}
            />
          </View>
        ))}
      </View>
      <View style={styles.labelsRow}>
        {slots.map((slot) => (
          <View key={`label-${slot.date}`} style={styles.column}>
            <Text style={[styles.dayLabel, { color: weekdayColor }]}>
              {formatDayOfWeek(slot.date)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface BarColumnProps {
  slot: Slot;
  colors: AppColors;
  emptyTrackColor: string;
}

function BarColumn({ slot, colors, emptyTrackColor }: BarColumnProps) {
  const emotions = slot.mood?.emotions ?? [];

  // No backend signal for this slot — faint track only, no foreground
  // pill. Keeps the column visually present without implying a reading.
  if (emotions.length === 0) {
    return (
      <View
        style={[
          styles.pillClip,
          {
            backgroundColor: emptyTrackColor,
            opacity: EMPTY_TRACK_OPACITY,
          },
        ]}
      />
    );
  }

  // Merge raw emotions onto the 11 legend buckets (joy + happiness +
  // bliss → one happiness band), then stack largest at the base so the
  // dominant emotion reads as the pill's visual foundation. Inner
  // segments are plain rectangles; the outer pillClip's overflow:hidden
  // + full radius clips them into the pill outline. Each band centers
  // its own "NN%" label (elided on bands too thin to hold one).
  const segments = toSegments(emotions);
  let bottom = 0;
  return (
    <View style={styles.pillClip}>
      {segments.map((seg) => {
        const height = seg.share * CHART_HEIGHT;
        const style = {
          position: 'absolute' as const,
          left: 0,
          right: 0,
          bottom,
          height,
          backgroundColor: colors.mood[seg.bucket],
        };
        bottom += height;
        return <View key={seg.bucket} style={style} />;
      })}
    </View>
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
        } catch {
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

  const unlocked = !!data?.unlocked && !error;
  const progressTotal =
    (data?.conversation_count ?? 0) + (data?.journal_count ?? 0);
  const slotsToRender: Slot[] = unlocked
    ? alignToWindow(data!.days)
    : buildExampleSlots();

  return (
    <Animated.View entering={FadeIn.duration(enterConfig.content.duration).delay(150)}>
      <Surface role="ground" radius="xl" padded style={styles2.card}>
        <View style={styles2.header}>
          <Text style={styles2.title}>Your mood</Text>
        </View>

        <Text style={styles2.subtitle}>Based on daily activity</Text>

        {loading ? (
          <View style={styles.chartWrap}>
            <View style={[styles.chart, { height: CHART_HEIGHT }]}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.column}>
                  <View
                    style={[
                      styles.pill,
                      {
                        top: 0,
                        bottom: 0,
                        backgroundColor: surfaces.text.tertiary,
                        opacity: 0.15,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.labelsRow}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.column} />
              ))}
            </View>
          </View>
        ) : (
          <View style={unlocked ? undefined : styles2.lockedWrap}>
            <Bars
              slots={slotsToRender}
              colors={colors}
              emptyTrackColor={surfaces.text.tertiary}
              weekdayColor={surfaces.text.tertiary}
            />
          </View>
        )}

        <Legend colors={colors} shares={aggregateShares(slotsToRender)} />

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
  // Three chips fit comfortably on one row on any phone width, so the
  // wrap-to-two-rows treatment the 11-bucket version needed is gone.
  legend: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
  },
  legendPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  legendLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  chartWrap: {
    marginTop: spacing.md,
  },
  chart: {
    flexDirection: 'row',
    gap: BAR_GAP,
  },
  column: {
    flex: 1,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: PILL_RADIUS,
  },
  // Stacked-segment container. Full-radius + overflow:hidden clip
  // the inner rectangular bands into a pill outline at top and bottom.
  pillClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  labelsRow: {
    flexDirection: 'row',
    gap: BAR_GAP,
    marginTop: spacing.xs,
  },
  dayLabel: {
    ...typography.caption,
    textAlign: 'center',
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
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.h3,
      color: surfaces.text.primary,
    },
    subtitle: {
      ...typography.caption,
      color: surfaces.text.secondary,
      marginTop: spacing.xs,
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
