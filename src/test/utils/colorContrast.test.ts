import * as assert from 'assert';
import { ColorContrast } from '../../utils/colorContrast';

suite('ColorContrast Test Suite', () => {
  test('calculate contrast ratio', () => {
    const contrast = ColorContrast.calculateContrast('#000000', '#ffffff');
    assert.ok(contrast >= 20, 'Black and white should have high contrast');
  });

  test('check WCAG AA compliance', () => {
    // 黑色文字在白色背景上
    assert.strictEqual(
      ColorContrast.meetsWCAG('#000000', '#ffffff', 'AA', 'normal'),
      true,
      'Should meet WCAG AA'
    );

    // 浅灰色文字在白色背景上
    assert.strictEqual(
      ColorContrast.meetsWCAG('#cccccc', '#ffffff', 'AA', 'normal'),
      false,
      'Should not meet WCAG AA'
    );
  });

  test('get contrast label', () => {
    assert.strictEqual(ColorContrast.getContrastLabel(21), '优秀 (AAA)');
    assert.strictEqual(ColorContrast.getContrastLabel(7), '优秀 (AAA)');
    assert.strictEqual(ColorContrast.getContrastLabel(5), '良好 (AA)');
    assert.strictEqual(ColorContrast.getContrastLabel(3.5), '一般 (AA Large)');
    assert.strictEqual(ColorContrast.getContrastLabel(2), '不佳');
  });
});
