import * as vscode from 'vscode';

/**
 * 配置管理工具
 */
export class Config {
  /**
   * 获取颜色装饰器是否启用
   */
  static getDecoratorEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken.colorDecorator')
      .get('enabled', true);
  }

  /**
   * 获取装饰样式
   */
  static getDecoratorStyle(): 'square' | 'circle' | 'underline' | 'background' {
    return vscode.workspace
      .getConfiguration('antdToken.colorDecorator')
      .get('style', 'background');
  }

  /**
   * 获取装饰位置
   */
  static getDecoratorPosition(): 'before' | 'after' {
    return vscode.workspace
      .getConfiguration('antdToken.colorDecorator')
      .get('position', 'before');
  }

  /**
   * 获取装饰大小
   */
  static getDecoratorSize(): 'small' | 'medium' | 'large' {
    return vscode.workspace
      .getConfiguration('antdToken.colorDecorator')
      .get('size', 'medium');
  }

  /**
   * 监听配置变化
   * @param callback 回调函数
   * @returns Disposable
   */
  static onConfigChange(
    callback: (e: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(callback);
  }

  /**
   * 获取是否显示多主题对比
   */
  static getShowMultiTheme(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('showMultiTheme', true);
  }

  /**
   * 获取是否显示颜色格式转换
   */
  static getShowColorFormats(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('showColorFormats', true);
  }

  /**
   * 获取 Hover 详细程度
   */
  static getHoverVerbosity(): 'minimal' | 'normal' | 'detailed' {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('hoverVerbosity', 'normal') as 'minimal' | 'normal' | 'detailed';
  }

  /**
   * 获取是否启用补全
   */
  static getEnableCompletion(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableCompletion', true);
  }

  /**
   * 获取补全项详细程度
   */
  static getCompletionDetailLevel(): 'minimal' | 'normal' | 'detailed' {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('completionDetailLevel', 'normal') as
      | 'minimal'
      | 'normal'
      | 'detailed';
  }

  /**
   * 获取是否最近使用的 Token 优先显示
   */
  static getShowRecentTokensFirst(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('showRecentTokensFirst', true);
  }

  /**
   * 获取最近使用 Token 最大数量
   */
  static getMaxRecentTokens(): number {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('maxRecentTokens', 10);
  }

  /**
   * 获取是否启用拼音搜索
   */
  static getEnablePinyinSearch(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enablePinyinSearch', true);
  }

  /**
   * 获取是否启用分类分组
   */
  static getEnableCategoryGroups(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableCategoryGroups', false);
  }

  /**
   * 获取是否显示补全图标
   */
  static getShowCompletionIcons(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('showCompletionIcons', true);
  }

  /**
   * 获取自定义 Token 数据源配置
   */
  static getCustomTokenSources(): any[] {
    const config = vscode.workspace.getConfiguration('antdToken');
    return config.get<any[]>('sources', []);
  }

  /**
   * 是否启用自动扫描项目 Token 文件
   */
  static getEnableAutoScan(): boolean {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('enableAutoScan', true);
  }

  /**
   * 获取自动扫描的文件匹配模式
   */
  static getAutoScanPatterns(): string[] {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get('autoScanPatterns', [
        '**/theme.config.{js,ts}',
        '**/tokens.{css,less,scss}',
        '**/*.theme.{css,less,scss}'
      ]);
  }

  /**
   * 通用的 get 方法
   */
  private static get<T>(key: string, defaultValue: T): T {
    return vscode.workspace
      .getConfiguration('antdToken')
      .get(key, defaultValue);
  }
}
