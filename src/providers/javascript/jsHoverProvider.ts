// src/providers/javascript/jsHoverProvider.ts
import * as vscode from 'vscode';
import { HoverContentBuilder } from '@/providers/hoverContentBuilder';
import { TokenNameConverter } from '@/utils/tokenNameConverter';

export class JsTokenHoverProvider implements vscode.HoverProvider {
  private static readonly HOVER_PATTERN =
    /\b(token|theme)\.([a-zA-Z][a-zA-Z0-9]*)/;

  constructor(private readonly hoverContentBuilder: HoverContentBuilder) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    if (!this.isHoverEnabled()) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(
      position,
      JsTokenHoverProvider.HOVER_PATTERN
    );
    if (!range) {
      return undefined;
    }

    const text = document.getText(range);
    const match = text.match(JsTokenHoverProvider.HOVER_PATTERN);
    if (!match) {
      return undefined;
    }

    // match[1] = 'token' | 'theme'，match[2] = camelCase 名（如 colorPrimary）
    const camelName = match[2];
    const cssName = TokenNameConverter.jsToCss(camelName);
    // 查找时用 CSS 名，展示时保留原始 camelCase 名
    const content = this.hoverContentBuilder.build(cssName, camelName);
    if (!content) {
      return undefined;
    }

    return new vscode.Hover(content, range);
  }

  private isHoverEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableHover', true);
  }
}
