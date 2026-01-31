import * as assert from 'assert';
import { CompletionSorter } from '../../providers/completionSorter';

suite('CompletionSorter Test Suite', () => {
  test('should sort by exact match first', () => {
    const tokens = [
      { name: '--ant-color-primary', category: 'color' },
      { name: '--ant-color', category: 'color' },
      { name: '--ant-primary', category: 'color' }
    ];

    const sorted = CompletionSorter.sort(tokens, {
      filterText: '--ant-color',
      recentTokens: [],
      showRecentFirst: false
    });

    assert.strictEqual(sorted[0].name, '--ant-color');
  });

  test('should sort recent tokens first when enabled', () => {
    const tokens = [
      { name: '--ant-color-primary', category: 'color' },
      { name: '--ant-color-success', category: 'color' },
      { name: '--ant-color-warning', category: 'color' }
    ];

    const sorted = CompletionSorter.sort(tokens, {
      filterText: '',
      recentTokens: ['--ant-color-warning', '--ant-color-primary'],
      showRecentFirst: true
    });

    assert.strictEqual(sorted[0].name, '--ant-color-warning');
    assert.strictEqual(sorted[1].name, '--ant-color-primary');
  });

  test('should sort by prefix match', () => {
    const tokens = [
      { name: '--ant-primary-color', category: 'color' },
      { name: '--ant-color-primary', category: 'color' },
      { name: '--ant-color', category: 'color' }
    ];

    const sorted = CompletionSorter.sort(tokens, {
      filterText: '--ant-color',
      recentTokens: [],
      showRecentFirst: false
    });

    // 完全匹配应该在最前面
    assert.strictEqual(sorted[0].name, '--ant-color');
    // 前缀匹配应该在第二
    assert.strictEqual(sorted[1].name, '--ant-color-primary');
  });

  test('should calculate match score correctly', () => {
    const score1 = CompletionSorter.calculateMatchScore(
      '--ant-color-primary',
      '--ant-color'
    );
    const score2 = CompletionSorter.calculateMatchScore(
      '--ant-primary-color',
      '--ant-color'
    );

    // 前缀匹配应该得分更高
    assert.ok(score1 > score2);
  });

  test('should calculate exact match score', () => {
    const score = CompletionSorter.calculateMatchScore(
      '--ant-color',
      '--ant-color'
    );
    assert.strictEqual(score, 100);
  });

  test('should calculate prefix match score', () => {
    const score = CompletionSorter.calculateMatchScore(
      '--ant-color-primary',
      '--ant-color'
    );
    assert.strictEqual(score, 80);
  });

  test('should sort by category priority', () => {
    const tokens = [
      { name: '--ant-shadow', category: 'shadow' },
      { name: '--ant-color', category: 'color' },
      { name: '--ant-bg', category: 'bg' }
    ];

    const sorted = CompletionSorter.sort(tokens, {
      filterText: '',
      recentTokens: [],
      showRecentFirst: false
    });

    // color 优先级最高
    assert.strictEqual(sorted[0].name, '--ant-color');
    // bg 第二
    assert.strictEqual(sorted[1].name, '--ant-bg');
    // shadow 最低
    assert.strictEqual(sorted[2].name, '--ant-shadow');
  });
});
