import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsTokenHoverProvider } from '@/providers/javascript/jsHoverProvider';
import { HoverContentBuilder } from '@/providers/hoverContentBuilder';

// 构造最小 Mock HoverContentBuilder
function makeBuilder(returnContent: boolean): HoverContentBuilder {
  return {
    build: (cssName: string) => {
      if (!returnContent) {
        return undefined;
      }
      const md = new vscode.MarkdownString(`# ${cssName}`);
      return md;
    }
  } as unknown as HoverContentBuilder;
}

// 创建模拟 TextDocument
function makeDocument(content: string): vscode.TextDocument {
  return {
    getText: (range?: vscode.Range) => {
      if (!range) {
        return content;
      }
      const lines = content.split('\n');
      const startLine = lines[range.start.line] ?? '';
      return startLine.substring(range.start.character, range.end.character);
    },
    lineAt: (lineOrPos: number | vscode.Position) => {
      const lineNum =
        typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line;
      const lines = content.split('\n');
      const text = lines[lineNum] ?? '';
      return { text, lineNumber: lineNum } as vscode.TextLine;
    },
    getWordRangeAtPosition: (
      position: vscode.Position,
      pattern?: RegExp
    ): vscode.Range | undefined => {
      const lines = content.split('\n');
      const lineText = lines[position.line] ?? '';
      if (!pattern) {
        return undefined;
      }
      const regex = new RegExp(pattern.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new vscode.Range(
            new vscode.Position(position.line, start),
            new vscode.Position(position.line, end)
          );
        }
      }
      return undefined;
    }
  } as unknown as vscode.TextDocument;
}

const mockCancellationToken: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: (() => ({ dispose: () => {} })) as any
};

suite('JsTokenHoverProvider Test Suite', () => {
  test('token.colorPrimary 悬停应返回 Hover 对象', () => {
    const provider = new JsTokenHoverProvider(makeBuilder(true));
    const doc = makeDocument('const x = token.colorPrimary;');
    // position within "colorPrimary"
    const position = new vscode.Position(0, 20);
    const result = provider.provideHover(doc, position, mockCancellationToken);
    assert.ok(result instanceof vscode.Hover, '应返回 Hover 对象');
  });

  test('theme.colorPrimary 悬停应返回 Hover 对象', () => {
    const provider = new JsTokenHoverProvider(makeBuilder(true));
    const doc = makeDocument('const x = theme.colorPrimary;');
    const position = new vscode.Position(0, 20);
    const result = provider.provideHover(doc, position, mockCancellationToken);
    assert.ok(result instanceof vscode.Hover, '应返回 Hover 对象');
  });

  test('普通单词悬停（无 token. 前缀）应返回 undefined', () => {
    const provider = new JsTokenHoverProvider(makeBuilder(true));
    const doc = makeDocument('const colorPrimary = 1;');
    const position = new vscode.Position(0, 10);
    const result = provider.provideHover(doc, position, mockCancellationToken);
    assert.strictEqual(result, undefined, '应返回 undefined');
  });

  test('builder 返回 undefined 时 provideHover 返回 undefined', () => {
    const provider = new JsTokenHoverProvider(makeBuilder(false));
    const doc = makeDocument('const x = token.colorPrimary;');
    const position = new vscode.Position(0, 20);
    const result = provider.provideHover(doc, position, mockCancellationToken);
    assert.strictEqual(result, undefined, '应返回 undefined');
  });

  test('Hover 对象 range 应覆盖完整 token.colorPrimary', () => {
    const provider = new JsTokenHoverProvider(makeBuilder(true));
    const content = 'const x = token.colorPrimary;';
    const doc = makeDocument(content);
    const position = new vscode.Position(0, 20);
    const result = provider.provideHover(doc, position, mockCancellationToken);
    assert.ok(result instanceof vscode.Hover, '应返回 Hover 对象');
    assert.ok(result.range, '应包含 range');
    // "token.colorPrimary" 从第 10 列开始，长度为 18
    assert.strictEqual(
      result.range!.start.character,
      10,
      'range 应从 token. 开始'
    );
    assert.strictEqual(
      result.range!.end.character,
      28,
      'range 应包含 colorPrimary'
    );
  });
});
