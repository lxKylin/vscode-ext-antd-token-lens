/**
 * Token 数据源基础类
 */

import * as vscode from 'vscode';
import {
  ITokenSource,
  SourceConfig,
  SourceType,
  ExtendedTokenInfo
} from '../sourceTypes';
import {
  SourceDiagnostic,
  SourceErrorCode,
  SourceValidationResult,
  toSourceDiagnostic
} from '../sourceDiagnostics';

export abstract class BaseTokenSource implements ITokenSource {
  protected disposables: vscode.Disposable[] = [];
  protected lastError?: SourceDiagnostic;
  protected warnings: SourceDiagnostic[] = [];
  protected runtimeMetadata?: Record<string, unknown>;

  constructor(
    public readonly type: SourceType,
    public readonly config: SourceConfig
  ) {}

  /**
   * 加载 Token 数据（子类实现）
   */
  abstract load(): Promise<ExtendedTokenInfo[]>;

  /**
   * 验证数据源（子类可覆盖）
   */
  async validate(): Promise<boolean> {
    return this.config.enabled;
  }

  async validateDetailed(): Promise<SourceValidationResult> {
    try {
      const valid = await this.validate();
      const error = valid
        ? undefined
        : {
            severity: 'error' as const,
            code: SourceErrorCode.VALIDATION_FAILED,
            message: '数据源校验失败'
          };
      this.setDiagnostics(error, [], this.runtimeMetadata);
      return {
        valid,
        error,
        warnings: this.warnings,
        metadata: this.runtimeMetadata
      };
    } catch (error) {
      const diagnostic = toSourceDiagnostic(error, {
        code: SourceErrorCode.VALIDATION_FAILED,
        message: '数据源校验失败'
      });
      this.setDiagnostics(diagnostic, [], this.runtimeMetadata);
      return {
        valid: false,
        error: diagnostic,
        warnings: this.warnings,
        metadata: this.runtimeMetadata
      };
    }
  }

  /**
   * 获取描述信息（子类可覆盖）
   */
  getDescription(): string {
    return `${this.type} source`;
  }

  getLastError(): SourceDiagnostic | undefined {
    return this.lastError;
  }

  getWarnings(): SourceDiagnostic[] {
    return [...this.warnings];
  }

  getRuntimeMetadata(): Record<string, unknown> | undefined {
    return this.runtimeMetadata ? { ...this.runtimeMetadata } : undefined;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * 标准化 Token 名称
   */
  protected normalizeTokenName(name: string): string {
    // 确保以 -- 开头
    if (!name.startsWith('--')) {
      name = '--' + name;
    }
    return name.toLowerCase().trim();
  }

  /**
   * 检测 Token 分类
   */
  protected detectCategory(name: string, value: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('color') || this.isColorValue(value)) {
      return 'color';
    }
    if (lowerName.includes('bg') || lowerName.includes('background')) {
      return 'background';
    }
    if (lowerName.includes('text')) {
      return 'text';
    }
    if (lowerName.includes('border')) {
      return 'border';
    }
    if (lowerName.includes('shadow')) {
      return 'shadow';
    }
    if (lowerName.includes('font')) {
      return 'typography';
    }
    if (
      lowerName.includes('size') ||
      lowerName.includes('width') ||
      lowerName.includes('height')
    ) {
      return 'size';
    }
    if (
      lowerName.includes('spacing') ||
      lowerName.includes('margin') ||
      lowerName.includes('padding')
    ) {
      return 'spacing';
    }

    return 'other';
  }

  /**
   * 判断是否为颜色值
   */
  protected isColorValue(value: string): boolean {
    if (!value) {
      return false;
    }

    value = value.trim();

    // hex 颜色
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
      return true;
    }

    // rgb/rgba
    if (/^rgba?\(/i.test(value)) {
      return true;
    }

    // hsl/hsla
    if (/^hsla?\(/i.test(value)) {
      return true;
    }

    // CSS 颜色关键字
    const colorKeywords = [
      'transparent',
      'currentcolor',
      'inherit',
      'initial',
      'unset',
      'black',
      'white',
      'red',
      'green',
      'blue',
      'yellow',
      'cyan',
      'magenta',
      'gray',
      'grey',
      'orange',
      'purple',
      'pink',
      'brown'
    ];
    if (colorKeywords.includes(value.toLowerCase())) {
      return true;
    }

    return false;
  }

  protected setDiagnostics(
    error?: SourceDiagnostic,
    warnings: SourceDiagnostic[] = [],
    metadata?: Record<string, unknown>
  ): void {
    this.lastError = error;
    this.warnings = [...warnings];
    this.runtimeMetadata = metadata ? { ...metadata } : undefined;
  }

  protected clearDiagnostics(metadata?: Record<string, unknown>): void {
    this.setDiagnostics(undefined, [], metadata);
  }
}
