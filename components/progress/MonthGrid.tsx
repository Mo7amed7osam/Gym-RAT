import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarDay } from '@/domain/analytics/calendar';
import { dayKey } from '@/domain/analytics/dates';
import { formatDayMonth, weekdayInitials } from '@/lib/analyticsFormat';
import { useT } from '@/i18n';
import { createStyles } from '@/theme';

interface MonthGridProps {
  weeks: CalendarDay[][];
  selectedKey?: string | null;
  onSelect?: (day: CalendarDay) => void;
  /** Smaller cells for the Progress tab preview. */
  compact?: boolean;
  today: Date;
}

/**
 * Month view: trained days are filled with the accent, today is outlined.
 * Rows are flex rows, so the week runs right to left under RTL.
 */
export function MonthGrid({ weeks, selectedKey = null, onSelect, compact = false, today }: MonthGridProps) {
  const styles = useStyles();
  const t = useT();
  const todayKey = dayKey(today);
  const initials = weeks[0] ? weekdayInitials(weeks[0][0].date) : [];
  return (
    <View style={styles.grid}>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {initials.map((label, i) => (
          <Text key={i} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].key} style={styles.week}>
          {week.map((day) => {
            const trained = day.sessions.length > 0;
            const selected = day.key === selectedKey;
            const label = `${formatDayMonth(day.date)}${trained ? `, ${t('progress.calendar.workoutsA11y', { count: day.sessions.length })}` : ''}`;
            return (
              <Pressable
                key={day.key}
                onPress={onSelect ? () => onSelect(day) : undefined}
                disabled={!onSelect}
                accessibilityRole={onSelect ? 'button' : 'text'}
                accessibilityLabel={label}
                accessibilityState={onSelect ? { selected } : undefined}
                style={[styles.cell, compact && styles.cellCompact]}
              >
                <View
                  style={[
                    styles.dot,
                    compact && styles.dotCompact,
                    trained && styles.dotTrained,
                    day.key === todayKey && styles.dotToday,
                    selected && styles.dotSelected,
                    !day.inMonth && styles.outside,
                  ]}
                >
                  <Text style={[styles.dayText, compact && styles.dayTextCompact, trained && styles.dayTextTrained]}>{day.date.getDate()}</Text>
                </View>
                {!compact && day.sessions.length > 1 ? <Text style={styles.multi}>×{day.sessions.length}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    grid: {
      gap: 4,
    },
    week: {
      flexDirection: 'row',
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: t.colors.labelSecondary,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    cellCompact: {
      minHeight: 34,
    },
    dot: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dotCompact: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    dotTrained: {
      backgroundColor: t.colors.tint,
    },
    dotToday: {
      borderColor: t.colors.link,
    },
    dotSelected: {
      borderColor: t.colors.label,
    },
    outside: {
      opacity: 0.3,
    },
    dayText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    dayTextCompact: {
      fontSize: 13,
    },
    dayTextTrained: {
      color: t.colors.onTint,
      fontWeight: '700',
    },
    multi: {
      fontSize: 10,
      color: t.colors.labelSecondary,
      marginTop: 1,
    },
  }),
);
