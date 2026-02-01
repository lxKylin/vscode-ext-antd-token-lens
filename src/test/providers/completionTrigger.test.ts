import * as assert from 'assert';
import * as vscode from 'vscode';
import { CompletionTrigger } from '../../providers/completionTrigger';

suite('CompletionTrigger Test Suite', () => {
  test('should detect inside var() context', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: var(--ant',
      language: 'css'
    });

    const position = new vscode.Position(0, 16);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '-'
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);

    assert.strictEqual(result.isInsideVar, true);
    assert.strictEqual(result.shouldComplete, true);
  });

  test('should extract filter text', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: var(--ant-color',
      language: 'css'
    });

    const position = new vscode.Position(0, 22);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);

    assert.strictEqual(result.filterText, '--ant-color');
  });

  test('should detect CSS variable definition', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: ':root {\n  --ant-color',
      language: 'css'
    });

    const position = new vscode.Position(1, 11);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);

    assert.strictEqual(result.isCssVarDefinition, true);
  });

  test('should determine completion type as name-only inside var()', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: var(--ant',
      language: 'css'
    });

    const position = new vscode.Position(0, 16);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: '-'
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);
    const completionType = CompletionTrigger.getCompletionType(result);

    assert.strictEqual(completionType, 'name-only');
  });

  test('should determine completion type as full outside var()', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: --ant',
      language: 'css'
    });

    const position = new vscode.Position(0, 12);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);
    const completionType = CompletionTrigger.getCompletionType(result);

    // 在非 var() 和非 CSS 变量定义位置，应该返回 full
    assert.strictEqual(completionType, 'full');
  });

  test('should trigger on manual invoke', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: test',
      language: 'css'
    });

    const position = new vscode.Position(0, 11);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.Invoke
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);

    // 手动触发应该总是返回 true
    assert.strictEqual(result.shouldComplete, true);
  });

  test('should trigger on incomplete completions inside var()', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'color: var(--',
      language: 'css'
    });

    const position = new vscode.Position(0, 13);
    const context = {
      triggerKind: vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
    };

    const result = CompletionTrigger.analyze(doc, position, context as any);
    assert.strictEqual(result.isInsideVar, true);
    assert.strictEqual(result.shouldComplete, true);
  });
});
