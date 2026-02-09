/**
 * Token 数据源管理器
 * 统一管理多个 Token 数据源
 */

import * as vscode from 'vscode';
import { TokenRegistry } from './tokenRegistry';
import {
  ITokenSource,
  SourceConfig,
  SourceType,
  ExtendedTokenInfo,
  LoadResult
} from './sourceTypes';
import { BuiltinTokenSource } from './sources/builtinSource';
import { CSSTokenSource } from './sources/cssSource';
import { Config } from '../utils/config';

export class SourceManager implements vscode.Disposable {
  private sources: Map<string, ITokenSource> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onDidSourcesChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidSourcesChange = this.onDidSourcesChangeEmitter.event;
  private assetsPath: string;

  constructor(
    private tokenRegistry: TokenRegistry,
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

    // 验证数据源
    const isValid = await source.validate();
    if (!isValid) {
      console.warn(`[SourceManager] Source validation failed: ${sourceId}`);
      source.dispose();
      return;
    }

    // 添加到管理器
    this.sources.set(sourceId, source);

    // 监听文件变更（如果支持）
    if ('onDidChange' in source) {
      const onChange = (source as any).onDidChange as vscode.Event<void>;
      this.disposables.push(onChange(() => this.handleSourceChange(sourceId)));
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
      return {
        success: false,
        tokens: [],
        source: SourceType.BUILTIN,
        error: 'Source not found'
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

      return {
        success: true,
        tokens,
        source: source.type,
        loadTime
      };
    } catch (error) {
      console.error(`[SourceManager] Load failed: ${sourceId}`, error);
      return {
        success: false,
        tokens: [],
        source: source.type,
        error: String(error)
      };
    }
  }

  /**
   * 重新加载所有数据源
   */
  async reload(): Promise<void> {
    console.log('[SourceManager] Reloading all sources...');

    // 清空 TokenRegistry
    this.tokenRegistry.clear();

    // 重新加载
    await this.loadAllSources();
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
  }> {
    return Array.from(this.sources.entries()).map(([id, source]) => ({
      id,
      type: source.type,
      description: source.getDescription(),
      enabled: source.config.enabled,
      priority: source.config.priority
    }));
  }

  dispose(): void {
    // 清理所有数据源
    for (const source of this.sources.values()) {
      source.dispose();
    }
    this.sources.clear();

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

    // 重新加载该数据源
    await this.loadSource(sourceId);

    // 触发更新事件
    this.onDidSourcesChangeEmitter.fire();
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
      configs.push({
        type: source.type as SourceType,
        enabled: source.enabled !== false,
        priority: source.priority ?? 10 + index,
        filePath: source.filePath,
        watch: source.watch !== false
      });
    }

    return configs;
  }

  /**
   * 监听配置变化
   */
  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('antdToken.sources')) {
          console.log('[SourceManager] Configuration changed, reloading...');

          // 重新初始化
          // 清理现有数据源
          for (const source of this.sources.values()) {
            source.dispose();
          }
          this.sources.clear();

          // 重新加载
          await this.initialize();
        }
      })
    );
  }
}
