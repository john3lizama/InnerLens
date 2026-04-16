/**
 * ActivityGrid — Swipeable yearly activity heatmap.
 *
 * Horizontal FlatList of year pages, from the user's account creation year
 * to the current year. Starts on the current year. Swipe left for past years.
 * No future years beyond the current one.
 *
 * Each page shows a grid of rounded squares (one per day).
 * Active days are bright blue; inactive past days are dark blue; future days dim.
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Surface from '../ui/Surface';
import { typography, spacing } from '../../theme';
import { fade } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import * as journalService from '../../services/journalService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INSET = spacing.md;
const SURFACE_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const GRID_WIDTH = SURFACE_WIDTH - INSET * 2;
const GAP = 2;
const TARGET_CELL = 11;
const COLUMNS = Math.floor((GRID_WIDTH + GAP) / (TARGET_CELL + GAP));
const CELL_SIZE = (GRID_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;

interface DayCell {
  date: string;
  active: boolean;
  isFuture: boolean;
}

function getDaysInYear(year: number): DayCell[] {
  const cells: DayCell[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const current = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    cells.push({
      date: `${y}-${m}-${d}`,
      active: false,
      isFuture: current > today,
    });
    current.setDate(current.getDate() + 1);
  }

  return cells;
}

/** Single year page rendered inside the FlatList */
function YearPage({
  year,
  activeDates,
  cellColors,
  surfaces,
}: {
  year: number;
  activeDates: Set<string>;
  cellColors: { active: string; inactive: string; future: string };
  surfaces: any;
}) {
  const days = useMemo(() => {
    const cells = getDaysInYear(year);
    return cells.map((cell) => ({
      ...cell,
      active: activeDates.has(cell.date),
    }));
  }, [year, activeDates]);

  const activeDayCount = days.filter((d) => d.active).length;
  const totalDays = days.length;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.year, { color: surfaces.text.primary }]}>{year}</Text>
        <Text style={[styles.dayCount, { color: surfaces.text.secondary }]}>
          {activeDayCount} of {totalDays} days
        </Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {days.map((day) => (
          <View
            key={day.date}
            style={[
              styles.cell,
              {
                // Active wins over "future": the backend's active_dates are
                // cast to Date in UTC while the grid builds cells in local
                // time, so an active day can land on what local time calls
                // "tomorrow". Paint it active regardless — otherwise the
                // numerator ("2 of 365") disagrees with the filled cells.
                backgroundColor: day.active
                  ? cellColors.active
                  : day.isFuture
                    ? cellColors.future
                    : cellColors.inactive,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function ActivityGrid() {
  const { surfaces, isDark } = useTheme();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  // Year range: from account creation year to current year
  const currentYear = new Date().getFullYear();
  const startYear = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : currentYear;
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = startYear; y <= currentYear; y++) {
      list.push(y);
    }
    return list;
  }, [startYear, currentYear]);

  // Cache activity dates per year
  const [activityCache, setActivityCache] = useState<Record<number, Set<string>>>({});
  const [loadedYears, setLoadedYears] = useState<Set<number>>(new Set());
  const [visibleYear, setVisibleYear] = useState(currentYear);

  // Load activity for a given year
  const loadYear = useCallback(async (year: number) => {
    if (loadedYears.has(year)) return;
    try {
      const dates = await journalService.getActivityDates(year);
      setActivityCache((prev) => ({ ...prev, [year]: new Set(dates) }));
      setLoadedYears((prev) => new Set(prev).add(year));
    } catch (err) {
      console.error(`Failed to load activity for ${year}:`, err);
      // Mark as loaded to avoid retries
      setLoadedYears((prev) => new Set(prev).add(year));
      setActivityCache((prev) => ({ ...prev, [year]: new Set() }));
    }
  }, [loadedYears]);

  // Invalidate current year cache on screen focus so new activity shows
  useFocusEffect(
    useCallback(() => {
      setLoadedYears((prev) => {
        const next = new Set(prev);
        next.delete(currentYear);
        return next;
      });
    }, [currentYear])
  );

  // Load current year on mount (and after cache invalidation)
  useEffect(() => {
    loadYear(currentYear);
  }, [currentYear]);

  // Load year when it becomes visible
  useEffect(() => {
    loadYear(visibleYear);
  }, [visibleYear, loadYear]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].item != null) {
        setVisibleYear(viewableItems[0].item as number);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const cellColors = isDark
    ? {
        active: '#6C63FF',
        inactive: 'rgba(108,99,255,0.25)',
        future: 'rgba(255,255,255,0.04)',
      }
    : {
        active: '#6C63FF',
        inactive: 'rgba(108,99,255,0.18)',
        future: 'rgba(0,0,0,0.04)',
      };

  return (
    <Animated.View entering={FadeIn.duration(fade.normal)}>
      <Surface role="ground" radius="xl" style={styles.surface}>
        <FlatList
          ref={flatListRef}
          data={years}
          keyExtractor={(item) => item.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={years.length - 1}
          getItemLayout={(_, index) => ({
            length: GRID_WIDTH,
            offset: GRID_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item: year }) => (
            <YearPage
              year={year}
              activeDates={activityCache[year] || new Set()}
              cellColors={cellColors}
              surfaces={surfaces}
            />
          )}
        />

        {/* Page indicator dots — only if multiple years */}
        {years.length > 1 && (
          <View style={styles.dots}>
            {years.map((y) => (
              <View
                key={y}
                style={[
                  styles.dot,
                  {
                    backgroundColor: y === visibleYear
                      ? surfaces.text.primary
                      : surfaces.text.tertiary + '40',
                  },
                ]}
              />
            ))}
          </View>
        )}
      </Surface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    padding: INSET,
    overflow: 'hidden',
  },
  page: {
    width: GRID_WIDTH,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs + 2,
  },
  year: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  dayCount: {
    ...typography.caption,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2.5,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
