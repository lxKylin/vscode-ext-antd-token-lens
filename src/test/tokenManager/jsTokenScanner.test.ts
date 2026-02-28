import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsTokenScanner } from '@/tokenManager/jsTokenScanner';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';

// 构造模拟 Registry
const mockRegistry = {
  has: (name: string) =>
    name === '--ant-color-primary' || name === '--ant-font-size'
} as unknown as TokenRegistry;

const mockThemeManager = {
  getCurrentTheme: () => 'light' as const
} as unknown as ThemeManager;

/** 创建一个模拟 TextDocument */
function makeDocument(
  lines: string[],
  languageId: string = 'typescript',
  version: number = 1,
  uriPath: string = '/test/file.ts'
): vscode.TextDocument {
  return {
    uri: vscode.Uri.file(uriPath),
    languageId,
    version,
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] }),
    getText: () => lines.join('\n')
  } as any;
}

suite('JsTokenScanner Test Suite', () => {
  let scanner: JsTokenScanner;

  setup(() => {
    scanner = new JsTokenScanner(mockRegistry, mockThemeManager);
  });

  teardown(() => {
    scanner.clearCache();
  });

  // ── 属性访问识别 ──────────────────────────────────────────────

  test('识别 token.colorPrimary，tokenName 为 --ant-color-primary', () => {
    const doc = makeDocument(['const c = token.colorPrimary;']);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-primary');
    assert.strictEqual(matches[0].fullMatch, 'token.colorPrimary');
  });

  test('识别 useToken() 别名 antdToken.colorPrimary', () => {
    const doc = makeDocument([
      'const { token: antdToken } = useToken();',
      'const c = antdToken.colorPrimary;'
    ]);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].tokenName, '--ant-color-primary');
    assert.strictEqual(matches[0].fullMatch, 'antdToken.colorPrimary');
  });

  test('忽略 Registry 中不存在的 token（如 token.unknownToken）', () => {
    const doc = makeDocument(['const c = token.unknownToken;']);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 0);
  });

  test('忽略非 token/theme 对象（如 obj.colorPrimary）', () => {
    const doc = makeDocument(['const c = obj.colorPrimary;']);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 0);
  });

  // ── 范围计算 ─────────────────────────────────────────────────

  test('tokenRange 只覆盖 camelCase 名称部分（不含 token.）', () => {
    const line = 'const c = token.colorPrimary;';
    const doc = makeDocument([line]);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 1);
    const { tokenRange } = matches[0];
    // 'token.colorPrimary' starts at index 10, 'colorPrimary' starts at 16
    const tokenNameStart = line.indexOf('colorPrimary');
    assert.strictEqual(tokenRange.start.character, tokenNameStart);
    assert.strictEqual(
      tokenRange.end.character,
      tokenNameStart + 'colorPrimary'.length
    );
  });

  test('range 覆盖完整 token.colorPrimary', () => {
    const line = 'const c = token.colorPrimary;';
    const doc = makeDocument([line]);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 1);
    const { range } = matches[0];
    const fullStart = line.indexOf('token.colorPrimary');
    assert.strictEqual(range.start.character, fullStart);
    assert.strictEqual(
      range.end.character,
      fullStart + 'token.colorPrimary'.length
    );
  });

  test('多个 token 在同一行时均能识别', () => {
    const doc = makeDocument([
      'const s = `${token.colorPrimary} ${token.fontSize}`;'
    ]);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 2);
    const names = matches.map((m) => m.tokenName);
    assert.ok(names.includes('--ant-color-primary'));
    assert.ok(names.includes('--ant-font-size'));
  });

  // ── 边界情况 ─────────────────────────────────────────────────

  test('跳过 // 单行注释行', () => {
    const doc = makeDocument(['// const c = token.colorPrimary;']);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 0);
  });

  test('跳过 * 开头的块注释行', () => {
    const doc = makeDocument(['  * token.colorPrimary some docs']);
    const matches = scanner.scanDocument(doc);

    assert.strictEqual(matches.length, 0);
  });

  test('相同文档 version 返回缓存（同一对象引用）', () => {
    const doc = makeDocument(['const c = token.colorPrimary;']);

    const matches1 = scanner.scanDocument(doc);
    const matches2 = scanner.scanDocument(doc);

    assert.strictEqual(
      matches1,
      matches2,
      'Should return the same cached array reference'
    );
  });

  test('version 变化后重新扫描', () => {
    const lines = ['const c = token.colorPrimary;'];
    const doc = makeDocument(lines, 'typescript', 1) as any;

    const matches1 = scanner.scanDocument(doc);

    // 模拟文档版本更新
    doc.version = 2;
    doc.lineAt = (line: number) => ({ text: 'const c = token.fontSize;' });

    const matches2 = scanner.scanDocument(doc);

    assert.notStrictEqual(
      matches2,
      matches1,
      'Should re-scan on version change'
    );
    assert.strictEqual(matches2.length, 1);
    assert.strictEqual(matches2[0].tokenName, '--ant-font-size');
  });

  test('isSupportedDocument: typescript 返回 true', () => {
    const doc = { languageId: 'typescript' } as vscode.TextDocument;
    assert.strictEqual(scanner.isSupportedDocument(doc), true);
  });

  test('isSupportedDocument: css 返回 false', () => {
    const doc = { languageId: 'css' } as vscode.TextDocument;
    assert.strictEqual(scanner.isSupportedDocument(doc), false);
  });

  test('clearCache(uri) 清除指定缓存', () => {
    const uri = '/test/specific.ts';
    const doc = makeDocument(
      ['const c = token.colorPrimary;'],
      'typescript',
      1,
      uri
    ) as any;

    const matches1 = scanner.scanDocument(doc);
    assert.strictEqual(matches1.length, 1);

    scanner.clearCache(doc.uri.toString());

    // 缓存已清除，重新扫描（同 version 但缓存已删除，所以会重新计算）
    doc.version = 1; // 保持 version 不变，确认是通过清缓存触发重新扫描
    // 修改内容来验证缓存确实被清除
    doc.lineAt = (line: number) => ({ text: '' });
    const matches2 = scanner.scanDocument(doc);
    assert.notStrictEqual(matches2, matches1);
    assert.strictEqual(matches2.length, 0);
  });

  test('clearCache() 清除全部缓存', () => {
    const doc1 = makeDocument(
      ['const c = token.colorPrimary;'],
      'typescript',
      1,
      '/test/a.ts'
    ) as any;
    const doc2 = makeDocument(
      ['const s = token.fontSize;'],
      'typescript',
      1,
      '/test/b.ts'
    ) as any;

    const m1 = scanner.scanDocument(doc1);
    const m2 = scanner.scanDocument(doc2);
    assert.strictEqual(m1.length, 1);
    assert.strictEqual(m2.length, 1);

    scanner.clearCache();

    // 清除后修改内容，验证重新扫描
    doc1.lineAt = () => ({ text: '' });
    doc2.lineAt = () => ({ text: '' });

    const m1After = scanner.scanDocument(doc1);
    const m2After = scanner.scanDocument(doc2);
    assert.notStrictEqual(m1After, m1);
    assert.notStrictEqual(m2After, m2);
    assert.strictEqual(m1After.length, 0);
    assert.strictEqual(m2After.length, 0);
  });
});
