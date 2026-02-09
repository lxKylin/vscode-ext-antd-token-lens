/**
 * Token 数据源类型定义
 */

import { TokenInfo as BaseTokenInfo, TokenCategory } from '@/data/antdTokens';

/**
 * Token 数据源类型
 */
export enum SourceType {
  BUILTIN = 'builtin', // 内置 Ant Design Token
  CSS = 'css', // CSS 文件
  LESS = 'less', // Less 文件
  SCSS = 'scss' // Scss 文件
}

/**
 * Token 信息扩展（增加数据源相关字段）
 * 注意：为了兼容现有 TokenInfo，source 字段保持为 'builtin' | 'custom'
 */
export interface ExtendedTokenInfo extends BaseTokenInfo {
  sourceType?: SourceType; // 详细的数据源类型
  sourceFile?: string; // 来源文件路径
  priority?: number; // 优先级（用于多数据源冲突解决）
}

/**
 * 数据源配置
 */
export interface SourceConfig {
  type: SourceType;
  enabled: boolean;
  priority: number; // 优先级：数字越小越优先
  filePath?: string; // 文件路径（针对文件类型数据源）
  watch?: boolean; // 是否监听文件变更
}

/**
 * 数据源接口
 */
export interface ITokenSource {
  readonly type: SourceType;
  readonly config: SourceConfig;

  /**
   * 加载 Token 数据
   */
  load(): Promise<ExtendedTokenInfo[]>;

  /**
   * 验证数据源是否可用
   */
  validate(): Promise<boolean>;

  /**
   * 获取数据源描述信息
   */
  getDescription(): string;

  /**
   * 清理资源（如文件监听器）
   */
  dispose(): void;
}

/**
 * 数据源加载结果
 */
export interface LoadResult {
  success: boolean;
  tokens: ExtendedTokenInfo[];
  source: SourceType;
  error?: string;
  loadTime?: number;
}
