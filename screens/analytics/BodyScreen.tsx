import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { I18nManager, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineChart } from '@/components/charts/LineChart';
import { Card, ScreenHeader, StatTile } from '@/components/progress/parts';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { changeOver, entriesOf, isValidBodyValue, movingAverage } from '@/domain/analytics/body';
import { addDays, startOfDay } from '@/domain/analytics/dates';
import { useT } from '@/i18n';
import { formatDayMonthYear, formatNumber, formatSigned } from '@/lib/analyticsFormat';
import { parseWeight } from '@/lib/parseNumber';
import { useFocusNow } from '@/lib/useFocusNow';
import { useProgressStore } from '@/store/useProgressStore';
import { createStyles, useTheme } from '@/theme';
import { BODY_METRIC_KINDS, BODY_METRIC_LIMITS, BODY_METRIC_UNITS, type BodyEntry, type BodyMetricKind } from '@/types/progress';

const SMOOTHING_WINDOW = 7;

/** Body weight, body fat and circumferences: log, chart, change over 30/90 days. */
export default function BodyScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useFocusNow();
  const entries = useProgressStore((state) => state.bodyEntries);
  const addBodyEntry = useProgressStore((state) => state.addBodyEntry);
  const deleteBodyEntry = useProgressStore((state) => state.deleteBodyEntry);
  const persistenceError = useProgressStore((state) => state.persistenceError);

  const [kind, setKind] = useState<BodyMetricKind>('bodyweight');
  const [valueText, setValueText] = useState('');
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BodyEntry | null>(null);

  const unit = BODY_METRIC_UNITS[kind];
  const list = useMemo(() => entriesOf(entries, kind), [entries, kind]);
  const values = list.map((entry) => entry.value);
  const smoothed = kind === 'bodyweight' && list.length >= SMOOTHING_WINDOW ? movingAverage(values, SMOOTHING_WINDOW) : undefined;
  const change30 = changeOver(entries, kind, 30, now);
  const change90 = changeOver(entries, kind, 90, now);
  const formatValue = (value: number) => t(`progress.units.${unit === '%' ? 'percentValue' : unit === 'cm' ? 'cmValue' : 'kgValue'}`, { value: formatNumber(value) });
  const isToday = startOfDay(now).getTime() === day.getTime();

  const save = () => {
    const value = parseWeight(valueText);
    if (value === null || !isValidBodyValue(kind, value)) {
      const limits = BODY_METRIC_LIMITS[unit];
      setError(t('progress.body.invalid', { min: formatValue(limits.min), max: formatValue(limits.max) }));
      return;
    }
    // Today's entries keep the current time so several readings a day sort correctly.
    const measuredAt = isToday ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8);
    const entry = addBodyEntry({ kind, value, measuredAt: measuredAt.toISOString() });
    if (!entry) {
      setError(t('progress.session.errors.write', { message: useProgressStore.getState().persistenceError ?? persistenceError ?? '' }));
      return;
    }
    setValueText('');
    setError(null);
  };

  const Prev = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const Next = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title={t('progress.body.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {BODY_METRIC_KINDS.map((key) => (
              <SelectChip
                key={key}
                label={t(`progress.body.kinds.${key}`)}
                selected={kind === key}
                onPress={() => {
                  setKind(key);
                  setError(null);
                }}
              />
            ))}
          </ScrollView>

          <Card title={t('progress.body.addTitle', { kind: t(`progress.body.kinds.${kind}`) })}>
            <View style={styles.addRow}>
              <TextInput
                value={valueText}
                onChangeText={setValueText}
                keyboardType="decimal-pad"
                placeholder={unit}
                placeholderTextColor={theme.colors.labelTertiary}
                style={[styles.input, styles.flex]}
                accessibilityLabel={t('progress.body.valueA11y', { unit })}
                onSubmitEditing={save}
                returnKeyType="done"
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDay(addDays(day, -1))} accessibilityRole="button" accessibilityLabel={t('progress.session.dayEarlier')} style={styles.stepButton}>
                <Prev size={20} color={theme.colors.tint} />
              </Pressable>
              <Text style={styles.dateText}>{isToday ? t('common.today') : formatDayMonthYear(day)}</Text>
              <Pressable
                onPress={() => setDay(addDays(day, 1))}
                disabled={isToday}
                accessibilityRole="button"
                accessibilityState={{ disabled: isToday }}
                accessibilityLabel={t('progress.session.dayLater')}
                style={[styles.stepButton, isToday && styles.disabled]}
              >
                <Next size={20} color={theme.colors.tint} />
              </Pressable>
            </View>
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="assertive">
                {error}
              </Text>
            ) : null}
            <Button label={t('progress.body.save')} icon={Plus} onPress={save} disabled={valueText.trim() === ''} />
          </Card>

          {list.length > 0 ? (
            <>
              <View style={styles.tiles}>
                <StatTile label={t('progress.body.latest')} value={formatValue(values[values.length - 1])} />
                <StatTile label={t('progress.body.change30Label')} value={change30 ? `${formatSigned(change30.diff)} ${unit}` : '—'} />
                <StatTile label={t('progress.body.change90Label')} value={change90 ? `${formatSigned(change90.diff)} ${unit}` : '—'} />
                <StatTile label={t('progress.body.entries')} value={String(list.length)} />
              </View>

              {list.length > 1 ? (
                <Card>
                  <LineChart
                    points={list.map((entry) => ({ x: Date.parse(entry.measuredAt), y: entry.value }))}
                    trend={smoothed}
                    formatY={formatValue}
                    formatX={(x) => formatDayMonthYear(x)}
                    accessibilityLabel={t('progress.body.chartA11y', { kind: t(`progress.body.kinds.${kind}`), count: list.length })}
                  />
                  {smoothed ? <Text style={styles.caption}>{t('progress.body.smoothingNote', { count: SMOOTHING_WINDOW })}</Text> : null}
                </Card>
              ) : null}

              <Card title={t('progress.body.history')}>
                {[...list].reverse().map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text style={[styles.entryDate, styles.flex]}>{formatDayMonthYear(Date.parse(entry.measuredAt))}</Text>
                    <Text style={styles.entryValue}>{formatValue(entry.value)}</Text>
                    <Pressable onPress={() => setPendingDelete(entry)} accessibilityRole="button" accessibilityLabel={t('progress.body.deleteA11y')} hitSlop={6} style={styles.iconButton}>
                      <Trash2 size={18} color={theme.colors.labelSecondary} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </>
          ) : (
            <Text style={styles.secondary}>{t('progress.body.emptyKind')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('progress.body.deleteTitle')}
        message={pendingDelete ? `${formatDayMonthYear(Date.parse(pendingDelete.measuredAt))} · ${formatValue(pendingDelete.value)}` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteBodyEntry(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl * 2,
      gap: t.spacing.md,
    },
    chips: {
      gap: t.spacing.sm,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    input: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      ...t.typography.headline,
      color: t.colors.labelSecondary,
      minWidth: 28,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    stepButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
    },
    disabled: {
      opacity: 0.3,
    },
    error: {
      ...t.typography.subheadline,
      color: t.colors.destructive,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    entryDate: {
      ...t.typography.subheadline,
      color: t.colors.label,
    },
    entryValue: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    iconButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
