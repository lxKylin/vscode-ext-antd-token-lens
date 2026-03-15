import * as assert from 'node:assert';
import { mapDesignTokens } from '@/tokenManager/mappers/designTokenMapper';

suite('DesignTokenMapper Test Suite', () => {
  test('maps camelCase names to CSS variable names', () => {
    const tokens = mapDesignTokens(
      {
        colorPrimary: '#1677ff'
      },
      {
        baseTheme: 'light'
      }
    );

    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0].name, '--ant-color-primary');
    assert.strictEqual(tokens[0].category, 'color');
    assert.strictEqual(tokens[0].isColor, true);
  });

  test('converts number values to strings', () => {
    const tokens = mapDesignTokens(
      {
        borderRadius: 6
      },
      {
        baseTheme: 'dark'
      }
    );

    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0].value, '6');
    assert.strictEqual(tokens[0].theme, 'dark');
    assert.strictEqual(tokens[0].category, 'size');
  });

  test('filters out non-serializable values', () => {
    const tokens = mapDesignTokens(
      {
        colorPrimary: '#1677ff',
        nested: { disabled: true },
        callback: () => '#000'
      },
      {
        baseTheme: 'light'
      }
    );

    assert.deepStrictEqual(
      tokens.map((token) => token.name),
      ['--ant-color-primary']
    );
  });
});
