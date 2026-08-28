import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'build/**',
    'coverage/**',
    'android/**',
    'ios/**',
    'node_modules/**',
    'backend/node_modules/**',
    'backend/uploads/**',
    'uploads/**',
    'public/downloads/**',
    'frontend/pages/_unused/**',
    '**/*.min.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Classic React Hooks rules only — React Compiler rules in v7
      // (set-state-in-effect, refs, etc.) are too noisy for this codebase.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'formatAdminError',
            'forceUnlockBodyScroll',
            'stashAuthNotice',
            'consumeAuthNotice',
            'peekAuthNotice',
            'clearAuthNotice',
            'useAppModal',
            'useAppSplash',
            'useAssessmentLockdown',
            'useNavigationProgress',
            'useTheme',
            'AppModalProvider',
            'AppSplashProvider',
            'AssessmentLockdownProvider',
            'NavigationProgressProvider',
            'ThemeProvider',
          ],
        },
      ],
      // Common intentional patterns: catch (_err), destructure leftovers.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Node / Vite / API / backend
  {
    files: [
      'vite.config.js',
      'eslint.config.js',
      'scripts/**/*.{js,mjs,cjs}',
      'api/**/*.{js,cjs}',
      'backend/**/*.{js,cjs,mjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Service worker (public/sw.js)
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
])
