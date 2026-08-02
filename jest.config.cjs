/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/test/setupEnv.ts'],
  transform: {
    '^.+\\.ts$': '<rootDir>/jest.transformer.cjs',
  },
  testMatch: ['**/*.test.ts'],
  watchman: false,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'config/**/*.ts',
    'middleware/**/*.ts',
    'models/**/*.ts',
    'routes/**/*.ts',
    'scripts/**/*.ts',
    'server.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
    '!dist/**',
    '!node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 60,
      statements: 60,
    },
  },
};
