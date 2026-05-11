/**
 * Jest Configuration for Inspera ERP
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js',
    '**/tests/**/*.test.js'
  ],

  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html'
  ],
  
  // Files to include in coverage
  collectCoverageFrom: [
    'services/**/*.js',
    'models/**/*.js',
    'Routes/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/backup/**',
    '!**/_zip_*/**'
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Transform configuration (if using Babel for ES6+)
  transform: {},

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Don't run tests in these directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backup/',
    '/_zip_full/',
    '/_zip_probe/',
    '/inspera_4_extracted/',
    '/data_storage/',
    '/backups/'
  ],

  // Coverage thresholds (optional - uncomment to enforce)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50
  //   }
  // }
};
