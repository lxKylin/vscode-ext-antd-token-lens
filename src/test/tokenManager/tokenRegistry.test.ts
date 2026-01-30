/**
 * TokenRegistry 单元测试
 */

import * as assert from 'assert';
import { TokenRegistry } from '../../tokenManager/tokenRegistry';
import { TokenInfo } from '../../data/antdTokens';

suite('TokenRegistry Test Suite', () => {
  let registry: TokenRegistry;

  setup(() => {
    registry = new TokenRegistry();
  });

  test('register and get token', () => {
    const token: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      description: '品牌主色',
      source: 'builtin',
      isColor: true
    };

    registry.register(token);

    const retrieved = registry.get('--ant-color-primary', 'light');
    assert.strictEqual(retrieved?.name, token.name);
    assert.strictEqual(retrieved?.value, token.value);
    assert.strictEqual(retrieved?.theme, token.theme);
  });

  test('register batch tokens', () => {
    const tokens: TokenInfo[] = [
      {
        name: '--ant-color-primary',
        value: '#1677ff',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-color-success',
        value: '#52c41a',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      }
    ];

    registry.registerBatch(tokens);

    assert.strictEqual(registry.size, 2);
    assert.strictEqual(registry.uniqueSize, 2);
  });

  test('get tokens by category', () => {
    const colorToken: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      source: 'builtin',
      isColor: true
    };

    const sizeToken: TokenInfo = {
      name: '--ant-size-unit',
      value: '4px',
      theme: 'light',
      category: 'size',
      source: 'builtin',
      isColor: false
    };

    registry.registerBatch([colorToken, sizeToken]);

    const colorTokens = registry.getByCategory('color');
    assert.strictEqual(colorTokens.length, 1);
    assert.strictEqual(colorTokens[0].name, '--ant-color-primary');

    const sizeTokens = registry.getByCategory('size');
    assert.strictEqual(sizeTokens.length, 1);
    assert.strictEqual(sizeTokens[0].name, '--ant-size-unit');
  });

  test('get tokens by theme', () => {
    const lightToken: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      source: 'builtin',
      isColor: true
    };

    const darkToken: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1668dc',
      theme: 'dark',
      category: 'color',
      source: 'builtin',
      isColor: true
    };

    registry.registerBatch([lightToken, darkToken]);

    const lightTokens = registry.getByTheme('light');
    assert.strictEqual(lightTokens.length, 1);
    assert.strictEqual(lightTokens[0].value, '#1677ff');

    const darkTokens = registry.getByTheme('dark');
    assert.strictEqual(darkTokens.length, 1);
    assert.strictEqual(darkTokens[0].value, '#1668dc');
  });

  test('search tokens', () => {
    const tokens: TokenInfo[] = [
      {
        name: '--ant-color-primary',
        value: '#1677ff',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-color-success',
        value: '#52c41a',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-size-unit',
        value: '4px',
        theme: 'light',
        category: 'size',
        source: 'builtin',
        isColor: false
      }
    ];

    registry.registerBatch(tokens);

    // 搜索 color
    const colorResults = registry.search('color');
    assert.strictEqual(colorResults.length, 2);

    // 搜索 primary
    const primaryResults = registry.search('primary');
    assert.strictEqual(primaryResults.length, 1);
    assert.strictEqual(primaryResults[0].name, '--ant-color-primary');

    // 搜索 size
    const sizeResults = registry.search('size');
    assert.strictEqual(sizeResults.length, 1);
  });

  test('search with prefix match priority', () => {
    const tokens: TokenInfo[] = [
      {
        name: '--ant-color-primary',
        value: '#1677ff',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-blue-color',
        value: '#1677ff',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      }
    ];

    registry.registerBatch(tokens);

    const results = registry.search('--ant-color');
    // 前缀匹配应该排在前面
    assert.strictEqual(results[0].name, '--ant-color-primary');
  });

  test('has method', () => {
    const token: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      source: 'builtin',
      isColor: true
    };

    assert.strictEqual(registry.has('--ant-color-primary'), false);

    registry.register(token);

    assert.strictEqual(registry.has('--ant-color-primary'), true);
    assert.strictEqual(registry.has('--ant-color-success'), false);
  });

  test('clear method', () => {
    const token: TokenInfo = {
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      source: 'builtin',
      isColor: true
    };

    registry.register(token);
    assert.strictEqual(registry.size, 1);

    registry.clear();
    assert.strictEqual(registry.size, 0);
    assert.strictEqual(registry.has('--ant-color-primary'), false);
  });

  test('getAllTokenNames', () => {
    const tokens: TokenInfo[] = [
      {
        name: '--ant-color-primary',
        value: '#1677ff',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-color-primary',
        value: '#1668dc',
        theme: 'dark',
        category: 'color',
        source: 'builtin',
        isColor: true
      },
      {
        name: '--ant-color-success',
        value: '#52c41a',
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      }
    ];

    registry.registerBatch(tokens);

    const names = registry.getAllTokenNames();
    assert.strictEqual(names.length, 2); // 去重后应该只有两个不同的名称
    assert.ok(names.includes('--ant-color-primary'));
    assert.ok(names.includes('--ant-color-success'));
  });

  test('performance test', () => {
    // 创建大量 Token
    const tokens: TokenInfo[] = [];
    for (let i = 0; i < 1000; i++) {
      tokens.push({
        name: `--ant-test-${i}`,
        value: `#${i.toString(16).padStart(6, '0')}`,
        theme: 'light',
        category: 'color',
        source: 'builtin',
        isColor: true
      });
    }

    registry.registerBatch(tokens);

    // 测试查询性能
    const startTime = Date.now();
    for (let i = 0; i < 10000; i++) {
      registry.get(`--ant-test-${i % 1000}`, 'light');
    }
    const endTime = Date.now();

    const elapsed = endTime - startTime;
    console.log(`10000 queries took ${elapsed}ms`);

    // 应该在 100ms 内完成
    assert.ok(elapsed < 100, `Performance test failed: ${elapsed}ms > 100ms`);
  });
});
