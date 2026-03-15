import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BaseTokenSource } from './baseSource';
import {
  AntdThemeSourceConfig,
  ExtendedTokenInfo,
  SourceType
} from '../sourceTypes';
import {
  ThemeConfigLoader,
  ThemeConfigLoadResult
} from '../resolvers/themeConfigLoader';
import { AntdResolver, ResolvedAntdThemeApi } from '../resolvers/antdResolver';
import {
  mapDesignTokens,
  DesignTokenMapperOptions
} from '../mappers/designTokenMapper';
import {
  createWarning,
  SourceDiagnostic,
  SourceErrorCode,
  SourceValidationResult,
  toSourceDiagnostic
} from '../sourceDiagnostics';

interface AntdThemeSourceDependencies {
  themeConfigLoader?: ThemeConfigLoader;
  antdResolver?: AntdResolver;
  designTokenMapper?: (
    designTokens: Record<string, unknown>,
    options: DesignTokenMapperOptions
  ) => ExtendedTokenInfo[];
  createFileSystemWatcher?: (
    pattern: vscode.GlobPattern
  ) => vscode.FileSystemWatcher;
}

export class AntdThemeTokenSource extends BaseTokenSource {
  private fileWatcher?: vscode.FileSystemWatcher;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private readonly themeConfigLoader: ThemeConfigLoader;
  private readonly antdResolver: AntdResolver;
  private readonly designTokenMapper: (
    designTokens: Record<string, unknown>,
    options: DesignTokenMapperOptions
  ) => ExtendedTokenInfo[];
  private readonly createFileSystemWatcher: (
    pattern: vscode.GlobPattern
  ) => vscode.FileSystemWatcher;

  constructor(
    public readonly config: AntdThemeSourceConfig,
    dependencies: AntdThemeSourceDependencies = {}
  ) {
    super(SourceType.ANTD_THEME, config);

    this.themeConfigLoader =
      dependencies.themeConfigLoader ?? new ThemeConfigLoader();
    this.antdResolver = dependencies.antdResolver ?? new AntdResolver();
    this.designTokenMapper = dependencies.designTokenMapper ?? mapDesignTokens;
    this.createFileSystemWatcher =
      dependencies.createFileSystemWatcher ??
      ((pattern) => vscode.workspace.createFileSystemWatcher(pattern));

    if (config.watch && config.filePath) {
      this.setupFileWatcher(config.filePath);
    }
  }

