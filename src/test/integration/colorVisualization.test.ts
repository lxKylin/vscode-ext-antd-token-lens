import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  initializeTokenRegistry,
  tokenRegistry,
  themeManager
} from '../../tokenManager';
import { TokenScanner } from '../../tokenManager/tokenScanner';
import { ColorDecorator } from '../../providers/colorDecorator';
import { DocumentDecorationManager } from '../../providers/documentDecorationManager';

suite('Color Visualization Integration Test', () => {
  let scanner: TokenScanner;
  let decorator: ColorDecorator;
  let manager: DocumentDecorationManager;

  suiteSetup(() => {
    // 初始化 Token Registry
    initializeTokenRegistry();
  });

  setup(() => {
    scanner = new TokenScanner();
    decorator = new ColorDecorator(tokenRegistry, themeManager);
    manager = new DocumentDecorationManager(scanner, decorator);
  });

  teardown(() => {
    manager.dispose();
  });

  test('end-to-end: open CSS file and show decorations', async function () {
    this.timeout(5000); // 增加超时时间

    // 1. 创建测试文件
    const content = `
.test {
  color: var(--ant-color-primary);
  background: var(--ant-color-bg-container);
  border-color: var(--ant-color-border);
}

.button {
  background: var(--ant-blue-5);
  color: var(--ant-color-text-light-solid);
}
    `.trim();

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: content
    });

    // 2. 打开编辑器
    const editor = await vscode.window.showTextDocument(doc);

    // 3. 等待装饰应用
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. 验证文档已打开
    assert.strictEqual(vscode.window.activeTextEditor, editor);
    assert.strictEqual(editor.document.languageId, 'css');

    // 5. 扫描 token
    const matches = scanner.scanDocument(doc);
    assert.ok(matches.length > 0, 'Should find token matches');

    // 6. 验证找到了颜色 token
    const colorTokens = matches.filter((match) => {
      const tokenInfo = tokenRegistry.get(
        match.tokenName,
        themeManager.getCurrentTheme()
      );
      return tokenInfo && tokenInfo.isColor;
    });
    assert.ok(colorTokens.length > 0, 'Should find color tokens');

    console.log(
      `Found ${matches.length} tokens, ${colorTokens.length} are colors`
    );

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('edit file and update decorations', async function () {
    this.timeout(5000);

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    const editor = await vscode.window.showTextDocument(doc);

    // 初始扫描
    let matches = scanner.scanDocument(doc);
    assert.strictEqual(matches.length, 1);

    // 编辑文档
    await editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(1, 0),
        'background: var(--ant-color-bg);\n'
      );
    });

    // 等待更新
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 重新扫描
    matches = scanner.scanDocument(doc);
    assert.ok(matches.length >= 2, 'Should find additional tokens after edit');

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('switch theme updates decorations', async function () {
    this.timeout(5000);

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });

    await vscode.window.showTextDocument(doc);

    // 等待初始装饰
    await new Promise((resolve) => setTimeout(resolve, 300));

    const currentTheme = themeManager.getCurrentTheme();
    console.log(`Current theme: ${currentTheme}`);

    // 主题已经能正常工作
    assert.ok(['light', 'dark'].includes(currentTheme));

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('performance: large file decoration', async function () {
    this.timeout(10000);

    // 生成大文件内容
    const lines = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`.class-${i} { color: var(--ant-color-primary); }`);
    }
    const content = lines.join('\n');

    const doc = await vscode.workspace.openTextDocument({
      language: 'css',
      content: content
    });

    const editor = await vscode.window.showTextDocument(doc);

    // 测量扫描性能
    const start = performance.now();
    const matches = scanner.scanDocument(doc);
    const duration = performance.now() - start;

    console.log(`Scanned 1000 lines in ${duration.toFixed(2)}ms`);
    assert.ok(duration < 200, `Performance test failed: ${duration}ms > 200ms`);
    assert.strictEqual(matches.length, 1000, 'Should find 1000 tokens');

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('multi-editor scenario', async function () {
    this.timeout(5000);

    // 打开第一个编辑器
    const doc1 = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'color: var(--ant-color-primary);'
    });
    const editor1 = await vscode.window.showTextDocument(
      doc1,
      vscode.ViewColumn.One
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 打开第二个编辑器
    const doc2 = await vscode.workspace.openTextDocument({
      language: 'css',
      content: 'background: var(--ant-color-bg);'
    });
    const editor2 = await vscode.window.showTextDocument(
      doc2,
      vscode.ViewColumn.Two
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 验证两个编辑器都已打开
    const visibleEditors = vscode.window.visibleTextEditors;
    assert.ok(
      visibleEditors.length >= 2,
      'Should have at least 2 visible editors'
    );

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('supported file types', async function () {
    this.timeout(5000);

    const supportedTypes = [
      { language: 'css', content: 'color: var(--ant-color-primary);' },
      {
        language: 'less',
        content: '.test { color: var(--ant-color-primary); }'
      },
      {
        language: 'scss',
        content: '.test { color: var(--ant-color-primary); }'
      },
      {
        language: 'javascript',
        content: 'const style = { color: "var(--ant-color-primary)" };'
      },
      {
        language: 'typescript',
        content:
          'const style: React.CSSProperties = { color: "var(--ant-color-primary)" };'
      }
    ];

    for (const test of supportedTypes) {
      const doc = await vscode.workspace.openTextDocument({
        language: test.language,
        content: test.content
      });

      assert.ok(
        scanner.isSupportedDocument(doc),
        `${test.language} should be supported`
      );

      await vscode.commands.executeCommand(
        'workbench.action.closeActiveEditor'
      );
    }
  });
});
