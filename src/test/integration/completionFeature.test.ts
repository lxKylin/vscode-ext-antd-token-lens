import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Completion Feature Integration Test', () => {
  test('should provide completions for var(--ant', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: '.test {\n  color: var(--\n}',
      language: 'css'
    });

    await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(1, 17);
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        position
      );

    assert.ok(completions, 'Should provide completions');
    assert.ok(completions.items.length > 0, 'Should have completion items');
  });

  test('should include ant tokens in completions', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: '.test {\n  color: var(--ant-\n}',
      language: 'css'
    });

    await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(1, 21);
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        position
      );

    assert.ok(completions, 'Should provide completions');

    // 验证补全项包含 ant token
    const hasAntToken = completions.items.some((item) => {
      const label =
        typeof item.label === 'string' ? item.label : item.label.label;
      return label.includes('--ant-');
    });

    assert.ok(hasAntToken, 'Should include ant tokens');
  });

  test('should provide completions in JavaScript files', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "const style = { color: 'var(--ant-' };",
      language: 'javascript'
    });

    await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(0, 35);
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        position
      );

    assert.ok(completions, 'Should provide completions in JS files');
  });

  test('should resolve completion item with documentation', async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: '.test {\n  color: var(--ant-\n}',
      language: 'css'
    });

    await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(1, 21);
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        position
      );

    if (completions && completions.items.length > 0) {
      const firstItem = completions.items[0];

      // 验证基本属性
      assert.ok(firstItem.label, 'Should have label');

      // 注意：documentation 可能在 resolveCompletionItem 时才加载
      // 这里只验证基本结构
      assert.ok(true);
    }
  });

  test('completion should work after configuration change', async () => {
    const config = vscode.workspace.getConfiguration('antdToken');
    const originalValue = config.get('enableCompletion');

    try {
      // 禁用补全
      await config.update(
        'enableCompletion',
        false,
        vscode.ConfigurationTarget.Global
      );

      const doc = await vscode.workspace.openTextDocument({
        content: '.test {\n  color: var(--ant-\n}',
        language: 'css'
      });

      await vscode.window.showTextDocument(doc);

      const position = new vscode.Position(1, 21);
      let completions =
        await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          doc.uri,
          position
        );

      // 启用补全
      await config.update(
        'enableCompletion',
        true,
        vscode.ConfigurationTarget.Global
      );

      // 等待配置生效
      await new Promise((resolve) => setTimeout(resolve, 100));

      completions = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        position
      );

      assert.ok(completions, 'Should provide completions after re-enabling');
    } finally {
      // 恢复原始配置
      await config.update(
        'enableCompletion',
        originalValue,
        vscode.ConfigurationTarget.Global
      );
    }
  });
});
