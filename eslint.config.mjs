// eslint.config.js — flat config for ESLint v9+
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Files/folders to ignore (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '.pnpm-store/**',
      'supabase/.temp/**',
      'apps/web/public/**',
      '**/*.d.ts',
      'packages/shared/src/types/supabase.ts',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // Our app rules (TS + React)
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Let TS + globals handle browser/node globals
      'no-undef': 'off',
    },
  },

  // Let Prettier handle formatting
  eslintConfigPrettier,
];
