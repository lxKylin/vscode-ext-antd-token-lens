import * as assert from 'assert';
import * as vscode from 'vscode';
import { TokenScanner } from '@/tokenManager/tokenScanner';

suite('TokenScanner Test Suite', () => {
  let scanner: TokenScanner;

  setup(() => {
    scanner = new TokenScanner();
  });

  teardown(() => {
    scanner.clearCache();
  });

  test('scan simple var() statement', () => {
    const text = 'color: var(--ant-color-primary);';
    const matches = scanner.scanLine(text, 0);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-primary');
    assert.strictEqual(matches[0].fullMatch, 'var(--ant-color-primary)');
  });

  test('scan var() with fallback', () => {
    const text = 'color: var(--ant-color-primary, #1890ff);';
    const matches = scanner.scanLine(text, 0);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-primary');
    assert.strictEqual(
      matches[0].fullMatch,
      'var(--ant-color-primary, #1890ff)'
    );
  });

  test('scan multiple tokens in one line', () => {
    const text =
      'box-shadow: 0 0 0 var(--ant-color-border), 0 2px 8px var(--ant-color-shadow);';
    const matches = scanner.scanLine(text, 0);

    assert.strictEqual(matches.length, 2);
    assert.strictEqual(matches[0].tokenName, '--ant-color-border');
    assert.strictEqual(matches[1].tokenName, '--ant-color-shadow');
  });

  test('ignore non-ant tokens', () => {
    const text = 'color: var(--custom-color);';
    const matches = scanner.scanLine(text, 0);

    assert.strictEqual(matches.length, 0);
  });

  test('scan with spaces', () => {
    const text = 'color: var( --ant-color-primary );';
    const matches = scanner.scanLine(text, 0);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-primary');
  });

  test('ignore tokens in comments', () => {
    const text =
      '/* color: var(--ant-color-primary); */ background: var(--ant-color-bg);';
    const matches = scanner.scanLine(text, 0);

    // 应该只匹配注释外的 token
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-bg');
  });

  test('isSupportedDocument - CSS file', () => {
    const mockDocument = {
      languageId: 'css'
    } as vscode.TextDocument;

    assert.strictEqual(scanner.isSupportedDocument(mockDocument), true);
  });

  test('isSupportedDocument - JavaScript file', () => {
    const mockDocument = {
      languageId: 'javascript'
    } as vscode.TextDocument;

    assert.strictEqual(scanner.isSupportedDocument(mockDocument), true);
  });

  test('isSupportedDocument - unsupported file', () => {
    const mockDocument = {
      languageId: 'plaintext'
    } as vscode.TextDocument;

    assert.strictEqual(scanner.isSupportedDocument(mockDocument), false);
  });

  test('scan range with correct positions', () => {
    const text = 'color: var(--ant-color-primary);';
    const matches = scanner.scanLine(text, 5);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].range.start.line, 5);
    assert.strictEqual(matches[0].range.start.character, 7);
    // 'var(--ant-color-primary)' 长度是 24，所以结束位置是 7 + 24 = 31
    assert.strictEqual(matches[0].range.end.character, 31);
  });

  test('cache works correctly', async () => {
    // 创建一个模拟文档
    const uri = vscode.Uri.file('/test/file.css');
    const mockDocument = {
      uri,
      version: 1,
      lineCount: 1,
      lineAt: (line: number) => ({
        text: 'color: var(--ant-color-primary);'
      })
    } as any;

    // 第一次扫描
    const matches1 = scanner.scanDocument(mockDocument);
    assert.strictEqual(matches1.length, 1);

    // 第二次扫描（应该使用缓存）
    const matches2 = scanner.scanDocument(mockDocument);
    assert.strictEqual(matches2, matches1); // 应该是同一个对象引用

    // 版本号改变后，应该重新扫描
    mockDocument.version = 2;
    const matches3 = scanner.scanDocument(mockDocument);
    assert.notStrictEqual(matches3, matches1);
  });

  test('performance: scan large text', () => {
    // 生成包含大量 token 的文本
    const lines = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`color-${i}: var(--ant-color-primary-${i % 10});`);
    }

    const start = performance.now();
    for (let i = 0; i < lines.length; i++) {
      scanner.scanLine(lines[i], i);
    }
    const duration = performance.now() - start;

    // 1000 行应该在 50ms 内完成
    assert.ok(duration < 50, `Scan took ${duration}ms, expected < 50ms`);
  });
});
