import { useRouter } from 'expo-router';
import { ChartColumn, ChevronDown, ChevronUp, Star, Trash } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeeklyVolumeChart } from '@/components/WeeklyVolumeChart';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { isSessionForDay } from '@/data/plans';
import { formatDuration, formatKg, formatKgCompact, formatShortDate, percentChange, startOfWeek } from '@/lib/format';
import { formatSet, isCountedSet, sessionVolumeKg, weeklyVolumeKg } from '@/lib/workoutMath';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

const CHART_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

interface VolumeRecord {
  dayId: string;
  code: string;
  session: WorkoutSession | null;
  volumeKg: number;
}

const volumeOf = (session: WorkoutSession) => session.summary?.totalVolumeKg ?? sessionVolumeKg(session);

export default function HistoryScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkoutSession | null>(null);

  const history = useWorkoutStore((state) => state.history);
  const weekStart = useWorkoutStore((state) => state.settings.weekStart);
  const activePlan = useWorkoutStore(selectActivePlan);
  const deleteSession = useWorkoutStore((state) => state.deleteSession);

  const completed = useMemo(() => history.filter((session) => session.status === 'completed'), [history]);

  const volumes = useMemo(() => weeklyVolumeKg(completed, CHART_WEEKS, now, weekStart), [completed, now, weekStart]);
  const weekStarts = useMemo(() => {
    const current = startOfWeek(now, weekStart).getTime();
    return Array.from({ length: CHART_WEEKS }, (_, i) => new Date(current - (CHART_WEEKS - 1 - i) * 7 * DAY_MS));
  }, [now, weekStart]);
  const weekChange = percentChange(volumes[CHART_WEEKS - 1], volumes[CHART_WEEKS - 2]);

  // Best session per day of the active plan.
  const records = useMemo<VolumeRecord[]>(
    () =>
      (activePlan?.days ?? []).map((day) => {
        let best: WorkoutSession | null = null;
        for (const session of completed) {
          if (isSessionForDay(session, activePlan!, day) && (!best || volumeOf(session) > volumeOf(best))) best = session;
        }
        return { dayId: day.id, code: day.code, session: best, volumeKg: best ? volumeOf(best) : 0 };
      }),
    [activePlan, completed],
  );

  const totalPrs = completed.reduce((total, session) => total + (session.summary?.personalRecords.length ?? 0), 0);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.largeTitle} accessibilityRole="header">
          History
        </Text>

        {completed.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ChartColumn size={28} color={theme.colors.tint} />
            </View>
            <Text style={styles.emptyTitle}>No workouts logged</Text>
            <Text style={styles.secondary}>
              Finish a session and it lands here: weekly volume, your best day per routine, every set you lifted and
              the PRs you hit.
            </Text>
            <Button label="Go to today's workout" onPress={() => router.navigate('/')} style={styles.emptyButton} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Weekly volume</Text>
                {weekChange !== null ? (
                  <Text style={[styles.change, { color: weekChange >= 0 ? theme.colors.success : theme.colors.labelSecondary }]}>
                    {weekChange >= 0 ? '+' : ''}
                    {weekChange}% vs last week
                  </Text>
                ) : null}
              </View>
              <WeeklyVolumeChart volumes={volumes} weekStarts={weekStarts} />
            </View>

            <View style={styles.tiles}>
              <Tile label="Sessions" value={String(completed.length)} />
              <Tile label="All-time volume" value={formatKgCompact(completed.reduce((total, session) => total + volumeOf(session), 0))} />
              <Tile label="PRs" value={String(totalPrs)} />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Volume records" />
              <View style={styles.group}>
                {records.map((record, index) => (
                  <View key={record.dayId} style={[styles.recordRow, index < records.length - 1 && styles.divider]}>
                    <Badge code={record.code} />
                    <View style={styles.flex}>
                      <Text style={styles.headline}>{record.code}</Text>
                      <Text style={styles.caption}>
                        {record.session ? formatShortDate(record.session.startedAt) : 'Not logged yet'}
                      </Text>
                    </View>
                    <Text style={styles.recordValue}>{record.session ? formatKg(record.volumeKg) : '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Recent sessions" />
              <View style={styles.group}>
                {completed.map((session, index) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    expanded={expandedId === session.id}
                    isLast={index === completed.length - 1}
                    onToggle={() => setExpandedId((id) => (id === session.id ? null : session.id))}
                    onDelete={() => setPendingDelete(session)}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete session?"
        message={pendingDelete ? `${pendingDelete.code} on ${formatShortDate(pendingDelete.startedAt)} will be removed from history and records.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteSession(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </View>
  );
}

function SessionRow({
  session,
  expanded,
  isLast,
  onToggle,
  onDelete,
}: {
  session: WorkoutSession;
  expanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const summary = session.summary;
  const prCount = summary?.personalRecords.length ?? 0;
  const prSetIds = new Set(summary?.personalRecords.map((record) => record.setId));

  return (
    <View style={!isLast && styles.divider}>
      <Pressable
        onPress={onToggle}
        onLongPress={onDelete}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Long press to delete"
        style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
      >
        <Badge code={session.code} />
        <View style={styles.flex}>
          <Text style={styles.headline}>{session.code}</Text>
          <Text style={styles.caption}>{formatShortDate(session.startedAt)}</Text>
          {summary ? (
            <Text style={styles.caption}>
              {formatDuration(summary.durationSeconds)}, {summary.completedSets} of {summary.totalSets} sets
            </Text>
          ) : null}
        </View>
        {prCount > 0 ? (
          <View style={styles.prChip}>
            <Star size={11} color={theme.colors.tint} fill={theme.colors.tint} />
            <Text style={styles.prChipText}>{prCount}</Text>
          </View>
        ) : null}
        <Text style={styles.recordValue}>{formatKg(volumeOf(session))}</Text>
        {expanded ? <ChevronUp size={18} color={theme.colors.labelSecondary} /> : <ChevronDown size={18} color={theme.colors.labelSecondary} />}
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          {session.exercises
            .filter((exercise) => exercise.sets.some(isCountedSet))
            .map((exercise) => {
              const sets = exercise.sets.filter(isCountedSet);
              const hasPr = sets.some((set) => prSetIds.has(set.id));
              return (
                <View key={exercise.id} style={styles.detailRow}>
                  <View style={styles.detailName}>
                    <Text style={styles.detailTitle} numberOfLines={1}>
                      {getExercise(exercise.exerciseId)?.name.en ?? exercise.exerciseId}
                    </Text>
                    {hasPr ? <Star size={12} color={theme.colors.tint} fill={theme.colors.tint} /> : null}
                  </View>
                  <Text style={styles.detailSets}>{sets.map((set) => formatSet(set)).join(' · ')}</Text>
                </View>
              );
            })}
          <Pressable onPress={onDelete} accessibilityRole="button" style={styles.deleteButton}>
            <Trash size={16} color={theme.colors.destructive} />
            <Text style={styles.deleteText}>Delete session</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** "Push A" → "PSH A", "Full Body B" → "FB B", "Legs" → "LEG". */
function badgeFor(code: string): string {
  const words = code.trim().split(/\s+/);
  const suffix = words.length > 1 && /^[A-Z0-9]$/i.test(words[words.length - 1]) ? ` ${words.pop()!.toUpperCase()}` : '';
  const head = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].replace(/[aeiou]/gi, '').slice(0, 3) || words[0].slice(0, 3);
  return `${head.toUpperCase()}${suffix}`;
}

function Badge({ code }: { code: string }) {
  const styles = useStyles();
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit>
        {badgeFor(code)}
      </Text>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl * 2,
      gap: t.spacing.xl,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    largeTitle: {
      ...t.typography.largeTitle,
      color: t.colors.label,
    },
    empty: {
      padding: t.spacing.xl,
      gap: t.spacing.sm,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
    },
    emptyTitle: {
      ...t.typography.title1,
      color: t.colors.label,
    },
    card: {
      padding: t.spacing.xl,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: t.spacing.xs,
    },
    cardTitle: {
      fontFamily: t.fonts.display,
      fontSize: 24,
      lineHeight: 28,
      color: t.colors.label,
    },
    change: {
      ...t.typography.subheadline,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    tiles: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    tile: {
      flex: 1,
      padding: t.spacing.md,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
    },
    tileValue: {
      fontFamily: t.fonts.display,
      fontSize: 28,
      lineHeight: 32,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    section: {
      gap: t.spacing.sm,
    },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 58,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 64,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    badge: {
      width: 44,
      height: 44,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontFamily: t.fonts.display,
      fontSize: 16,
      color: t.colors.tint,
    },
    headline: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    recordValue: {
      fontFamily: t.fonts.display,
      fontSize: 20,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    details: {
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.sm,
      gap: t.spacing.sm,
    },
    detailRow: {
      padding: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      gap: 2,
    },
    detailName: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
    },
    detailTitle: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
      flexShrink: 1,
    },
    detailSets: {
      ...t.typography.mono,
      fontSize: 13,
      color: t.colors.labelSecondary,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
      minHeight: HIT,
    },
    deleteText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.destructive,
    },
    pressed: {
      opacity: 0.7,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.xs,
    },
    emptyButton: {
      marginTop: t.spacing.md,
    },
    prChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tintMuted,
    },
    prChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: t.colors.tint,
      fontVariant: ['tabular-nums'],
    },
  }),
);
