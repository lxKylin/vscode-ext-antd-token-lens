import * as vscode from 'vscode';
import { TokenMatch } from '../tokenManager/tokenScanner';
import { TokenRegistry } from '../tokenManager/tokenRegistry';
import { ThemeManager } from '../tokenManager/themeManager';
import { Config } from '../utils/config';

/**
 * 颜色装饰器
 * 负责在编辑器中为 Token 添加颜色可视化装饰
 */
export class ColorDecorator {
  /** 装饰类型缓存 Map<颜色值, DecorationType> */
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

  /** 资源清理器 */
  private disposables: vscode.Disposable[] = [];

  constructor(
    private tokenRegistry: TokenRegistry,
    private themeManager: ThemeManager
  ) {
    this.initialize();
  }

  /**
   * 为编辑器添加装饰
   * @param editor 编辑器实例
   * @param matches Token 匹配结果
   */
  decorate(editor: vscode.TextEditor, matches: TokenMatch[]): void {
    // 先清除旧装饰
    this.clear(editor);

    // 按颜色分组 Token
    const colorGroups = new Map<string, vscode.Range[]>();

    for (const match of matches) {
      const tokenInfo = this.tokenRegistry.get(
        match.tokenName,
        this.themeManager.getCurrentTheme()
      );

      if (tokenInfo && tokenInfo.isColor) {
        const color = tokenInfo.value;

        if (!colorGroups.has(color)) {
          colorGroups.set(color, []);
        }
        colorGroups.get(color)!.push(match.range);
      }
    }

    // 为每种颜色创建装饰类型并应用
    for (const [color, ranges] of colorGroups) {
      const decorationType = this.getOrCreateDecorationType(color);
      editor.setDecorations(decorationType, ranges);
    }
  }

  /**
   * 清除编辑器的所有装饰
   * @param editor 编辑器实例
   */
  clear(editor: vscode.TextEditor): void {
    for (const decorationType of this.decorationTypes.values()) {
      editor.setDecorations(decorationType, []);
    }
  }

  /**
   * 刷新所有可见编辑器的装饰
   */
  refresh(): void {
    // 销毁所有旧装饰类型
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // 触发重新装饰（由 DocumentDecorationManager 处理）
    // 这里不直接处理，而是通过事件通知
  }

  /**
   * 销毁装饰器
   */
  dispose(): void {
    // 销毁所有装饰类型
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // 销毁事件监听
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * 获取或创建装饰类型（带缓存）
   * @param color 颜色值
   * @returns 装饰类型
   */
  private getOrCreateDecorationType(
    color: string
  ): vscode.TextEditorDecorationType {
    if (!this.decorationTypes.has(color)) {
      const decorationType = this.createDecorationType(color);
      this.decorationTypes.set(color, decorationType);
    }
    return this.decorationTypes.get(color)!;
  }

  /**
   * 创建装饰样式
   * @param color 颜色值
   * @returns 装饰类型
   */
  private createDecorationType(color: string): vscode.TextEditorDecorationType {
    const style = Config.getDecoratorStyle();
    const position = Config.getDecoratorPosition();
    const size = Config.getDecoratorSize();

    const sizeMap = {
      small: '0.6em',
      medium: '0.8em',
      large: '1.0em'
    };

    switch (style) {
      case 'square':
        return this.createSquareDecoration(color, position, sizeMap[size]);
      case 'circle':
        return this.createCircleDecoration(color, position, sizeMap[size]);
      case 'underline':
        return this.createUnderlineDecoration(color);
      case 'background':
        return this.createBackgroundDecoration(color);
    }
  }

  /**
   * 创建方形装饰
   */
  private createSquareDecoration(
    color: string,
    position: string,
    size: string
  ): vscode.TextEditorDecorationType {
    const decoration: any = {
      contentText: '■',
      color: color,
      margin: position === 'before' ? '0 4px 0 0' : '0 0 0 4px',
      width: size,
      height: size
    };

    return vscode.window.createTextEditorDecorationType({
      [position]: decoration,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  }

  /**
   * 创建圆形装饰
   */
  private createCircleDecoration(
    color: string,
    position: string,
    size: string
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      [position]: {
        contentText: '●',
        color: color,
        margin: position === 'before' ? '0 4px 0 0' : '0 0 0 4px',
        width: size,
        height: size
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  }

  /**
   * 创建下划线装饰
   */
  private createUnderlineDecoration(
    color: string
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      textDecoration: `none; border-bottom: 2px solid ${color}`,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  }

  /**
   * 创建背景装饰
   */
  private createBackgroundDecoration(
    color: string
  ): vscode.TextEditorDecorationType {
    // 计算浅色背景（降低不透明度）
    const backgroundColor = this.addAlpha(color, 0.2);
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: backgroundColor,
      borderRadius: '2px',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  }

  /**
   * 为颜色添加透明度
   * @param color 颜色值
   * @param alpha 透明度 (0-1)
   * @returns rgba 颜色字符串
   */
  private addAlpha(color: string, alpha: number): string {
    // 处理 hex 颜色
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 处理 rgb/rgba 颜色
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
      }
    }

    // 默认返回原颜色
    return color;
  }

  /**
   * 初始化：监听主题变化和配置变化
   */
  private initialize(): void {
    // 主题切换时刷新所有装饰
    this.disposables.push(
      this.themeManager.onThemeChange(() => {
        this.refresh();
      })
    );

    // 配置变更时刷新装饰
    this.disposables.push(
      Config.onConfigChange((event) => {
        if (event.affectsConfiguration('antdToken.colorDecorator')) {
          this.refresh();
        }
      })
    );
  }
}
