import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsTokenCompletionProvider } from '@/providers/javascript/jsCompletionProvider';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';

const mockTokenInfo = {
  name: '--ant-color-primary',
  value: '#1677ff',
  isColor: true,
  category: 'Color',
  theme: 'light' as const,
  description: '品牌主色'
};

const mockRegistry = {
  getByTheme: (_theme: string) => [mockTokenInfo]
} as unknown as TokenRegistry;

const mockThemeManager = {
  getCurrentTheme: () => 'light' as const
} as unknown as ThemeManager;

// 创建模拟文档
function makeDocument(content: string): vscode.TextDocument {
  return {
    lineAt: (lineOrPos: number | vscode.Position) => {
      const lineNum =
        typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line;
      const lines = content.split('\n');
      return {
        text: lines[lineNum] ?? '',
        lineNumber: lineNum
      } as vscode.TextLine;
    },
    getText: () => content
  } as unknown as vscode.TextDocument;
}

suite('JsTokenCompletionProvider Test Suite', () => {
  test('token. 后触发补全，返回非空数组', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const doc = makeDocument('const x = token.');
    const position = new vscode.Position(0, 16);
    const result = provider.provideCompletionItems(doc, position);
    assert.ok(Array.isArray(result) && result.length > 0, '应返回非空补全数组');
  });

  test('useToken() 解构别名后触发补全，返回非空数组', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const content =
      'const { token: antdToken } = useToken();\nconst x = antdToken.';
    const doc = makeDocument(content);
    const position = new vscode.Position(1, 20);
    const result = provider.provideCompletionItems(doc, position);
    assert.ok(Array.isArray(result) && result.length > 0, '应返回非空补全数组');
  });

  test('补全项 label 应为 camelCase 名（colorPrimary）而非 CSS 名', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const doc = makeDocument('token.');
    const position = new vscode.Position(0, 6);
    const result = provider.provideCompletionItems(doc, position);
    assert.ok(result && result.length > 0, '应返回补全数组');
    const item = result![0];
    const label =
      typeof item.label === 'string'
        ? item.label
        : (item.label as vscode.CompletionItemLabel).label;
    assert.strictEqual(label, 'colorPrimary', 'label 应为 camelCase 名');
  });

  test('非 token./theme. 上下文不触发补全（返回 undefined）', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const doc = makeDocument('const x = colorPrimary;');
    const position = new vscode.Position(0, 22);
    const result = provider.provideCompletionItems(doc, position);
    assert.strictEqual(result, undefined, '应返回 undefined');
  });

  test('普通属性访问（obj.foo）不触发补全', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const doc = makeDocument('const x = obj.foo;');
    const position = new vscode.Position(0, 17);
    const result = provider.provideCompletionItems(doc, position);
    assert.strictEqual(result, undefined, '应返回 undefined');
  });

  test('token.col 部分输入后触发补全，replaceRange 覆盖已输入部分 col', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const doc = makeDocument('token.col');
    const position = new vscode.Position(0, 9);
    const result = provider.provideCompletionItems(doc, position);
    assert.ok(result && result.length > 0, '应返回补全数组');
    const item = result![0];
    assert.ok(item.range, '应设置替换范围');
    const range = item.range as vscode.Range;
    // replaceRange 应从 'col' 起始处（第 6 列）到当前位置（第 9 列）
    assert.strictEqual(range.start.character, 6, 'replaceRange 应从 col 开始');
    assert.strictEqual(range.end.character, 9, 'replaceRange 应在光标位置结束');
  });

  test('别名部分输入后触发补全，replaceRange 正确', () => {
    const provider = new JsTokenCompletionProvider(
      mockRegistry,
      mockThemeManager
    );
    const content = 'const { token: antdToken } = useToken();\nantdToken.col';
    const doc = makeDocument(content);
    const position = new vscode.Position(1, 13);
    const result = provider.provideCompletionItems(doc, position);
    assert.ok(result && result.length > 0, '应返回补全数组');
    const item = result![0];
    assert.ok(item.range, '应设置替换范围');
    const range = item.range as vscode.Range;
    assert.strictEqual(range.start.character, 10, 'replaceRange 应从 col 开始');
    assert.strictEqual(
      range.end.character,
      13,
      'replaceRange 应在光标位置结束'
    );
  });
});
