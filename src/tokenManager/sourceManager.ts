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
  SourceRuntimeStatus,
  ThemeDescriptor,
  SourceBaseTheme
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
import { ThemeManager } from './themeManager';

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
    assetsPath: string,
    private readonly themeManager?: ThemeManager
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
      this.refreshAvailableThemes();
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

    this.refreshAvailableThemes();

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

      const normalizedTokens = tokens.map((token) =>
        this.enrichToken(sourceId, source, token)
      );
      const themeDescriptors =
        this.collectThemeDescriptorsFromTokens(normalizedTokens);

      // 注册到 TokenRegistry
      this.registerTokens(normalizedTokens);

      console.log(
        `[SourceManager] Loaded ${normalizedTokens.length} tokens from ${sourceId} in ${loadTime}ms`
      );

      const status = this.createStatus(
        sourceId,
        source,
        this.getHealthFromWarnings(source.getWarnings()),
        {
          warnings: source.getWarnings(),
          metadata: this.attachThemeMetadata(
            source.getRuntimeMetadata(),
            themeDescriptors
          ),
          tokenCount: normalizedTokens.length,
          loadTime,
          lastLoadedAt: Date.now()
        }
      );
      this.updateSourceStatus(sourceId, status);

      return {
        sourceId,
        success: true,
        tokens: normalizedTokens,
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

  getThemeDescriptors(): ThemeDescriptor[] {
    const themes = new Map<string, ThemeDescriptor>();

    for (const status of this.getSourceStatuses()) {
      if (status.health === 'error') {
        continue;
      }

      const metadataThemes = this.getThemesFromMetadata(status.metadata);
      for (const theme of metadataThemes) {
        const metadata = theme.metadata
          ? {
              ...theme.metadata,
              sourceHealth: status.health
            }
          : { sourceHealth: status.health };
        themes.set(theme.id, {
          ...theme,
          metadata
        });
      }
    }

    return Array.from(themes.values()).sort((left, right) => {
      if (left.baseTheme !== right.baseTheme) {
        return left.baseTheme.localeCompare(right.baseTheme);
      }
      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.name.localeCompare(right.name);
    });
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
  private registerTokens(tokens: ExtendedTokenInfo[]): void {
    for (const token of tokens) {
      this.tokenRegistry.register(token);
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
    this.refreshAvailableThemes();
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
    return this.attachThemeMetadata(
      {
        priority: source.config.priority,
        filePath: source.config.filePath,
        themeName: source.config.themeName,
        baseTheme: source.config.baseTheme,
        exportName: source.config.exportName
      },
      this.getConfiguredThemeDescriptors(
        this.getSourceId(source.config),
        source
      )
    );
  }

  private getHealthFromWarnings(
    warnings: SourceDiagnostic[] | undefined
  ): SourceHealth {
    return warnings && warnings.length > 0 ? 'warning' : 'ok';
  }

  private enrichToken(
    sourceId: string,
    source: ITokenSource,
    token: ExtendedTokenInfo
  ): ExtendedTokenInfo {
    const baseTheme =
      token.baseTheme ?? token.theme ?? source.config.baseTheme ?? 'light';
    const themeName =
      token.themeName ??
      source.config.themeName?.trim() ??
      source.config.id ??
      (source.type === SourceType.BUILTIN ? baseTheme : sourceId);
    const themeId =
      token.themeId ??
      this.resolveThemeId(sourceId, source, themeName, baseTheme);

    return {
      ...token,
      theme: baseTheme,
      baseTheme,
      themeId,
      themeName,
      sourceId,
      sourceType: token.sourceType ?? source.type,
      priority: token.priority ?? source.config.priority
    };
  }

  private resolveThemeId(
    sourceId: string,
    source: ITokenSource,
    themeName: string,
    baseTheme: SourceBaseTheme
  ): string {
    if (source.type === SourceType.BUILTIN) {
      return baseTheme;
    }

    if (source.config.id) {
      return source.config.id;
    }

    const themeKey = themeName.trim().length > 0 ? themeName : baseTheme;
    return `${sourceId}:${themeKey}`;
  }

  private collectThemeDescriptorsFromTokens(
    tokens: ExtendedTokenInfo[]
  ): ThemeDescriptor[] {
    const themes = new Map<string, ThemeDescriptor>();

    for (const token of tokens) {
      if (!token.themeId) {
        continue;
      }

      themes.set(token.themeId, {
        id: token.themeId,
        name: token.themeName ?? token.themeId,
        baseTheme: token.baseTheme ?? token.theme,
        sourceId: token.sourceId,
        sourceType: token.sourceType,
        isBuiltin: token.source === 'builtin',
        priority: token.priority,
        metadata: {
          sourceFile: token.sourceFile
        }
      });
    }

    return Array.from(themes.values());
  }

  private getConfiguredThemeDescriptors(
    sourceId: string,
    source: ITokenSource
  ): ThemeDescriptor[] {
    if (source.type === SourceType.BUILTIN) {
      return [
        {
          id: 'light',
          name: 'light',
          baseTheme: 'light',
          sourceId,
          sourceType: source.type,
          isBuiltin: true,
          priority: source.config.priority
        },
        {
          id: 'dark',
          name: 'dark',
          baseTheme: 'dark',
          sourceId,
          sourceType: source.type,
          isBuiltin: true,
          priority: source.config.priority
        }
      ];
    }

    const baseTheme = source.config.baseTheme ?? 'light';
    const themeName =
      source.config.themeName?.trim() || source.config.id || sourceId;
    return [
      {
        id: source.config.id ?? `${sourceId}:${themeName}`,
        name: themeName,
        baseTheme,
        sourceId,
        sourceType: source.type,
        isBuiltin: false,
        priority: source.config.priority,
        metadata: {
          filePath: source.config.filePath
        }
      }
    ];
  }

  private attachThemeMetadata(
    metadata: Record<string, unknown> | undefined,
    themes: ThemeDescriptor[]
  ): Record<string, unknown> {
    const nextMetadata: Record<string, unknown> = metadata
      ? { ...metadata }
      : {};

    const serializedThemes = themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      baseTheme: theme.baseTheme,
      sourceId: theme.sourceId,
      sourceType: theme.sourceType,
      isBuiltin: theme.isBuiltin,
      priority: theme.priority,
      metadata: theme.metadata
    }));

    nextMetadata.themes = serializedThemes;

    if (themes.length === 1) {
      nextMetadata.themeId = themes[0].id;
      nextMetadata.themeName = themes[0].name;
      nextMetadata.baseTheme = themes[0].baseTheme;
    }

    return nextMetadata;
  }

  private getThemesFromMetadata(
    metadata: Record<string, unknown> | undefined
  ): ThemeDescriptor[] {
    if (!metadata) {
      return [];
    }

    const themesValue = metadata.themes;
    if (!Array.isArray(themesValue)) {
      return [];
    }

    const themes: ThemeDescriptor[] = [];

    for (const theme of themesValue) {
      if (!theme || typeof theme !== 'object') {
        continue;
      }

      const candidate = theme as Record<string, unknown>;
      const id = typeof candidate.id === 'string' ? candidate.id : undefined;
      const name =
        typeof candidate.name === 'string' ? candidate.name : undefined;
      const baseTheme =
        candidate.baseTheme === 'light' || candidate.baseTheme === 'dark'
          ? candidate.baseTheme
          : undefined;

      if (!id || !name || !baseTheme) {
        continue;
      }

      themes.push({
        id,
        name,
        baseTheme,
        sourceId:
          typeof candidate.sourceId === 'string'
            ? candidate.sourceId
            : undefined,
        sourceType: Object.values(SourceType).includes(
          candidate.sourceType as SourceType
        )
          ? (candidate.sourceType as SourceType)
          : undefined,
        isBuiltin: candidate.isBuiltin === true,
        priority:
          typeof candidate.priority === 'number'
            ? candidate.priority
            : undefined,
        metadata:
          candidate.metadata && typeof candidate.metadata === 'object'
            ? (candidate.metadata as Record<string, unknown>)
            : undefined
      });
    }

    return themes;
  }

  private refreshAvailableThemes(): void {
    this.themeManager?.setAvailableThemes(this.getThemeDescriptors());
  }
}
