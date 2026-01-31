/**
 * CSS Parser 单元测试
 */

import * as assert from 'assert';
import {
  parseCSSVariables,
  parseCSSVariablesFromSelector,
  parseCSSVariablesFromSelectors
} from '@/tokenManager/cssParser';

suite('CSS Parser Test Suite', () => {
  test('parse simple CSS variables', () => {
    const css = `
      :root {
        --ant-color-primary: #1677ff;
        --ant-color-success: #52c41a;
      }
    `;

    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 2);

    const primary = variables.find((v) => v.name === '--ant-color-primary');
    assert.ok(primary);
    assert.strictEqual(primary.value, '#1677ff');
  });

  test('parse CSS variables with comments', () => {
    const css = `
      :root {
        /* Primary color */
        --ant-color-primary: #1677ff;
        /* --ant-commented: #000; */
        --ant-color-success: #52c41a;
      }
    `;

    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 2);
    assert.ok(!variables.some((v) => v.name === '--ant-commented'));
  });

  test('parse CSS variables with complex values', () => {
    const css = `
      :root {
        --ant-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        --ant-box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        --ant-motion-ease: cubic-bezier(0.645, 0.045, 0.355, 1);
      }
    `;

    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 3);

    const fontFamily = variables.find((v) => v.name === '--ant-font-family');
    assert.ok(fontFamily);
    assert.ok(fontFamily.value.includes('BlinkMacSystemFont'));
  });

  test('parse from specific selector', () => {
    const css = `
      :root {
        --root-var: value1;
      }

      .css-var-root {
        --ant-color-primary: #1677ff;
        --ant-color-success: #52c41a;
      }

      .other-class {
        --other-var: value2;
      }
    `;

    const variables = parseCSSVariablesFromSelector(css, '.css-var-root');
    assert.strictEqual(variables.length, 2);
    assert.ok(variables.some((v) => v.name === '--ant-color-primary'));
    assert.ok(!variables.some((v) => v.name === '--root-var'));
    assert.ok(!variables.some((v) => v.name === '--other-var'));
  });

  test('parse from multiple selectors', () => {
    const css = `
      :root {
        --ant-color-primary: #1677ff;
      }

      .css-var-root {
        --ant-color-success: #52c41a;
      }

      .qz-css-var {
        --ant-color-warning: #faad14;
      }
    `;

    const variables = parseCSSVariablesFromSelectors(css, [
      ':root',
      '.css-var-root',
      '.qz-css-var'
    ]);

    assert.strictEqual(variables.length, 3);
    assert.ok(variables.some((v) => v.name === '--ant-color-primary'));
    assert.ok(variables.some((v) => v.name === '--ant-color-success'));
    assert.ok(variables.some((v) => v.name === '--ant-color-warning'));
  });

  test('parse with duplicate variables (later overrides)', () => {
    const css = `
      :root {
        --ant-color-primary: #1677ff;
      }

      .css-var-root {
        --ant-color-primary: #0050b3;
      }
    `;

    const variables = parseCSSVariablesFromSelectors(css, [
      ':root',
      '.css-var-root'
    ]);

    assert.strictEqual(variables.length, 1);

    const primary = variables.find((v) => v.name === '--ant-color-primary');
    assert.ok(primary);
    // 后面的应该覆盖前面的
    assert.strictEqual(primary.value, '#0050b3');
  });

  test('parse variables with multiline values', () => {
    const css = `
      :root {
        --ant-font-family:
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
      }
    `;

    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 1);

    const fontFamily = variables.find((v) => v.name === '--ant-font-family');
    assert.ok(fontFamily);
    assert.ok(fontFamily.value.includes('BlinkMacSystemFont'));
  });

  test('parse empty CSS', () => {
    const css = '';
    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 0);
  });

  test('parse CSS with no variables', () => {
    const css = `
      .class {
        color: red;
        font-size: 14px;
      }
    `;

    const variables = parseCSSVariables(css);
    assert.strictEqual(variables.length, 0);
  });

  test('parse variables with special characters in selector', () => {
    const css = `
      [data-theme="dark"] {
        --ant-color-primary: #1668dc;
      }
    `;

    const variables = parseCSSVariablesFromSelector(css, '[data-theme="dark"]');
    assert.strictEqual(variables.length, 1);
    assert.strictEqual(variables[0].value, '#1668dc');
  });
});
