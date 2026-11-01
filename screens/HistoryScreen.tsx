import { useRouter } from 'expo-router';
import { ChartColumn, ChevronDown, ChevronUp, Star, Trash } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeeklyVolumeChart } from '@/components/WeeklyVolumeChart';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { ROUTINES } from '@/data/scheduleData';
import { formatDuration, formatKg, formatKgCompact, formatShortDate, percentChange, startOfProgramWeek } from '@/lib/format';
import { formatSet, isCountedSet, sessionVolumeKg, weeklyVolumeKg } from '@/lib/workoutMath';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { RoutineId, WorkoutSession } from '@/types/workout';

const CHART_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

interface VolumeRecord {
  routineId: RoutineId;
  session: WorkoutSession | null;
  volumeKg: number;
}

const volumeOf = (session: WorkoutSession) => session.summary?.totalVolumeKg ?? sessionVolumeKg(session);

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkoutSession | null>(null);

  const history = useWorkoutStore((state) => state.history);
  const deleteSession = useWorkoutStore((state) => state.deleteSession);

  const completed = useMemo(() => history.filter((session) => session.status === 'completed'), [history]);

  const volumes = useMemo(() => weeklyVolumeKg(completed, CHART_WEEKS, now), [completed, now]);
  const weekStarts = useMemo(() => {
    const current = startOfProgramWeek(now).getTime();
    return Array.from({ length: CHART_WEEKS }, (_, i) => new Date(current - (CHART_WEEKS - 1 - i) * 7 * DAY_MS));
  }, [now]);
  const weekChange = percentChange(volumes[CHART_WEEKS - 1], volumes[CHART_WEEKS - 2]);

  const records = useMemo<VolumeRecord[]>(
    () =>
      (Object.keys(ROUTINES) as RoutineId[]).map((routineId) => {
        let best: WorkoutSession | null = null;
        for (const session of completed) {
          if (session.routineId === routineId && (!best || volumeOf(session) > volumeOf(best))) best = session;
        }
        return { routineId, session: best, volumeKg: best ? volumeOf(best) : 0 };
      }),
    [completed],
  );

  const totalPrs = completed.reduce((total, session) => total + (session.summary?.personalRecords.length ?? 0), 0);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.largeTitle} accessibilityRole="header">
          History
        </Text>

        {completed.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ChartColumn size={28} color={colors.tint} />
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
                  <Text style={[styles.change, { color: weekChange >= 0 ? colors.success : colors.labelSecondary }]}>
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
                  <View key={record.routineId} style={[styles.recordRow, index < records.length - 1 && styles.divider]}>
                    <Badge routineId={record.routineId} />
                    <View style={styles.flex}>
                      <Text style={styles.headline}>{ROUTINES[record.routineId].code}</Text>
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
        <Badge routineId={session.routineId} />
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
            <Star size={11} color={colors.tint} fill={colors.tint} />
            <Text style={styles.prChipText}>{prCount}</Text>
          </View>
        ) : null}
        <Text style={styles.recordValue}>{formatKg(volumeOf(session))}</Text>
        {expanded ? <ChevronUp size={18} color={colors.labelSecondary} /> : <ChevronDown size={18} color={colors.labelSecondary} />}
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
                    {hasPr ? <Star size={12} color={colors.tint} fill={colors.tint} /> : null}
                  </View>
                  <Text style={styles.detailSets}>{sets.map((set) => formatSet(set)).join(' · ')}</Text>
                </View>
              );
            })}
          <Pressable onPress={onDelete} accessibilityRole="button" style={styles.deleteButton}>
            <Trash size={16} color={colors.destructive} />
            <Text style={styles.deleteText}>Delete session</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const BADGES: Record<RoutineId, string> = {
  push_a: 'PSH',
  pull_a: 'PUL',
  leg_a: 'LEG',
  upper_b: 'UPR',
  lower_b: 'LWR',
};

function Badge({ routineId }: { routineId: RoutineId }) {
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.badgeText}>{BADGES[routineId]}</Text>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.label,
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.sm,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
  },
  emptyTitle: {
    ...typography.title1,
    color: colors.label,
  },
  card: {
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.label,
  },
  change: {
    ...typography.subheadline,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
  },
  tileValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: spacing.sm,
  },
  group: {
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    overflow: 'hidden',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radii.tile,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.tint,
  },
  headline: {
    ...typography.headline,
    color: colors.label,
  },
  caption: {
    ...typography.caption,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  secondary: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  recordValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  details: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  detailRow: {
    padding: spacing.md,
    borderRadius: radii.row,
    backgroundColor: colors.surfaceRaised,
    gap: 2,
  },
  detailName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailTitle: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
    flexShrink: 1,
  },
  detailSets: {
    ...typography.mono,
    fontSize: 13,
    color: colors.labelSecondary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: HIT,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.7,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    backgroundColor: colors.tintMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.tintMuted,
  },
  prChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tint,
    fontVariant: ['tabular-nums'],
  },
});
