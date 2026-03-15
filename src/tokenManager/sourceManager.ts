/**
 * Token 数据源管理器
 * 统一管理多个 Token 数据源
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TokenRegistry } from './tokenRegistry';
import {
  ITokenSource,
  SourceConfig,
  SourceType,
  ExtendedTokenInfo,
  LoadResult,
  AntdThemeSourceConfig,
  SourceRuntimeStatus
} from './sourceTypes';
import { BuiltinTokenSource } from './sources/builtinSource';
import { CSSTokenSource } from './sources/cssSource';
import { AntdThemeTokenSource } from './sources/antdThemeSource';
import { Config } from '../utils/config';
import {
  SourceDiagnostic,
  SourceErrorCode,
  SourceHealth,
  toSourceDiagnostic
} from './sourceDiagnostics';

export class SourceManager implements vscode.Disposable {
  private readonly sources: Map<string, ITokenSource> = new Map();
  private readonly sourceStatuses: Map<string, SourceRuntimeStatus> = new Map();
  private disposables: vscode.Disposable[] = [];
  private readonly onDidSourcesChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidSourcesChange = this.onDidSourcesChangeEmitter.event;
  private readonly assetsPath: string;
  private isWatchingConfigChanges = false;

  constructor(
    private readonly tokenRegistry: TokenRegistry,
    assetsPath: string
  ) {
    this.assetsPath = assetsPath;
    this.disposables.push(this.onDidSourcesChangeEmitter);
  }

  /**
   * 初始化数据源
   */
  async initialize(): Promise<void> {
    console.log('[SourceManager] Initializing...');

    // 加载配置
    const configs = this.loadSourceConfigs();

    // 创建数据源实例
    for (const config of configs) {
      await this.addSource(config);
    }

    // 加载所有数据源
    await this.loadAllSources();

    // 监听配置变化
    this.watchConfigChanges();

    console.log(
      `[SourceManager] Initialized with ${this.sources.size} sources`
    );
  }

  /**
   * 添加数据源
   */
  async addSource(config: SourceConfig): Promise<void> {
    const sourceId = this.getSourceId(config);

    // 检查是否已存在
    if (this.sources.has(sourceId)) {
      console.warn(`[SourceManager] Source already exists: ${sourceId}`);
      return;
    }

    // 创建数据源实例
    const source = this.createSource(config);
    if (!source) {
      console.error(`[SourceManager] Failed to create source: ${config.type}`);
      return;
    }
    this.sources.set(sourceId, source);

    // 监听文件变更（如果支持）
    if ('onDidChange' in source) {
      const onChange = (source as any).onDidChange as vscode.Event<void>;
      this.disposables.push(onChange(() => this.handleSourceChange(sourceId)));
    }

    if (source.config.enabled) {
      const validationResult = await source.validateDetailed();
      const health = validationResult.valid
        ? this.getHealthFromWarnings(validationResult.warnings)
        : 'error';
      this.updateSourceStatus(
        sourceId,
        this.createStatus(sourceId, source, health, {
          error: validationResult.error,
          warnings: validationResult.warnings,
          metadata: validationResult.metadata
        })
      );
    } else {
      this.updateSourceStatus(
        sourceId,
        this.createStatus(sourceId, source, 'idle', {
          metadata: {
            ...this.getDefaultMetadata(source),
            lastOutcome: 'idle'
          }
        })
      );
    }

    console.log(
      `[SourceManager] Source added: ${sourceId} (${source.getDescription()})`
    );
  }

  /**
   * 移除数据源
   */
  removeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.dispose();
      this.sources.delete(sourceId);
      this.sourceStatuses.delete(sourceId);
      console.log(`[SourceManager] Source removed: ${sourceId}`);
    }
  }

  /**
   * 加载所有数据源
   */
  async loadAllSources(): Promise<LoadResult[]> {
    const results: LoadResult[] = [];

    for (const [sourceId, source] of this.sources.entries()) {
      if (!source.config.enabled) {
        continue;
      }

      const result = await this.loadSource(sourceId);
      results.push(result);
    }

    // 触发更新事件
    this.onDidSourcesChangeEmitter.fire();

    return results;
  }

  /**
   * 加载单个数据源
   */
  async loadSource(sourceId: string): Promise<LoadResult> {
    const source = this.sources.get(sourceId);
    if (!source) {
      const status: SourceRuntimeStatus = {
        sourceId,
        sourceType: SourceType.BUILTIN,
        enabled: false,
        health: 'error',
        description: 'missing source',
        errorCode: SourceErrorCode.LOAD_FAILED,
        errorMessage: 'Source not found'
      };
      return {
        sourceId,
        success: false,
        tokens: [],
        source: SourceType.BUILTIN,
        error: 'Source not found',
        status
      };
    }

    if (!source.config.enabled) {
      const runtimeMetadata = source.getRuntimeMetadata();
      const idleMetadata = {
        ...this.getDefaultMetadata(source),
        lastOutcome: 'idle'
      };
      if (runtimeMetadata) {
        Object.assign(idleMetadata, runtimeMetadata);
      }
      const status = this.createStatus(sourceId, source, 'idle', {
        metadata: idleMetadata
      });
      this.updateSourceStatus(sourceId, status);
      return {
        sourceId,
        success: false,
        tokens: [],
        source: source.type,
        status
      };
    }

    const validationResult = await source.validateDetailed();
    if (!validationResult.valid) {
      const status = this.createStatus(sourceId, source, 'error', {
        error: validationResult.error,
        warnings: validationResult.warnings,
        metadata: validationResult.metadata,
        lastLoadedAt: Date.now()
      });
      this.updateSourceStatus(sourceId, status);
      return {
        sourceId,
        success: false,
        tokens: [],
        source: source.type,
        error: validationResult.error?.message,
        status
      };
    }

    const startTime = Date.now();

    try {
      const tokens = await source.load();
      const loadTime = Date.now() - startTime;

      // 注册到 TokenRegistry
      this.registerTokens(tokens, source.config.priority);

      console.log(
        `[SourceManager] Loaded ${tokens.length} tokens from ${sourceId} in ${loadTime}ms`
      );

      const status = this.createStatus(
        sourceId,
        source,
        this.getHealthFromWarnings(source.getWarnings()),
        {
          warnings: source.getWarnings(),
          metadata: source.getRuntimeMetadata(),
          tokenCount: tokens.length,
          loadTime,
          lastLoadedAt: Date.now()
        }
      );
      this.updateSourceStatus(sourceId, status);

      return {
        sourceId,
        success: true,
        tokens,
        source: source.type,
        loadTime,
        status
      };
    } catch (error) {
      console.error(`[SourceManager] Load failed: ${sourceId}`, error);
      const diagnostic =
        source.getLastError() ??
        toSourceDiagnostic(error, {
          code: SourceErrorCode.LOAD_FAILED,
          message: '数据源加载失败'
        });
      const status = this.createStatus(sourceId, source, 'error', {
        error: diagnostic,
        warnings: source.getWarnings(),
        metadata: source.getRuntimeMetadata(),
        lastLoadedAt: Date.now()
      });
      this.updateSourceStatus(sourceId, status);
      return {
        sourceId,
        success: false,
        tokens: [],
        source: source.type,
        error: diagnostic.message,
        status
      };
    }
  }

  /**
   * 重新加载所有数据源
   */
  async reload(): Promise<LoadResult[]> {
    console.log('[SourceManager] Reloading all sources...');

    // 清空 TokenRegistry
    this.tokenRegistry.clear();

    // 重新加载
    return await this.loadAllSources();
  }

  getSourceStatuses(): SourceRuntimeStatus[] {
    return Array.from(this.sourceStatuses.values()).sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId)
    );
  }

  /**
   * 获取所有数据源信息
   */
  getSourcesInfo(): Array<{
    id: string;
    type: SourceType;
    description: string;
    enabled: boolean;
    priority: number;
    health?: SourceHealth;
    tokenCount?: number;
    loadTime?: number;
    errorMessage?: string;
  }> {
    return Array.from(this.sources.entries()).map(([id, source]) => ({
      id,
      type: source.type,
      description: source.getDescription(),
      enabled: source.config.enabled,
      priority: source.config.priority,
      health: this.sourceStatuses.get(id)?.health,
      tokenCount: this.sourceStatuses.get(id)?.tokenCount,
      loadTime: this.sourceStatuses.get(id)?.loadTime,
      errorMessage: this.sourceStatuses.get(id)?.errorMessage
    }));
  }

  dispose(): void {
    // 清理所有数据源
    for (const source of this.sources.values()) {
      source.dispose();
    }
    this.sources.clear();
    this.sourceStatuses.clear();

    // 清理订阅
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * 创建数据源实例
   */
  private createSource(config: SourceConfig): ITokenSource | null {
    switch (config.type) {
      case SourceType.BUILTIN:
        return new BuiltinTokenSource(this.assetsPath, config);

      case SourceType.CSS:
      case SourceType.LESS:
      case SourceType.SCSS:
        return new CSSTokenSource(config);

      case SourceType.ANTD_THEME:
        return new AntdThemeTokenSource(config as AntdThemeSourceConfig);

      default:
        console.warn(`[SourceManager] Unsupported source type: ${config.type}`);
        return null;
    }
  }

  /**
   * 生成数据源 ID
   */
  private getSourceId(config: SourceConfig): string {
    if (config.type === SourceType.BUILTIN) {
      return 'builtin';
    }

    if (config.id) {
      return `${config.type}:${config.id}`;
    }

    return `${config.type}:${config.filePath}`;
  }

  /**
   * 注册 Token 到 TokenRegistry
   */
  private registerTokens(tokens: ExtendedTokenInfo[], priority: number): void {
    for (const token of tokens) {
      // 根据优先级决定是否覆盖现有 Token
      const existing = this.tokenRegistry.get(token.name, token.theme);

      if (!existing || priority < ((existing as any).priority || Infinity)) {
        this.tokenRegistry.register(token);
      }
    }
  }

  /**
   * 处理数据源变更
   */
  private async handleSourceChange(sourceId: string): Promise<void> {
    console.log(`[SourceManager] Source changed: ${sourceId}`);

    // 当前 TokenRegistry 不按来源增量清理，文件变更时执行全量重载以避免旧值残留
    await this.reload();
  }

  /**
   * 从配置加载数据源配置
   */
  private loadSourceConfigs(): SourceConfig[] {
    const configs: SourceConfig[] = [];

    // 内置数据源（始终启用）
    configs.push({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100,
      watch: false
    });

    // 从用户配置加载自定义数据源
    const customSources = Config.getCustomTokenSources();
    for (const [index, source] of customSources.entries()) {
      const type = source.type as SourceType;
      const resolvedFilePath = this.resolveConfigFilePath(source.filePath);

      configs.push({
        type,
        enabled: source.enabled !== false,
        priority: source.priority ?? 10 + index,
        id:
          source.id ??
          (type === SourceType.ANTD_THEME && !resolvedFilePath
            ? `antdTheme-${index}`
            : undefined),
        filePath: resolvedFilePath,
        watch: source.watch !== false,
        themeName: source.themeName,
        baseTheme: source.baseTheme,
        exportName: source.exportName,
        designToken: source.designToken,
        themeConfig: source.themeConfig,
        resolveFromWorkspace: source.resolveFromWorkspace !== false
      });
    }

    return configs;
  }

  private resolveConfigFilePath(filePath?: string): string | undefined {
    if (!filePath) {
      return undefined;
    }

    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }

    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of workspaceFolders) {
      const resolvedPath = path.resolve(folder.uri.fsPath, filePath);
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }

    const fallbackRoot = workspaceFolders[0]?.uri.fsPath;
    return fallbackRoot
      ? path.resolve(fallbackRoot, filePath)
      : path.resolve(filePath);
  }

  /**
   * 监听配置变化
   */
  private watchConfigChanges(): void {
    if (this.isWatchingConfigChanges) {
      return;
    }

    this.isWatchingConfigChanges = true;
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('antdToken.sources')) {
          console.log('[SourceManager] Configuration changed, reloading...');

          // 重新初始化前先清理现有数据源和旧 Token，避免同优先级配置更新时旧值残留
          for (const source of this.sources.values()) {
            source.dispose();
          }
          this.sources.clear();
          this.sourceStatuses.clear();
          this.tokenRegistry.clear();

          // 重新加载
          await this.initialize();
        }
      })
    );
  }

  private updateSourceStatus(
    sourceId: string,
    status: SourceRuntimeStatus
  ): void {
    this.sourceStatuses.set(sourceId, status);
  }

  private createStatus(
    sourceId: string,
    source: ITokenSource,
    health: SourceHealth,
    options: {
      error?: SourceDiagnostic;
      warnings?: SourceDiagnostic[];
      metadata?: Record<string, unknown>;
      tokenCount?: number;
      loadTime?: number;
      lastLoadedAt?: number;
    } = {}
  ): SourceRuntimeStatus {
    return {
      sourceId,
      sourceType: source.type,
      enabled: source.config.enabled,
      health,
      description: source.getDescription(),
      lastLoadedAt: options.lastLoadedAt,
      tokenCount: options.tokenCount,
      loadTime: options.loadTime,
      errorCode: options.error?.code,
      errorMessage: options.error?.message,
      warnings: options.warnings,
      metadata: options.metadata
        ? {
            ...this.getDefaultMetadata(source),
            ...options.metadata
          }
        : this.getDefaultMetadata(source)
    };
  }

  private getDefaultMetadata(source: ITokenSource): Record<string, unknown> {
    return {
      priority: source.config.priority,
      filePath: source.config.filePath,
      themeName: source.config.themeName,
      baseTheme: source.config.baseTheme,
      exportName: source.config.exportName
    };
  }

  private getHealthFromWarnings(
    warnings: SourceDiagnostic[] | undefined
  ): SourceHealth {
    return warnings && warnings.length > 0 ? 'warning' : 'ok';
  }
}
