import { defineConfig } from 'vitest/config';

// A test whose cost tracks colregs' data and runs past 1.5 s on a CI runner
// declares its own timeout and says what it scales with. The default is that
// line, so when a colregs pin grows a test past it, the test fails by name
// instead of hiding under vitest's 5 s. The slowest default-timeout test is
// about 1.07 s on CI; re-measure from the CI log before changing this.
export default defineConfig({
  test: {
    testTimeout: 1_500,
  },
});
