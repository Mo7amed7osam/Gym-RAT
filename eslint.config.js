// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'server/**', 'admin/**', 'release-artifacts/**'],
  },
  {
    // Colours come from the theme (ADR-005); literals are allowed only in the token files.
    files: ['app/**/*.{ts,tsx}', 'screens/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['app/+html.tsx'],
    rules: {
      // UI text comes from i18n dictionaries (ADR-005). Symbols and separators are allowed.
      'react/jsx-no-literals': [
        'error',
        { noStrings: false, allowedStrings: ['·', '×', '%', '/', '–', '—', '+', '-', '(', ')', ':', ',', '•'], ignoreProps: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\()/]",
          message: 'Use theme colours (useTheme / createStyles) instead of colour literals.',
        },
      ],
    },
  },
]);
