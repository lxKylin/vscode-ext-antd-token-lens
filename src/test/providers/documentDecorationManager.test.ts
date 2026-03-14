import * as assert from 'assert';
import * as vscode from 'vscode';
import { DocumentDecorationManager } from '@/providers/documentDecorationManager';
import { TokenDecorator } from '@/providers/tokenDecorator';
import { TokenScanner } from '@/tokenManager/tokenScanner';

suite('DocumentDecorationManager Test Suite', () => {
  let manager: DocumentDecorationManager;
  let scanner: TokenScanner;
  let decorators: TestDecorator[];

  class TestDecorator implements TokenDecorator {
    configurationSection: string;
    decorateCalls = 0;
    clearCalls = 0;
    refreshCalls = 0;
    disposeCalls = 0;

    constructor(section: string) {
      this.configurationSection = section;
    }

    decorate(): void {
      this.decorateCalls += 1;
    }

    clear(): void {
      this.clearCalls += 1;
    }

    refresh(): void {
      this.refreshCalls += 1;
    }

    isEnabled(): boolean {
      return true;
    }

    dispose(): void {
      this.disposeCalls += 1;
    }
  }

  setup(() => {
    scanner = new TokenScanner();
    decorators = [
      new TestDecorator('antdToken.colorDecorator'),
      new TestDecorator('antdToken.valueDecorator')
    ];
    manager = new DocumentDecorationManager(scanner, decorators);
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

    assert.ok(
      decorators.every((decorator) => decorator.decorateCalls > 0),
      'All decorators should be invoked for supported editors'
    );

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

    assert.ok(
      decorators.every((decorator) => decorator.decorateCalls > 0),
      'Decorators should still run after document changes'
    );

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

    assert.ok(
      decorators.every((decorator) => decorator.refreshCalls > 0),
      'Refresh should fan out to all decorators'
    );

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('dispose cleans up resources', () => {
    manager.dispose();
    assert.ok(
      decorators.every((decorator) => decorator.disposeCalls > 0),
      'Dispose should clean up all decorators'
    );
  });
});
