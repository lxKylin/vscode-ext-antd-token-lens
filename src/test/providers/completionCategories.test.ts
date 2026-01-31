import * as assert from 'assert';
import { CompletionCategories } from '../../providers/completionCategories';

suite('CompletionCategories Test Suite', () => {
  test('should get category info', () => {
    const colorCategory = CompletionCategories.getCategory('color');
    assert.strictEqual(colorCategory.name, 'color');
    assert.strictEqual(colorCategory.label, '🎨 颜色');
    assert.strictEqual(colorCategory.priority, 1);
  });

  test('should return other category for unknown category', () => {
    const unknownCategory = CompletionCategories.getCategory('unknown');
    assert.strictEqual(unknownCategory.name, 'other');
  });

  test('should get all categories sorted by priority', () => {
    const categories = CompletionCategories.getAllCategories();
    assert.ok(categories.length > 0);

    // 验证排序
    for (let i = 1; i < categories.length; i++) {
      assert.ok(categories[i - 1].priority <= categories[i].priority);
    }
  });

  test('should group tokens by category', () => {
    const tokens = [
      { name: '--ant-color-primary', category: 'color' },
      { name: '--ant-color-success', category: 'color' },
      { name: '--ant-bg-container', category: 'bg' },
      { name: '--ant-text-primary', category: 'text' }
    ];

    const groups = CompletionCategories.groupByCategory(tokens);

    assert.strictEqual(groups.get('color')?.length, 2);
    assert.strictEqual(groups.get('bg')?.length, 1);
    assert.strictEqual(groups.get('text')?.length, 1);
  });

  test('should create category separator', () => {
    const separator = CompletionCategories.createCategorySeparator('color');
    assert.ok(separator.label.toString().includes('颜色'));
  });
});
