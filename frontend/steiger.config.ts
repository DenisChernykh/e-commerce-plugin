import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['./src/shared/api/generated/**'] },
  { rules: { 'fsd/insignificant-slice': 'warn' } },
])
