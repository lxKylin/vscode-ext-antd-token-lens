import * as assert from 'assert';
import * as vscode from 'vscode';
import { ValueDecorator } from '@/providers/valueDecorator';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';
import { TokenMatch } from '@/tokenManager/tokenScanner';

suite('ValueDecorator Test Suite', () => {
  let decorator: ValueDecorator;
  let registry: TokenRegistry;
  let themeManager: ThemeManager;

  setup(() => {
    registry = new TokenRegistry();
    themeManager = new ThemeManager();

    registry.register({
      name: '--ant-padding',
      value: '16px',
      theme: 'light',
      category: 'size',
      isColor: false,
      description: 'Padding',
      source: 'builtin'
    });

    registry.register({
      name: '--ant-motion-duration-mid',
      value: '0.2s',
      theme: 'light',
      category: 'motion',
      isColor: false,
      description: 'Motion duration',
      source: 'builtin'
    });

    registry.register({
      name: '--ant-color-primary',
      value: '#1677ff',
      theme: 'light',
      category: 'color',
      isColor: true,
      description: 'Primary color',
      source: 'builtin'
    });

    decorator = new ValueDecorator(registry, themeManager);
  });

  teardown(() => {
    decorator.dispose();
  });

  test('decorate creates decorations for non-color tokens', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content:
        'padding: var(--ant-padding);\ntransition: var(--ant-motion-duration-mid);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-padding',
        fullMatch: 'var(--ant-padding)',
        range: new vscode.Range(0, 9, 0, 27),
        tokenRange: new vscode.Range(0, 13, 0, 26)
      },
      {
        tokenName: '--ant-motion-duration-mid',
        fullMatch: 'var(--ant-motion-duration-mid)',
        range: new vscode.Range(1, 12, 1, 42),
        tokenRange: new vscode.Range(1, 16, 1, 41)
      }
    ];

    decorator.decorate(editor, matches);

    const cache = (decorator as any).decorationTypes as Map<string, unknown>;
    assert.strictEqual(cache.size, 2);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('decorate ignores color tokens', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-color-primary',
        fullMatch: 'var(--ant-color-primary)',
        range: new vscode.Range(0, 7, 0, 32),
        tokenRange: new vscode.Range(0, 11, 0, 30)
      }
    ];

    decorator.decorate(editor, matches);

    const cache = (decorator as any).decorationTypes as Map<string, unknown>;
    assert.strictEqual(cache.size, 0);

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
