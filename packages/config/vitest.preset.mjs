export const vitestPreset = {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.spec.ts'],
    passWithNoTests: true,
  },
};
