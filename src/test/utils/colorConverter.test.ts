import * as assert from 'assert';
import * as vscode from 'vscode';
import { ColorConverter } from '../../utils/colorConverter';

suite('ColorConverter Test Suite', () => {
  test('convert hex to all formats', () => {
    const formats = ColorConverter.convertToAllFormats('#1677ff');

    assert.ok(formats, 'Should convert color');
    assert.strictEqual(
      formats.hex.toUpperCase(),
      '#1677FF',
      'HEX should match'
    );
    assert.ok(formats.rgb.startsWith('rgb('), 'RGB should be valid');
    assert.ok(formats.hsl.startsWith('hsl('), 'HSL should be valid');
  });

  test('validate color', () => {
    assert.strictEqual(ColorConverter.isValidColor('#1677ff'), true);
    assert.strictEqual(ColorConverter.isValidColor('rgb(22, 119, 255)'), true);
    assert.strictEqual(ColorConverter.isValidColor('invalid'), false);
  });

  test('calculate luminance', () => {
    const luminance = ColorConverter.getLuminance('#1677ff');
    assert.ok(
      luminance >= 0 && luminance <= 1,
      'Luminance should be between 0 and 1'
    );
  });

  test('determine if color is dark', () => {
    assert.strictEqual(ColorConverter.isDark('#000000'), true);
    assert.strictEqual(ColorConverter.isDark('#ffffff'), false);
    assert.strictEqual(ColorConverter.isDark('#1677ff'), true);
  });

  test('get contrast color', () => {
    assert.strictEqual(ColorConverter.getContrastColor('#000000'), '#ffffff');
    assert.strictEqual(ColorConverter.getContrastColor('#ffffff'), '#000000');
  });
});
