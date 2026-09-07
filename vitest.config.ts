import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/dsp/**/*.test.ts', 'tests/rhythm/**/*.test.ts'] },
});
