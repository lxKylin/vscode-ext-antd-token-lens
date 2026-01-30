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
      .get('style', 'square');
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
}