  async load(): Promise<ExtendedTokenInfo[]> {
    try {
      const loadResult = await this.themeConfigLoader.load(this.config);
      const resolvedAntd = await this.antdResolver.resolve(this.config);
      const algorithmResult = this.antdResolver.resolveAlgorithmsDetailed(
        loadResult.themeConfig,
        resolvedAntd.algorithms
      );
      const designTokens = resolvedAntd.getDesignToken(
        algorithmResult.themeConfig
      );
      const warnings = this.collectWarnings(loadResult.warnings);
      const metadata = this.buildMetadata(
        loadResult,
        warnings,
        resolvedAntd,
        algorithmResult.summary
      );

      this.setDiagnostics(undefined, warnings, metadata);

      return this.designTokenMapper(designTokens, {
        baseTheme: this.getResolvedBaseTheme(),
        priority: this.config.priority,
        source: 'custom',
        sourceId: this.config.id,
        sourceFile: loadResult.sourceFile ?? this.config.filePath,
        sourceType: SourceType.ANTD_THEME,
        themeId: this.getResolvedThemeId(),
        themeName: this.getResolvedThemeName()
      });
    } catch (error) {
      const diagnostic = toSourceDiagnostic(error, {
        code: SourceErrorCode.LOAD_FAILED,
        message: 'antdTheme 数据源加载失败'
      });
      const runtimeMetadata = this.getRuntimeMetadata();
      const metadata = {
        ...this.buildBaseMetadata(),
        lastOutcome: 'error'
      };
      if (runtimeMetadata) {
        Object.assign(metadata, runtimeMetadata);
      }
      this.setDiagnostics(diagnostic, this.getWarnings(), metadata);
      console.error('[AntdThemeSource] Load failed:', error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    const result = await this.validateDetailed();
    return result.valid;
  }

  override async validateDetailed(): Promise<SourceValidationResult> {
    if (this.config.enabled === false) {
      const metadata = {
        ...this.buildBaseMetadata(),
        lastOutcome: 'idle'
      };
      this.clearDiagnostics(metadata);
      return {
        valid: false,
        warnings: [],
        metadata
      };
    }

    const baseWarnings = this.collectWarnings();

    if (this.config.filePath) {
      try {
        await fs.access(this.config.filePath);
      } catch (error) {
        const diagnostic = toSourceDiagnostic(error, {
          code: SourceErrorCode.FILE_NOT_FOUND,
          message: `主题文件不存在或不可访问: ${this.config.filePath}`
        });
        const metadata = {
          ...this.buildBaseMetadata(),
          lastOutcome: 'error'
        };
        this.setDiagnostics(diagnostic, baseWarnings, metadata);
        return {
          valid: false,
          error: diagnostic,
          warnings: baseWarnings,
          metadata
        };
      }
    }

    try {
      const loadResult = await this.themeConfigLoader.load(this.config);
      const warnings = this.collectWarnings(loadResult.warnings);
      const metadata = this.buildMetadata(loadResult, warnings);
      this.setDiagnostics(undefined, warnings, metadata);
      return {
        valid: true,
        warnings,
        metadata
      };
    } catch (error) {
      const diagnostic = toSourceDiagnostic(error, {
        code: SourceErrorCode.VALIDATION_FAILED,
        message: 'antdTheme 配置校验失败'
      });
      const metadata = {
        ...this.buildBaseMetadata(),
        lastOutcome: 'error'
      };
      this.setDiagnostics(diagnostic, baseWarnings, metadata);
      return {
        valid: false,
        error: diagnostic,
        warnings: baseWarnings,
        metadata
      };
    }
  }

  getDescription(): string {
    const sourceLabel = this.config.filePath
      ? path.basename(this.config.filePath)
      : 'inline';
    return `Antd Theme: ${this.getResolvedThemeName()} (${sourceLabel}, ${this.getResolvedBaseTheme()})`;
  }

  dispose(): void {
    super.dispose();
    this.fileWatcher?.dispose();
  }

  private setupFileWatcher(filePath: string): void {
    const pattern = new vscode.RelativePattern(
      path.dirname(filePath),
      path.basename(filePath)
    );

    this.fileWatcher = this.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidChange(() => {
      console.log(`[AntdThemeSource] File changed: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.fileWatcher.onDidDelete(() => {
      console.log(`[AntdThemeSource] File deleted: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.disposables.push(this.fileWatcher, this.onDidChangeEmitter);
  }

  private getResolvedThemeName(): string {
    return this.config.themeName?.trim() || this.config.id || 'antdTheme';
  }

  private getResolvedThemeId(): string {
    return (
      this.config.id?.trim() ||
      `${SourceType.ANTD_THEME}:${this.getResolvedThemeName()}`
    );
  }

  private getResolvedBaseTheme(): 'light' | 'dark' {
    return this.config.baseTheme ?? 'light';
  }

  private collectWarnings(
    loaderWarnings: SourceDiagnostic[] = []
  ): SourceDiagnostic[] {
    const warnings = [...loaderWarnings];

    if (this.config.watch && !this.config.filePath) {
      warnings.push(
        createWarning(
          SourceErrorCode.CONFIG_WATCH_REQUIRES_FILEPATH,
          'watch 已启用，但未提供 filePath，文件监听不会生效'
        )
      );
    }

    return warnings;
  }

  private buildBaseMetadata(): Record<string, unknown> {
    return {
      themeId: this.getResolvedThemeId(),
      themeName: this.getResolvedThemeName(),
      baseTheme: this.getResolvedBaseTheme(),
      configuredFilePath: this.config.filePath,
      sourceLocation: this.config.filePath ?? 'inline',
      exportName: this.config.exportName,
      resolveFromWorkspace: this.config.resolveFromWorkspace !== false,
      priority: this.config.priority,
      watch: this.config.watch === true
    };
  }

  private buildMetadata(
    loadResult: ThemeConfigLoadResult,
    warnings: SourceDiagnostic[],
    resolvedAntd?: ResolvedAntdThemeApi,
    algorithmSummary: string[] = []
  ): Record<string, unknown> {
    return {
      ...this.buildBaseMetadata(),
      entryType: loadResult.entryType,
      inputKind: loadResult.inputKind,
      sourceLocation: loadResult.resolvedFilePath ?? 'inline',
      resolvedFilePath: loadResult.resolvedFilePath,
      usedExportName: loadResult.usedExportName,
      usedExportKind: loadResult.usedExportKind,
      antdVersion: resolvedAntd?.version,
      antdPackagePath: resolvedAntd?.packagePath,
      antdResolvedFrom: resolvedAntd?.resolvedFrom,
      antdAttemptedStartDirs: resolvedAntd?.attemptedStartDirs,
      allowWorkspaceFallback: resolvedAntd?.allowWorkspaceFallback,
      algorithmSummary,
      warningMessages: warnings.map((warning) => warning.message),
      lastOutcome: warnings.length > 0 ? 'warning' : 'ok'
    };
  }
}
