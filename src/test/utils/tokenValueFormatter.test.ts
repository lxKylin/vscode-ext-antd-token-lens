import * as assert from 'assert';
import { TokenInfo } from '@/data/antdTokens';
import {
  TokenValueFormatter,
  TokenValueFormatterOptions
} from '@/utils/tokenValueFormatter';

suite('TokenValueFormatter Test Suite', () => {
  const baseOptions: TokenValueFormatterOptions = {
    enabledCategories: ['size', 'font', 'motion', 'opacity', 'zIndex'],
    maxLength: 24,
    mode: 'compact'
  };

  function createToken(overrides: Partial<TokenInfo>): TokenInfo {
    return {
      name: '--ant-test-token',
      value: '16px',
      theme: 'light',
      category: 'size',
      source: 'builtin',
      isColor: false,
      ...overrides
    };
  }

  test('formats size tokens as-is', () => {
    const result = TokenValueFormatter.format(
      createToken({ value: '16px', category: 'size' }),
      baseOptions
    );

    assert.strictEqual(result, '16px');
  });

  test('formats motion tokens with millisecond conversion', () => {
    const result = TokenValueFormatter.format(
      createToken({ value: '0.2s', category: 'motion' }),
      baseOptions
    );

    assert.strictEqual(result, '0.2s · 200ms');
  });

  test('formats opacity tokens with percentage', () => {
    const result = TokenValueFormatter.format(
      createToken({ value: '0.65', category: 'opacity' }),
      baseOptions
    );

    assert.strictEqual(result, '0.65 · 65%');
  });

  test('truncates long values', () => {
    const result = TokenValueFormatter.format(
      createToken({
        value: '123456789012345678901234567890',
        category: 'size'
      }),
      {
        ...baseOptions,
        maxLength: 10
      }
    );

    assert.strictEqual(result, '1234567...');
  });

  test('returns undefined for disabled categories', () => {
    const result = TokenValueFormatter.format(
      createToken({
        value: '0 6px 16px rgba(0, 0, 0, 0.08)',
        category: 'shadow'
      }),
      baseOptions
    );

    assert.strictEqual(result, undefined);
  });

  test('returns undefined for color tokens', () => {
    const result = TokenValueFormatter.format(
      createToken({ value: '#1677ff', category: 'color', isColor: true }),
      {
        ...baseOptions,
        enabledCategories: [...baseOptions.enabledCategories, 'other']
      }
    );

    assert.strictEqual(result, undefined);
  });
});
