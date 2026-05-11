/**
 * Jest Setup File
 * Runs before each test file
 */

// Global test utilities
global.testUtils = {
  /**
   * Create a mock response object
   */
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis()
    };
    return res;
  },

  /**
   * Create a mock request object
   */
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  /**
   * Create mock next function
   */
  createMockNext: () => jest.fn(),

  /**
   * Wait for promises to resolve
   */
  flushPromises: () => new Promise(resolve => setImmediate(resolve))
};

// Suppress console output during tests (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn()
// };

// Global test data helpers
global.testData = {
  // Valid invoice items
  validItems: [
    { price: 1000, partName: 'Front Windshield' },
    { price: 750, partName: 'Side Windows' },
    { price: 500, partName: 'Rear Window' }
  ],

  // Empty invoice scenario
  emptyInvoice: {
    items: [],
    extraCost: 0,
    discount: 0,
    hasWht: false
  },

  // Large amount invoice
  largeInvoice: {
    items: [{ price: 100000 }],
    extraCost: 5000,
    discount: 10000,
    hasWht: true
  },

  // Complex scenario
  complexInvoice: {
    items: [
      { price: 2500.50 },
      { price: 1500.75 },
      { price: 999.99 }
    ],
    extraCost: 300.25,
    discount: 500.50,
    hasWht: true
  }
};

// Custom matchers (if needed)
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  }
});

// Log test start
console.log('🧪 Test environment initialized');
