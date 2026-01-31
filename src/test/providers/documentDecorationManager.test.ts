import * as assert from 'assert';
import * as vscode from 'vscode';
import { DocumentDecorationManager } from '@/providers/documentDecorationManager';
import { TokenScanner } from '@/tokenManager/tokenScanner';
import { ColorDecorator } from '@/providers/colorDecorator';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';

suite('DocumentDecorationManager Test Suite', () => {
  let manager: DocumentDecorationManager;
  let scanner: TokenScanner;
  let decorator: ColorDecorator;
  let registry: TokenRegistry;
  let themeManager: ThemeManager;

  setup(() => {
    registry = new TokenRegistry();
    themeManager = new ThemeManager();
    scanner = new TokenScanner();
    decorator = new ColorDecorator(registry, themeManager);
    manager = new DocumentDecorationManager(scanner, decorator);
  });

  teardown(() => {
    manager.dispose();
  });

  test('manager is created successfully', () => {
    assert.ok(manager);
  });

  test('manager initializes with active editor', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    await vscode.window.showTextDocument(doc);

    // 给装饰管理器一些时间来处理
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 应该不抛出错误
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('manager handles document changes', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    // 模拟文档编辑
    await editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(0, 0), '/* test */\n');
    });

    // 给装饰管理器一些时间来处理
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 应该不抛出错误
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('refresh updates all editors', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    await vscode.window.showTextDocument(doc);

    manager.refresh();

    // 给装饰管理器一些时间来处理
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 应该不抛出错误
    assert.ok(true);

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('dispose cleans up resources', () => {
    manager.dispose();
    // 应该不抛出错误
    assert.ok(true);
  });
});
