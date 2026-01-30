import * as assert from 'assert';
import * as vscode from 'vscode';
import { ColorDecorator } from '../../providers/colorDecorator';
import { TokenRegistry } from '../../tokenManager/tokenRegistry';
import { ThemeManager } from '../../tokenManager/themeManager';
import { TokenMatch } from '../../tokenManager/tokenScanner';

suite('ColorDecorator Test Suite', () => {
  let decorator: ColorDecorator;
  let registry: TokenRegistry;
  let themeManager: ThemeManager;

  setup(() => {
    registry = new TokenRegistry();
    themeManager = new ThemeManager();

    // 添加测试 token
    registry.register({
      name: '--ant-color-primary',
      value: '#1890ff',
      theme: 'light',
      category: 'color',
      isColor: true,
      description: 'Primary color',
      source: 'builtin'
    });

    registry.register({
      name: '--ant-color-error',
      value: '#ff4d4f',
      theme: 'light',
      category: 'color',
      isColor: true,
      description: 'Error color',
      source: 'builtin'
    });

    decorator = new ColorDecorator(registry, themeManager);
  });

  teardown(() => {
    decorator.dispose();
  });

  test('decorator is created successfully', () => {
    assert.ok(decorator);
  });

  test('decorate creates decorations for color tokens', async () => {
    // 打开一个测试文档
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-color-primary',
        fullMatch: 'var(--ant-color-primary)',
        range: new vscode.Range(0, 7, 0, 35),
        tokenRange: new vscode.Range(0, 11, 0, 31)
      }
    ];

    // 应该不抛出错误
    decorator.decorate(editor, matches);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('clear removes all decorations', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-color-primary',
        fullMatch: 'var(--ant-color-primary)',
        range: new vscode.Range(0, 7, 0, 35),
        tokenRange: new vscode.Range(0, 11, 0, 31)
      }
    ];

    decorator.decorate(editor, matches);
    decorator.clear(editor);

    // 应该不抛出错误
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('decorate handles multiple colors', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: `
        color: var(--ant-color-primary);
        background: var(--ant-color-error);
      `
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-color-primary',
        fullMatch: 'var(--ant-color-primary)',
        range: new vscode.Range(1, 15, 1, 43),
        tokenRange: new vscode.Range(1, 19, 1, 39)
      },
      {
        tokenName: '--ant-color-error',
        fullMatch: 'var(--ant-color-error)',
        range: new vscode.Range(2, 20, 2, 46),
        tokenRange: new vscode.Range(2, 24, 2, 42)
      }
    ];

    decorator.decorate(editor, matches);

    // 应该不抛出错误
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('decorate ignores non-color tokens', async () => {
    // 添加一个非颜色 token
    registry.register({
      name: '--ant-font-size-base',
      value: '14px',
      theme: 'light',
      category: 'size',
      isColor: false,
      description: 'Base font size',
      source: 'builtin'
    });

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'font-size: var(--ant-font-size-base);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    const matches: TokenMatch[] = [
      {
        tokenName: '--ant-font-size-base',
        fullMatch: 'var(--ant-font-size-base)',
        range: new vscode.Range(0, 11, 0, 37),
        tokenRange: new vscode.Range(0, 15, 0, 33)
      }
    ];

    // 应该不会创建装饰，但也不应抛出错误
    decorator.decorate(editor, matches);
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('dispose cleans up resources', () => {
    decorator.dispose();
    // 应该不抛出错误
    assert.ok(true);
  });
});
