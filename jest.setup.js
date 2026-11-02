// Jest environment shims for modules with native implementations.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
// lucide-react-native ships ESM only; icons are decorative, so render a named placeholder.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === '__esModule') return true;
        const Icon = (props) => React.createElement(View, { testID: `icon:${String(name)}`, ...props });
        Icon.displayName = String(name);
        return Icon;
      },
    },
  );
});
// expo-audio needs its native module; feedback is best-effort, so stub the player.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: () => {}, seekTo: async () => {} }),
  setAudioModeAsync: async () => {},
}));
// Phase 5 native modules: keep-awake and battery are side effects only; the
// integrations are exercised through their injected adapters in tests.
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {}, activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: async () => {} }));
jest.mock('expo-battery', () => ({ useLowPowerMode: () => false, isLowPowerModeEnabledAsync: async () => false }));
jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ granted: false, canAskAgain: true, ios: { status: 0 } }),
  requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false, ios: { status: 1 } }),
  scheduleNotificationAsync: async () => 'rest-complete',
  cancelScheduledNotificationAsync: async () => {},
  dismissNotificationAsync: async () => {},
}));
jest.mock('expo-widgets', () => ({ createLiveActivity: () => ({ start: () => ({}), getInstances: () => [] }) }));
// The YouTube player is a WebView; render a placeholder that exposes its props.
jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Player = (props) => React.createElement(View, { testID: 'youtube-player', ...props });
  return { __esModule: true, default: Player };
});
// Phase 7: the Keychain is an in-memory map in tests; the auth tests inject their own storage anyway.
jest.mock('expo-secure-store', () => {
  const items = new Map();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 2,
    isAvailableAsync: async () => true,
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => void items.set(key, value),
    deleteItemAsync: async (key) => void items.delete(key),
    __items: items,
  };
});
