import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { WorkoutActivityProps } from '@/services/workoutActivity';

/**
 * Live Activity for the active workout (Lock Screen banner + Dynamic Island).
 * Runs in the widget extension's isolated runtime: no imports at run time,
 * no module-scope values, no hooks; everything comes in through props.
 * Timers are SwiftUI timer texts, so they tick without app updates.
 */
const WorkoutActivity = (props: WorkoutActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#FF7A1A';
  const muted = '#8E8E93';
  const restOver = props.restEnd !== null && (environment.isStale || props.restEnd <= Date.now());
  const resting = props.restEnd !== null && props.restStart !== null && !restOver;
  const far = new Date(props.activeStart + 24 * 60 * 60 * 1000);

  const restTimer = resting ? (
    <Text
      timerInterval={{ lower: new Date(props.restStart as number), upper: new Date(props.restEnd as number) }}
      countsDown
      modifiers={[font({ weight: 'bold', size: 28, design: 'rounded' }), monospacedDigit(), foregroundStyle(accent)]}
    />
  ) : null;
  const frozenRest =
    props.restLeftSeconds !== null ? (
      <Text modifiers={[font({ weight: 'bold', size: 28, design: 'rounded' }), monospacedDigit(), foregroundStyle(muted)]}>
        {`${Math.floor(props.restLeftSeconds / 60)}:${String(props.restLeftSeconds % 60).padStart(2, '0')}`}
      </Text>
    ) : null;
  const workoutTimer = (
    <Text
      timerInterval={{ lower: new Date(props.activeStart), upper: far }}
      countsDown={false}
      pauseTime={props.pausedAt !== null ? new Date(props.pausedAt) : undefined}
      modifiers={[font({ weight: 'semibold', size: 15 }), monospacedDigit(), foregroundStyle(muted)]}
    />
  );
  const status = props.pausedAt !== null ? props.labels.paused : restOver ? props.labels.restOver : resting || frozenRest ? props.labels.rest : props.labels.workout;
  const compactTimer = resting ? (
    <Text
      timerInterval={{ lower: new Date(props.restStart as number), upper: new Date(props.restEnd as number) }}
      countsDown
      modifiers={[monospacedDigit(), foregroundStyle(accent)]}
    />
  ) : (
    <Text
      timerInterval={{ lower: new Date(props.activeStart), upper: far }}
      countsDown={false}
      pauseTime={props.pausedAt !== null ? new Date(props.pausedAt) : undefined}
      modifiers={[monospacedDigit()]}
    />
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={8}>
          <Image systemName="dumbbell.fill" color={accent} size={16} />
          <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          {workoutTimer}
        </HStack>
        <HStack spacing={8}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'bold', size: 20 }), lineLimit(1)]}>{props.exercise}</Text>
            <Text modifiers={[font({ size: 14 }), foregroundStyle(muted), lineLimit(1)]}>{`${status} · ${props.detail}`}</Text>
          </VStack>
          <Spacer />
          {restTimer ?? frozenRest}
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={resting ? 'timer' : 'dumbbell.fill'} color={accent} />,
    compactTrailing: compactTimer,
    minimal: <Image systemName={resting ? 'timer' : 'dumbbell.fill'} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Image systemName="dumbbell.fill" color={accent} size={18} />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{props.title}</Text>
      </VStack>
    ),
    expandedTrailing: <VStack alignment="trailing" modifiers={[padding({ trailing: 4 })]}>{restTimer ?? frozenRest ?? workoutTimer}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(1)]}>{props.exercise}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{`${status} · ${props.detail}`}</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity('WorkoutActivity', WorkoutActivity);
