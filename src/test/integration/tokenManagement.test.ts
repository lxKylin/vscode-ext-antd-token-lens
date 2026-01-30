/**
 * Token 管理集成测试
 * 测试完整流程：加载 → 注册 → 查询
 */

import * as assert from 'assert';
import { TokenRegistry } from '../../tokenManager/tokenRegistry';
import { ThemeManager } from '../../tokenManager/themeManager';
import { loadBuiltinTokens } from '../../data/antdTokens';

suite('Token Management Integration Test', () => {
  let registry: TokenRegistry;
  let themeManager: ThemeManager;

  setup(() => {
    registry = new TokenRegistry();
    themeManager = new ThemeManager();
  });

  teardown(() => {
    registry.clear();
    themeManager.dispose();
  });

  test('load and query tokens', () => {
    // 加载内置 Token
    const tokens = loadBuiltinTokens();

    assert.ok(tokens.light.length > 0, 'Should have light theme tokens');
    assert.ok(tokens.dark.length > 0, 'Should have dark theme tokens');

    // 注册到 Registry
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    assert.ok(registry.size > 0, 'Registry should have tokens');

    // 查询特定 Token
    const lightPrimary = registry.get('--ant-color-primary', 'light');
    const darkPrimary = registry.get('--ant-color-primary', 'dark');

    assert.ok(lightPrimary, 'Should find light primary color');
    assert.ok(darkPrimary, 'Should find dark primary color');

    // 验证颜色值不同
    assert.notStrictEqual(
      lightPrimary?.value,
      darkPrimary?.value,
      'Light and dark primary colors should be different'
    );

    // 验证是颜色类型
    assert.strictEqual(lightPrimary?.isColor, true);
    assert.strictEqual(darkPrimary?.isColor, true);
  });

  test('theme switch updates token context', (done) => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    const initialTheme = themeManager.getCurrentTheme();

    // 监听主题变化
    const disposable = themeManager.onThemeChange((newTheme) => {
      assert.notStrictEqual(newTheme, initialTheme);

      // 根据新主题查询 Token
      const primary = registry.get('--ant-color-primary', newTheme);
      assert.ok(primary, 'Should find token in new theme');

      disposable.dispose();
      done();
    });

    // 切换主题
    const targetTheme = initialTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(targetTheme);
  });

  test('token categorization', () => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    // 测试颜色类别
    const colorTokens = registry.getByCategory('color');
    assert.ok(colorTokens.length > 0, 'Should have color tokens');

    // 验证所有颜色 Token 都有颜色值
    for (const token of colorTokens) {
      if (token.isColor) {
        const hasValidColor =
          token.value.startsWith('#') ||
          token.value.startsWith('rgb') ||
          token.value.startsWith('hsl') ||
          token.value.includes('transparent') ||
          token.value.includes('inherit');
        assert.ok(
          hasValidColor,
          `Token ${token.name} should have valid color value, got: ${token.value}`
        );
      }
    }

    // 测试其他类别
    const sizeTokens = registry.getByCategory('size');
    const fontTokens = registry.getByCategory('font');
    const motionTokens = registry.getByCategory('motion');

    assert.ok(sizeTokens.length > 0, 'Should have size tokens');
    assert.ok(fontTokens.length > 0, 'Should have font tokens');
    assert.ok(motionTokens.length > 0, 'Should have motion tokens');
  });

  test('token search functionality', () => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    // 搜索颜色相关 Token
    const colorResults = registry.search('color');
    assert.ok(colorResults.length > 0, 'Should find color tokens');

    // 搜索主色
    const primaryResults = registry.search('primary');
    assert.ok(
      primaryResults.some((t) => t.name === '--ant-color-primary'),
      'Should find primary color token'
    );

    // 搜索蓝色系
    const blueResults = registry.search('blue');
    assert.ok(blueResults.length > 0, 'Should find blue tokens');
  });

  test('token description availability', () => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    // 检查常用 Token 是否有描述
    const commonTokens = [
      '--ant-color-primary',
      '--ant-color-success',
      '--ant-color-warning',
      '--ant-color-error'
    ];

    for (const tokenName of commonTokens) {
      const token = registry.get(tokenName);
      assert.ok(token, `Should find token: ${tokenName}`);
      assert.ok(
        token?.description,
        `Token ${tokenName} should have description`
      );
    }
  });

  test('performance with full token set', () => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    const startTime = Date.now();

    // 执行大量查询
    for (let i = 0; i < 1000; i++) {
      registry.get('--ant-color-primary', 'light');
      registry.search('color');
      registry.getByCategory('color');
    }

    const endTime = Date.now();
    const elapsed = endTime - startTime;

    console.log(`1000 mixed queries took ${elapsed}ms`);
    assert.ok(elapsed < 300, `Performance test failed: ${elapsed}ms > 300ms`);
  });

  test('token source tracking', () => {
    const tokens = loadBuiltinTokens();
    registry.registerBatch([...tokens.light, ...tokens.dark]);

    const allTokens = [
      ...registry.getByTheme('light'),
      ...registry.getByTheme('dark')
    ];

    // 所有内置 Token 应该标记为 builtin
    for (const token of allTokens) {
      assert.strictEqual(
        token.source,
        'builtin',
        `Token ${token.name} should be builtin`
      );
    }
  });
});
