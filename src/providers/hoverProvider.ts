import * as vscode from 'vscode';
import { TokenRegistry } from '../tokenManager/tokenRegistry';
import { ThemeManager } from '../tokenManager/themeManager';
import { TokenScanner } from '../tokenManager/tokenScanner';
import { HoverContentBuilder } from './hoverContentBuilder';
import { PerformanceMonitor } from '../utils/performance';

/**
 * Ant Design Token Hover 提供者
 * 当鼠标悬停在 Token 上时，显示详细的 Token 信息
 */
export class AntdTokenHoverProvider implements vscode.HoverProvider {
  private contentBuilder: HoverContentBuilder;
  private lastHoverTime = 0;
  private readonly HOVER_DEBOUNCE = 50; // 50ms

  constructor(
    private tokenRegistry: TokenRegistry,
    private themeManager: ThemeManager,
    private tokenScanner: TokenScanner
  ) {
    this.contentBuilder = new HoverContentBuilder(tokenRegistry, themeManager);
  }

  /**
   * 提供 Hover 信息
   * @param document 当前文档
   * @param position 鼠标位置
   * @param token 取消令牌
   * @returns Hover 对象或 undefined
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    return PerformanceMonitor.measure('provideHover', () => {
      // 简单的防抖检查
      const now = Date.now();
      if (now - this.lastHoverTime < this.HOVER_DEBOUNCE) {
        return undefined;
      }
      this.lastHoverTime = now;

      // 检查是否支持该文档
      if (!this.tokenScanner.isSupportedDocument(document)) {
        return undefined;
      }

      // 检查是否启用 Hover 功能
      if (!this.isHoverEnabled()) {
        return undefined;
      }

      // 获取当前行
      const line = document.lineAt(position.line);

      // 扫描当前行的 Token
      const matches = this.tokenScanner.scanLine(line.text, position.line);

      // 查找鼠标位置对应的 Token
      const match = matches.find((m) => m.range.contains(position));

      if (!match) {
        return undefined;
      }

      // 构建 Hover 内容
      const hoverContent = this.buildHoverContent(match.tokenName);

      if (!hoverContent) {
        return undefined;
      }

      return new vscode.Hover(hoverContent, match.range);
    });
  }

  /**
   * 构建 Hover 内容
   * @param tokenName Token 名称
   * @returns Markdown 字符串
   */
  private buildHoverContent(
    tokenName: string
  ): vscode.MarkdownString | undefined {
    return this.contentBuilder.build(tokenName);
  }

  /**
   * 检查是否启用 Hover 功能
   */
  private isHoverEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableHover', true);
  }
}
