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
