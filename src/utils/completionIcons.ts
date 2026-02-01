import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ColorConverter } from './colorConverter';

/**
 * 补全项图标管理器
 * 为颜色 Token 生成色块图标
 */
export class CompletionIcons {
  private static iconCache = new Map<string, vscode.Uri>();
  private static iconDir: string;

  /**
   * 初始化图标目录
   */
  static initialize(context: vscode.ExtensionContext): void {
    this.iconDir = path.join(
      context.globalStorageUri.fsPath,
      'completion-icons'
    );

    // 确保目录存在
    if (!fs.existsSync(this.iconDir)) {
      fs.mkdirSync(this.iconDir, { recursive: true });
    }
  }

  /**
   * 为颜色创建图标
   */
  static getColorIcon(color: string): vscode.Uri | undefined {
    if (!ColorConverter.isValidColor(color)) {
      return undefined;
    }

    // 检查缓存
    if (this.iconCache.has(color)) {
      return this.iconCache.get(color);
    }

    // 创建图标
    const iconPath = this.createColorIcon(color);
    if (iconPath) {
      this.iconCache.set(color, iconPath);
    }

    return iconPath;
  }

  /**
   * 创建颜色图标 SVG
   */
  private static createColorIcon(color: string): vscode.Uri | undefined {
    try {
      // 创建一个简单的 SVG 色块
      const svg = `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <rect width="14" height="14" x="1" y="1" fill="${color}" stroke="#888" stroke-width="1" rx="2"/>
</svg>`;

      // 使用颜色值的 hash 作为文件名
      const fileName = `color-${this.hashColor(color)}.svg`;
      const filePath = path.join(this.iconDir, fileName);

      // 只在文件不存在时才写入
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, svg.trim(), 'utf-8');
      }

      return vscode.Uri.file(filePath);
    } catch (error) {
      console.error('Failed to create color icon:', error);
      return undefined;
    }
  }

  /**
   * 简单的颜色值哈希函数
   */
  private static hashColor(color: string): string {
    return color.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  /**
   * 清理图标缓存和文件
   */
  static clearCache(): void {
    this.iconCache.clear();

    // 删除所有图标文件
    if (fs.existsSync(this.iconDir)) {
      try {
        const files = fs.readdirSync(this.iconDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.iconDir, file));
        }
      } catch (error) {
        console.error('Failed to clear icon cache:', error);
      }
    }
  }

  /**
   * 获取默认的分类图标
   */
  static getCategoryIcon(category: string): string | undefined {
    const icons: Record<string, string> = {
      color: '🎨',
      bg: '🖼️',
      text: '📝',
      border: '🔲',
      shadow: '🌓',
      size: '📏',
      font: '🔤'
    };

    return icons[category];
  }
}
