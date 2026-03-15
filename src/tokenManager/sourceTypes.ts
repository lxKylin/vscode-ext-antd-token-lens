/**
 * Token 数据源类型定义
 */

import { TokenInfo as BaseTokenInfo } from '@/data/antdTokens';
import {
  SourceDiagnostic,
  SourceHealth,
  SourceValidationResult
} from './sourceDiagnostics';

/**
 * Token 数据源类型
 */
export enum SourceType {
  BUILTIN = 'builtin', // 内置 Ant Design Token
  CSS = 'css', // CSS 文件
  LESS = 'less', // Less 文件
  SCSS = 'scss', // Scss 文件
  ANTD_THEME = 'antdTheme' // 基于 getDesignToken 的主题配置
}

export type SourceBaseTheme = 'light' | 'dark';

export interface ThemeDescriptor {
  id: string;
  name: string;
  baseTheme: SourceBaseTheme;
  sourceId?: string;
  sourceType?: SourceType;
  isBuiltin?: boolean;
  isActive?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Token 信息扩展（增加数据源相关字段）
 * 注意：为了兼容现有 TokenInfo，source 字段保持为 'builtin' | 'custom'
 */
export interface ExtendedTokenInfo extends BaseTokenInfo {
  sourceType?: SourceType; // 详细的数据源类型
  sourceId?: string; // 来源数据源 ID
  sourceFile?: string; // 来源文件路径
  priority?: number; // 优先级（用于多数据源冲突解决）
  themeId?: string; // 命名主题 ID
  themeName?: string; // 命名主题显示名
  baseTheme?: SourceBaseTheme; // 命名主题所属基础主题
}

/**
 * 数据源配置
 */
export interface SourceConfig {
  type: SourceType;
  enabled: boolean;
  priority: number; // 优先级：数字越小越优先
  id?: string; // 显式数据源 ID
  filePath?: string; // 文件路径（针对文件类型数据源）
  watch?: boolean; // 是否监听文件变更
  themeName?: string;
  baseTheme?: SourceBaseTheme;
  exportName?: string;
  designToken?: Record<string, unknown>;
  themeConfig?: Record<string, unknown>;
  resolveFromWorkspace?: boolean;
}

/**
 * Ant Design Theme 数据源配置
 */
export interface AntdThemeSourceConfig extends SourceConfig {
  type: SourceType.ANTD_THEME;
  themeName?: string;
  baseTheme?: SourceBaseTheme;
  exportName?: string;
  designToken?: Record<string, unknown>;
  themeConfig?: Record<string, unknown>;
  resolveFromWorkspace?: boolean;
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
   * 带结构化诊断信息的验证结果
   */
  validateDetailed(): Promise<SourceValidationResult>;

  /**
   * 获取数据源描述信息
   */
  getDescription(): string;

  /**
   * 获取最近一次结构化错误
   */
  getLastError(): SourceDiagnostic | undefined;

  /**
   * 获取最近一次警告信息
   */
  getWarnings(): SourceDiagnostic[];

  /**
   * 获取最近一次运行时元数据
   */
  getRuntimeMetadata(): Record<string, unknown> | undefined;

  /**
   * 清理资源（如文件监听器）
   */
  dispose(): void;
}

export interface SourceRuntimeStatus {
  sourceId: string;
  sourceType: SourceType;
  enabled: boolean;
  health: SourceHealth;
  description: string;
  lastLoadedAt?: number;
  tokenCount?: number;
  loadTime?: number;
  errorCode?: string;
  errorMessage?: string;
  warnings?: SourceDiagnostic[];
  metadata?: Record<string, unknown>;
}

/**
 * 数据源加载结果
 */
export interface LoadResult {
  sourceId?: string;
  success: boolean;
  tokens: ExtendedTokenInfo[];
  source: SourceType;
  error?: string;
  loadTime?: number;
  status?: SourceRuntimeStatus;
}
