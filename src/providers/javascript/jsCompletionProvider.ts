// src/providers/javascript/jsCompletionProvider.ts
import * as vscode from 'vscode';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';
import { TokenNameConverter } from '@/utils/tokenNameConverter';
import { CompletionItemBuilder } from '@/providers/completionItemBuilder';
import { JsTokenAliasDetector } from '@/utils/jsTokenAliasDetector';

export class JsTokenCompletionProvider
  implements vscode.CompletionItemProvider
{
  constructor(
    private readonly tokenRegistry: TokenRegistry,
    private readonly themeManager: ThemeManager
  ) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] | undefined {
    if (!this.isCompletionEnabled()) {
      return undefined;
    }

    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // 自动检测当前文件中 useToken() 解构出的 token 变量别名
    const identifiers = JsTokenAliasDetector.detect(document.getText());
    const idGroup = JsTokenAliasDetector.buildIdentifierGroup(identifiers);

    const triggerPattern = new RegExp(`\\b${idGroup}\\.\\w*$`);
    if (!triggerPattern.test(textBeforeCursor)) {
      return undefined;
    }

    // 计算替换范围（覆盖用户已输入的部分，如 token.col 中的 col）
    const dotPattern = new RegExp(`\\b${idGroup}\\.(\\w*)$`);
    const dotMatch = textBeforeCursor.match(dotPattern);
    let replaceRange: vscode.Range | undefined;
    if (dotMatch) {
      const typedLength = dotMatch[1].length;
      const replaceStart = new vscode.Position(
        position.line,
        position.character - typedLength
      );
      replaceRange = new vscode.Range(replaceStart, position);
    }

    const theme = this.themeManager.getCurrentTheme();
    const tokens = this.tokenRegistry.getByTheme(theme);

    return tokens.map((tokenInfo, index) => {
      const camelName = TokenNameConverter.cssToJs(tokenInfo.name);
      return CompletionItemBuilder.build({
        tokenInfo: { ...tokenInfo, name: camelName },
        completionType: 'name-only',
        sortIndex: index,
        replaceRange
      });
    });
  }

  private isCompletionEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableCompletion', true);
  }
}
