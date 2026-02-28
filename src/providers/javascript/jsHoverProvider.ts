// src/providers/javascript/jsHoverProvider.ts
import * as vscode from 'vscode';
import { HoverContentBuilder } from '@/providers/hoverContentBuilder';
import { TokenNameConverter } from '@/utils/tokenNameConverter';
import { JsTokenAliasDetector } from '@/utils/jsTokenAliasDetector';

export class JsTokenHoverProvider implements vscode.HoverProvider {
  constructor(private readonly hoverContentBuilder: HoverContentBuilder) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    if (!this.isHoverEnabled()) {
      return undefined;
    }

    // 自动检测当前文件中 useToken() 解构出的 token 变量别名
    const identifiers = JsTokenAliasDetector.detect(document.getText());
    const idGroup = JsTokenAliasDetector.buildIdentifierGroup(identifiers);
    const hoverPattern = new RegExp(`\\b${idGroup}\\.([a-zA-Z][a-zA-Z0-9]*)`);

    const range = document.getWordRangeAtPosition(position, hoverPattern);
    if (!range) {
      return undefined;
    }

    const text = document.getText(range);
    const match = text.match(hoverPattern);
    if (!match) {
      return undefined;
    }

    // match[1] = camelCase 名（如 colorPrimary）
    const camelName = match[1];
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
