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
      const { themeConfig, sourceFile } = await this.themeConfigLoader.load(
        this.config
      );
      const resolvedAntd = await this.antdResolver.resolve(this.config);
      const normalizedThemeConfig = this.antdResolver.resolveAlgorithms(
        themeConfig,
        resolvedAntd.algorithms
      );
      const designTokens = resolvedAntd.getDesignToken(normalizedThemeConfig);

      return this.designTokenMapper(designTokens, {
        baseTheme: this.config.baseTheme ?? 'light',
        priority: this.config.priority,
        source: 'custom',
        sourceFile: sourceFile ?? this.config.filePath,
        sourceType: SourceType.ANTD_THEME
      });
    } catch (error) {
      console.error('[AntdThemeSource] Load failed:', error);
      return [];
    }
  }

  async validate(): Promise<boolean> {
    if (this.config.enabled === false) {
      return false;
    }

    if (
      !this.config.themeConfig &&
      !this.config.designToken &&
      !this.config.filePath
    ) {
      return false;
    }

    if (this.config.filePath) {
      try {
        await fs.access(this.config.filePath);
      } catch {
        return false;
      }
    }

    return true;
  }

  getDescription(): string {
    const sourceLabel = this.config.filePath
      ? path.basename(this.config.filePath)
      : 'inline';
    const themeName = this.config.themeName ?? this.config.id ?? 'unnamed';
    return `Antd Theme: ${themeName} (${sourceLabel}, ${this.config.baseTheme ?? 'light'})`;
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
}
