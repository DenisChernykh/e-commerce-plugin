import js from '@eslint/js'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    '.next',
    'dist-chatgpt',
    '.vercel',
    'coverage',
    'next-env.d.ts',
    'src/shared/api/generated',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      tanstackQuery.configs['flat/recommended'],
    ],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
])
