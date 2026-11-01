import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { HIT } from '@/constants/theme';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import { useLocale, useT } from '@/i18n';
import { parseReps, parseWeight } from '@/lib/parseNumber';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { ExperienceLevel, TrainingGoal } from '@/types/workout';

type Step = 'welcome' | 'goal' | 'experience' | 'body' | 'rest' | 'plan' | 'done';
const STEPS: Step[] = ['welcome', 'goal', 'experience', 'body', 'rest', 'plan', 'done'];

/**
 * First-launch flow (spec §20). Every step is skippable; skipping keeps the
 * defaults (Full Body Starter active). Finishing marks onboardingComplete, which
 * flips the protected routes in the root layout to the tabs.
 */
export default function OnboardingScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();

  const settings = useWorkoutStore((state) => state.settings);
  const plans = useWorkoutStore((state) => state.plans);
  const active = useWorkoutStore(selectActivePlan);
  const updateSettings = useWorkoutStore((state) => state.updateSettings);
  const adoptPlan = useWorkoutStore((state) => state.adoptPlan);

  const [step, setStep] = useState<Step>('welcome');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const index = STEPS.indexOf(step);

  const finish = () => updateSettings({ onboardingComplete: true });
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]);
  const setProfile = (patch: Partial<typeof settings.profile>) => updateSettings({ profile: { ...settings.profile, ...patch } });

  const commitBody = () => {
    setProfile({ bodyweightKg: parseWeight(weightText), heightCm: parseReps(heightText) });
    next();
  };

  const templates = plans.filter((plan) => plan.kind !== 'active');
  const chosenSource = active?.sourcePlanId ?? null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}>
        {index > 0 && step !== 'done' ? (
          <Pressable onPress={back} accessibilityRole="button" style={styles.topButton}>
            <Text style={styles.topButtonText}>{t('onboarding.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.topButton} />
        )}
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {STEPS.map((item, i) => (
            <View key={item} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        {step !== 'done' ? (
          <Pressable onPress={finish} accessibilityRole="button" style={styles.topButton}>
            <Text style={styles.topButtonText}>{t('onboarding.skip')}</Text>
          </Pressable>
        ) : (
          <View style={styles.topButton} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'welcome' ? (
          <>
            <Text style={styles.display}>{t('onboarding.welcomeTitle')}</Text>
            <Text style={styles.body}>{t('onboarding.welcomeBody')}</Text>
          </>
        ) : null}

        {step === 'goal' ? (
          <>
            <Text style={styles.title}>{t('onboarding.goalTitle')}</Text>
            <Options
              options={[
                { value: 'hypertrophy', label: t('onboarding.goalHypertrophy') },
                { value: 'strength', label: t('onboarding.goalStrength') },
                { value: 'general', label: t('onboarding.goalGeneral') },
              ]}
              selected={settings.profile.goal}
              onSelect={(goal: TrainingGoal) => setProfile({ goal })}
            />
          </>
        ) : null}

        {step === 'experience' ? (
          <>
            <Text style={styles.title}>{t('onboarding.experienceTitle')}</Text>
            <Options
              options={[
                { value: 'beginner', label: t('onboarding.experienceBeginner') },
                { value: 'intermediate', label: t('onboarding.experienceIntermediate') },
                { value: 'advanced', label: t('onboarding.experienceAdvanced') },
              ]}
              selected={settings.profile.experience}
              onSelect={(experience: ExperienceLevel) => setProfile({ experience })}
            />
          </>
        ) : null}

        {step === 'body' ? (
          <>
            <Text style={styles.title}>{t('onboarding.bodyTitle')}</Text>
            <Text style={styles.body}>{t('onboarding.bodyBody')}</Text>
            <View style={styles.fields}>
              <Field label={t('onboarding.bodyweight')} value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" />
              <Field label={t('onboarding.height')} value={heightText} onChangeText={setHeightText} keyboardType="number-pad" />
            </View>
          </>
        ) : null}

        {step === 'rest' ? (
          <>
            <Text style={styles.title}>{t('onboarding.restTitle')}</Text>
            <View style={styles.group}>
              <View style={styles.row}>
                <Text style={[styles.rowTitle, styles.flex]}>{t('onboarding.restAuto')}</Text>
                <Switch
                  value={settings.autoStartRestTimer}
                  onValueChange={(value) => updateSettings({ autoStartRestTimer: value })}
                  trackColor={{ true: theme.colors.tint, false: theme.colors.surfaceHigh }}
                  thumbColor={theme.colors.label}
                />
              </View>
              <View style={[styles.row, styles.rowTop]}>
                <Text style={[styles.rowTitle, styles.flex]}>{t('onboarding.restWarning')}</Text>
                <Switch
                  value={settings.restWarningSeconds > 0}
                  onValueChange={(value) => updateSettings({ restWarningSeconds: value ? 15 : 0 })}
                  trackColor={{ true: theme.colors.tint, false: theme.colors.surfaceHigh }}
                  thumbColor={theme.colors.label}
                />
              </View>
            </View>
          </>
        ) : null}

        {step === 'plan' ? (
          <>
            <Text style={styles.title}>{t('onboarding.planTitle')}</Text>
            <Text style={styles.body}>{t('onboarding.planBody')}</Text>
            <View style={styles.options}>
              {templates.map((plan) => {
                const selected = chosenSource === plan.id;
                const isStarter = plan.id === STARTER_PLAN_ID;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => adoptPlan(plan.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionTitle, selected && styles.optionTextSelected]}>{isStarter ? t('onboarding.planStarter') : plan.name[locale]}</Text>
                    <Text style={[styles.optionBody, selected && styles.optionTextSelected]}>
                      {isStarter ? t('onboarding.planStarterBody') : t('onboarding.planTemplate', { days: plan.days.length })}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={next} accessibilityRole="button" style={styles.option}>
                <Text style={styles.optionTitle}>{t('onboarding.planLater')}</Text>
                <Text style={styles.optionBody}>{t('onboarding.planLaterBody')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <Text style={styles.display}>{t('onboarding.doneTitle')}</Text>
            <Text style={styles.body}>{t('onboarding.doneBody')}</Text>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        {step === 'welcome' ? <Button label={t('onboarding.getStarted')} onPress={next} /> : null}
        {step === 'goal' || step === 'experience' || step === 'rest' || step === 'plan' ? <Button label={t('onboarding.next')} onPress={next} /> : null}
        {step === 'body' ? <Button label={t('onboarding.next')} onPress={commitBody} /> : null}
        {step === 'done' ? <Button label={t('onboarding.finish')} onPress={finish} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Options<T extends string>({ options, selected, onSelect }: { options: { value: T; label: string }[]; selected: T | null; onSelect: (value: T) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            style={[styles.option, isSelected && styles.optionSelected]}
          >
            <Text style={[styles.optionTitle, isSelected && styles.optionTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (text: string) => void; keyboardType: 'decimal-pad' | 'number-pad' }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={6}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.labelTertiary}
        style={styles.input}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1, minWidth: 0 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.sm },
    topButton: { minWidth: 72, minHeight: HIT, justifyContent: 'center', alignItems: 'center' },
    topButtonText: { fontSize: 15, fontWeight: '600', color: t.colors.link },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceHigh },
    dotActive: { backgroundColor: t.colors.tint, width: 18 },
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.xxl, paddingBottom: t.spacing.xxxl, gap: t.spacing.lg },
    display: { ...t.typography.display, color: t.colors.label },
    title: { ...t.typography.largeTitle, color: t.colors.label },
    body: { ...t.typography.body, color: t.colors.labelSecondary },
    options: { gap: t.spacing.sm },
    option: {
      padding: t.spacing.lg,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: 2,
    },
    optionSelected: { backgroundColor: t.colors.tint, borderColor: t.colors.tint },
    optionTitle: { ...t.typography.headline, color: t.colors.label },
    optionBody: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    optionTextSelected: { color: t.colors.onTint },
    fields: { gap: t.spacing.md },
    field: { gap: t.spacing.xs },
    fieldLabel: { ...t.typography.footnote, color: t.colors.labelSecondary },
    input: {
      ...t.typography.metric,
      height: 52,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
    },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: HIT + 12, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md },
    rowTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator },
    rowTitle: { ...t.typography.body, color: t.colors.label },
    bottomBar: {
      paddingHorizontal: t.spacing.screen,
      paddingTop: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.separator,
      backgroundColor: t.colors.background,
    },
  }),
);
