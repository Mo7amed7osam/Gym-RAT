import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS } from '@/data/exercisesData';
import { useLocale, useT } from '@/i18n';
import { deleteCustomExercisePhoto, saveCustomExercisePhoto } from '@/lib/customMedia';
import { useExercise, useWorkoutStore, type CustomExerciseInput } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Equipment, LocalizedText, MuscleGroup, WeightType } from '@/types/workout';

const EQUIPMENT: Equipment[] = ['barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'bench', 'bodyweight', 'kettlebell', 'band', 'other'];
const WEIGHT_TYPES: WeightType[] = ['total', 'per_hand', 'bodyweight', 'weighted_bodyweight', 'assisted'];

const lines = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);
const localized = (en: string, ar: string): LocalizedText => ({ en, ar: ar || en });

/** Create or edit a custom exercise (`/exercise/edit?id=`). Built-ins are not editable here. */
export default function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const existing = useExercise(id);
  const createCustomExercise = useWorkoutStore((state) => state.createCustomExercise);
  const updateCustomExercise = useWorkoutStore((state) => state.updateCustomExercise);
  const updateExerciseUser = useWorkoutStore((state) => state.updateExerciseUser);

  const editing = existing?.origin === 'custom' ? existing : undefined;
  const [nameEn, setNameEn] = useState(editing?.name.en ?? '');
  const [nameAr, setNameAr] = useState(editing?.name.ar === editing?.name.en ? '' : (editing?.name.ar ?? ''));
  const [primary, setPrimary] = useState<MuscleGroup[]>(editing?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState<MuscleGroup[]>(editing?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(editing?.equipment ?? []);
  const [weightType, setWeightType] = useState<WeightType>(editing?.weightType ?? 'total');
  const [unilateral, setUnilateral] = useState(editing?.isUnilateral ?? false);
  const [instructions, setInstructions] = useState(editing?.instructions.map((step) => step.en).join('\n') ?? '');
  const [breathing, setBreathing] = useState(editing?.breathing?.en ?? '');
  const [rangeOfMotion, setRangeOfMotion] = useState(editing?.rangeOfMotion?.en ?? '');
  const [mistakes, setMistakes] = useState(editing?.commonMistakes.map((item) => item.en).join('\n') ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(editing?.imageUri ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(list: T[], item: T, set: (next: T[]) => void) =>
    set(list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);

  const pickPhoto = async (fromCamera: boolean) => {
    setError(null);
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch {
      setError(t('library.editor.photoError'));
    }
  };

  const save = async () => {
    const name = nameEn.trim();
    if (!name) return setError(t('library.editor.nameRequired'));
    if (primary.length === 0) return setError(t('library.editor.muscleRequired'));
    setSaving(true);
    setError(null);
    const input: CustomExerciseInput = {
      name: { en: name, ar: nameAr.trim() || name },
      primaryMuscles: primary,
      secondaryMuscles: secondary.filter((muscle) => !primary.includes(muscle)),
      equipment,
      weightType,
      isUnilateral: unilateral,
      instructions: lines(instructions).map((line) => localized(line, '')),
      breathing: breathing.trim() ? localized(breathing.trim(), '') : null,
      rangeOfMotion: rangeOfMotion.trim() ? localized(rangeOfMotion.trim(), '') : null,
      commonMistakes: lines(mistakes).map((line) => localized(line, '')),
      alternatives: editing?.alternatives ?? [],
      videoId: editing?.videoId ?? null,
    };
    try {
      const exerciseId = editing ? editing.id : createCustomExercise(input).id;
      if (editing) updateCustomExercise(editing.id, input);
      // Photo: copy a newly picked file into the sandbox; drop the old one when removed or replaced.
      if (photoUri !== (editing?.imageUri ?? null)) {
        const storedUri = photoUri ? await saveCustomExercisePhoto(exerciseId, photoUri) : null;
        updateExerciseUser(exerciseId, { imageUri: storedUri });
        await deleteCustomExercisePhoto(editing?.imageUri ?? null);
      }
      if (editing) router.back();
      else router.replace({ pathname: '/exercise/[id]', params: { id: exerciseId } });
    } catch {
      setError(t('library.editor.photoError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.toolbarButton}>
          <Text style={styles.toolbarLink}>{t('library.editor.cancel')}</Text>
        </Pressable>
        <Text style={styles.toolbarTitle}>{editing ? t('library.editor.editTitle') : t('library.editor.newTitle')}</Text>
        <Pressable onPress={save} disabled={saving} accessibilityRole="button" hitSlop={8} style={styles.toolbarButton}>
          <Text style={[styles.toolbarLink, styles.toolbarSave, saving && styles.disabled]}>{t('library.editor.save')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Field label={t('library.editor.nameEn')}>
          <TextInput value={nameEn} onChangeText={setNameEn} placeholder={t('library.editor.namePlaceholder')} placeholderTextColor={theme.colors.labelTertiary} style={styles.input} accessibilityLabel={t('library.editor.nameEn')} />
        </Field>
        <Field label={t('library.editor.nameAr')}>
          <TextInput value={nameAr} onChangeText={setNameAr} style={[styles.input, styles.rtl]} accessibilityLabel={t('library.editor.nameAr')} />
        </Field>

        <View style={styles.section}>
          <SectionHeader title={t('library.editor.photo')} />
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.chipRow}>
            <Button label={t('library.editor.choosePhoto')} variant="secondary" onPress={() => void pickPhoto(false)} style={styles.flex} />
            <Button label={t('library.editor.takePhoto')} variant="secondary" onPress={() => void pickPhoto(true)} style={styles.flex} />
          </View>
          {photoUri ? (
            <Pressable onPress={() => setPhotoUri(null)} accessibilityRole="button" style={styles.linkButton}>
              <Text style={styles.destructive}>{t('library.editor.removePhoto')}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.hint}>{t('library.editor.photoHint')}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('library.editor.primaryMuscles')} />
          <View style={styles.chipRow}>
            {MUSCLE_GROUPS.map((muscle) => (
              <SelectChip key={muscle} role="checkbox" label={MUSCLE_LABELS[muscle][locale]} selected={primary.includes(muscle)} onPress={() => toggle(primary, muscle, setPrimary)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeader title={t('library.editor.secondaryMuscles')} />
          <View style={styles.chipRow}>
            {MUSCLE_GROUPS.map((muscle) => (
              <SelectChip key={muscle} role="checkbox" label={MUSCLE_LABELS[muscle][locale]} selected={secondary.includes(muscle)} onPress={() => toggle(secondary, muscle, setSecondary)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeader title={t('library.editor.equipment')} />
          <View style={styles.chipRow}>
            {EQUIPMENT.map((item) => (
              <SelectChip key={item} role="checkbox" label={EQUIPMENT_LABELS[item][locale]} selected={equipment.includes(item)} onPress={() => toggle(equipment, item, setEquipment)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeader title={t('library.editor.weightType')} />
          <View style={styles.chipRow}>
            {WEIGHT_TYPES.map((item) => (
              <SelectChip key={item} label={t(`library.weightType.${item}`)} selected={weightType === item} onPress={() => setWeightType(item)} />
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.body, styles.flex]}>{t('library.editor.unilateral')}</Text>
            <Switch value={unilateral} onValueChange={setUnilateral} trackColor={{ true: theme.colors.tint }} />
          </View>
        </View>

        <Field label={t('library.editor.instructions')}>
          <TextInput value={instructions} onChangeText={setInstructions} multiline style={[styles.input, styles.multiline]} accessibilityLabel={t('library.editor.instructions')} />
        </Field>
        <Field label={t('library.editor.breathing')}>
          <TextInput value={breathing} onChangeText={setBreathing} style={styles.input} accessibilityLabel={t('library.editor.breathing')} />
        </Field>
        <Field label={t('library.editor.rangeOfMotion')}>
          <TextInput value={rangeOfMotion} onChangeText={setRangeOfMotion} style={styles.input} accessibilityLabel={t('library.editor.rangeOfMotion')} />
        </Field>
        <Field label={t('library.editor.mistakes')}>
          <TextInput value={mistakes} onChangeText={setMistakes} multiline style={[styles.input, styles.multiline]} accessibilityLabel={t('library.editor.mistakes')} />
        </Field>

        <Button label={t('library.editor.save')} onPress={() => void save()} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.screen, minHeight: HIT },
    toolbarButton: { minWidth: 60, minHeight: HIT, justifyContent: 'center' },
    toolbarLink: { ...t.typography.body, color: t.colors.link },
    toolbarSave: { fontWeight: '600', textAlign: 'right' },
    toolbarTitle: { ...t.typography.headline, color: t.colors.label, flex: 1, textAlign: 'center' },
    disabled: { opacity: 0.4 },
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm, gap: t.spacing.xl },
    error: { ...t.typography.subheadline, color: t.colors.destructive },
    field: { gap: t.spacing.xs },
    fieldLabel: { ...t.typography.footnote, color: t.colors.labelSecondary },
    input: {
      ...t.typography.body,
      color: t.colors.label,
      minHeight: HIT,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
    },
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
    section: { gap: t.spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: HIT },
    body: { ...t.typography.body, color: t.colors.label },
    hint: { ...t.typography.caption, color: t.colors.labelTertiary },
    photo: { width: '100%', aspectRatio: 1, borderRadius: t.radii.card, backgroundColor: t.colors.surfaceRaised },
    linkButton: { minHeight: HIT, justifyContent: 'center' },
    destructive: { ...t.typography.subheadline, fontWeight: '600', color: t.colors.destructive },
  }),
);
