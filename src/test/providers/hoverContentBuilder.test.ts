import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { HoverContentBuilder } from '@/providers/hoverContentBuilder';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';
import { SourceType } from '@/tokenManager/sourceTypes';

suite('HoverContentBuilder Test Suite', () => {
  test('active named theme is shown before other variants', () => {
    const registry = new TokenRegistry();
    const themeManager = new ThemeManager();
    registry.setActiveThemeResolver(() =>
      themeManager.getCurrentThemeDescriptor()
    );
    themeManager.setAvailableThemes([
      { id: 'brand-a', name: 'brand-a', baseTheme: 'light', priority: 5 },
      { id: 'brand-b', name: 'brand-b', baseTheme: 'light', priority: 6 }
    ]);
    themeManager.setPreviewTheme('brand-b');

    registry.registerBatch([
      {
        name: '--ant-color-primary',
        value: '#1677ff',
        theme: 'light',
        baseTheme: 'light',
        themeId: 'light',
        themeName: 'light',
        category: 'color',
        source: 'builtin',
        sourceType: SourceType.BUILTIN,
        isColor: true
      },
      {
        name: '--ant-color-primary',
        value: '#13c2c2',
        theme: 'light',
        baseTheme: 'light',
        themeId: 'brand-a',
        themeName: 'brand-a',
        category: 'color',
        source: 'custom',
        sourceType: SourceType.ANTD_THEME,
        isColor: true
      },
      {
        name: '--ant-color-primary',
        value: '#722ed1',
        theme: 'light',
        baseTheme: 'light',
        themeId: 'brand-b',
        themeName: 'brand-b',
        category: 'color',
        source: 'custom',
        sourceType: SourceType.ANTD_THEME,
        isColor: true
      }
    ]);

    const builder = new HoverContentBuilder(registry, themeManager);
    const content = builder.build('--ant-color-primary');
    const contentValue = content?.value || '';

    assert.ok(content instanceof vscode.MarkdownString);
    assert.ok(contentValue.includes('brand-b (light)'));
    assert.ok(contentValue.includes('当前 brand-b (light)'));
    assert.ok(
      contentValue.indexOf('当前 brand-b (light)') <
        contentValue.indexOf('候选 brand-a (light)')
    );

    themeManager.dispose();
  });
});
