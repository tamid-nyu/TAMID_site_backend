import { describe, expect, it } from '@jest/globals';
import { logger } from './logger.js';

describe('test logger configuration', () => {
  it('silences application logs during tests', () => {
    expect(logger.level).toBe('silent');
  });
});
