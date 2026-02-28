import * as assert from 'assert';
import { TokenNameConverter } from '@/utils/tokenNameConverter';

suite('TokenNameConverter Test Suite', () => {
  // jsToCss
  test('colorPrimary → --ant-color-primary', () => {
    assert.strictEqual(
      TokenNameConverter.jsToCss('colorPrimary'),
      '--ant-color-primary'
    );
  });

  test('fontSize → --ant-font-size', () => {
    assert.strictEqual(
      TokenNameConverter.jsToCss('fontSize'),
      '--ant-font-size'
    );
  });

  test('jsToCss 使用自定义前缀', () => {
    assert.strictEqual(
      TokenNameConverter.jsToCss('colorPrimary', '--my-'),
      '--my-color-primary'
    );
  });

  test('单词 colorPrimary 前缀默认为 --ant-', () => {
    const result = TokenNameConverter.jsToCss('colorPrimary');
    assert.ok(
      result.startsWith('--ant-'),
      `Expected result to start with --ant-, got: ${result}`
    );
  });

  // cssToJs
  test('--ant-color-primary → colorPrimary', () => {
    assert.strictEqual(
      TokenNameConverter.cssToJs('--ant-color-primary'),
      'colorPrimary'
    );
  });

  test('--ant-font-size → fontSize', () => {
    assert.strictEqual(
      TokenNameConverter.cssToJs('--ant-font-size'),
      'fontSize'
    );
  });

  test('去除 -- 前缀（无 ant）: --color-primary → colorPrimary', () => {
    assert.strictEqual(
      TokenNameConverter.cssToJs('--color-primary'),
      'colorPrimary'
    );
  });

  // 工具方法
  test('camelToKebab: colorPrimary → color-primary', () => {
    assert.strictEqual(
      TokenNameConverter.camelToKebab('colorPrimary'),
      'color-primary'
    );
  });

  test('kebabToCamel: color-primary → colorPrimary', () => {
    assert.strictEqual(
      TokenNameConverter.kebabToCamel('color-primary'),
      'colorPrimary'
    );
  });

  // 互转一致性
  test('cssToJs(jsToCss(x)) === x（对合法 token 名）', () => {
    const names = ['colorPrimary', 'fontSize', 'borderRadius', 'lineHeight'];
    for (const name of names) {
      const roundtripped = TokenNameConverter.cssToJs(
        TokenNameConverter.jsToCss(name)
      );
      assert.strictEqual(roundtripped, name, `Round-trip failed for: ${name}`);
    }
  });
});
