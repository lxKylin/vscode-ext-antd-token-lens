// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
  initializeTokenRegistry,
  tokenRegistry,
  themeManager,
  getSourceManager,
  getAutoScanner,
  dispose
} from './tokenManager';
import { TokenScanner } from './tokenManager/tokenScanner';
import { ColorDecorator } from './providers/colorDecorator';
import { DocumentDecorationManager } from './providers/documentDecorationManager';
import { ValueDecorator } from './providers/valueDecorator';
import { AntdTokenHoverProvider } from './providers/hoverProvider';

// 创建 HoverContentBuilder（供 HoverProvider 和 CompletionProvider 复用）
import { AntdTokenCompletionProvider } from './providers/completionProvider';
import { HoverContentBuilder } from './providers/hoverContentBuilder';
import { CompletionIcons } from './utils/completionIcons';
import { loadBuiltinTokens } from './data/antdTokens';
import { JsTokenScanner } from './tokenManager/jsTokenScanner';
import { JsTokenHoverProvider } from './providers/javascript/jsHoverProvider';
import { JsTokenCompletionProvider } from './providers/javascript/jsCompletionProvider';
import {
  formatReloadSummary,
  formatSourceQuickPickItem,
  formatSourceStatusDetail
} from '@/tokenManager/sourceStatusFormatter';

let decorationManager: DocumentDecorationManager | undefined;
let completionProvider: AntdTokenCompletionProvider | undefined;
let jsDecorationManager: DocumentDecorationManager | undefined;
let jsDisposables: vscode.Disposable[] = [];
let sharedHoverProvider: AntdTokenHoverProvider | undefined;
let sharedHoverContentBuilder: HoverContentBuilder | undefined;

function refreshThemeAwareViews(
  hoverProvider: AntdTokenHoverProvider | undefined = sharedHoverProvider,
  hoverContentBuilder:
    | HoverContentBuilder
    | undefined = sharedHoverContentBuilder
) {
  decorationManager?.refresh();
  jsDecorationManager?.refresh();
  hoverProvider?.clearCache();
  hoverContentBuilder?.clearCache();
  completionProvider?.clearCache();
}

function disposeJsSupport() {
  jsDisposables.forEach((d) => d.dispose());
  jsDisposables = [];
  jsDecorationManager = undefined;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "ant-design-token-lens" is now active!'
  );

  try {
    const isTestMode = context.extensionMode === vscode.ExtensionMode.Test;

    // 测试环境只加载内置 Token，避免完整数据源/自动扫描链路拖慢扩展主机启动。
    if (isTestMode) {
      tokenRegistry.clear();
      const builtinTokens = await loadBuiltinTokens(
        context.asAbsolutePath('out/assets/css')
      );
      tokenRegistry.registerBatch([
        ...builtinTokens.light,
        ...builtinTokens.dark
      ]);
    } else {
      await initializeTokenRegistry(context.asAbsolutePath('out/assets/css'));
    }
    console.log('Token Registry initialized successfully');
    console.log(`- Total tokens: ${tokenRegistry.size}`);
    console.log(`- Unique token names: ${tokenRegistry.uniqueSize}`);
    console.log(`- Current theme: ${themeManager.getCurrentTheme()}`);

    // 获取数据源管理器
    const sourceManager = getSourceManager();

    // 创建装饰器
    const scanner = new TokenScanner();

    // 创建 HoverContentBuilder（供 HoverProvider 和 CompletionProvider 复用）
    const hoverContentBuilder = new HoverContentBuilder(
      tokenRegistry,
      themeManager
    );
    sharedHoverContentBuilder = hoverContentBuilder;

    if (!isTestMode) {
      const colorDecorator = new ColorDecorator(tokenRegistry, themeManager);
      const valueDecorator = new ValueDecorator(tokenRegistry, themeManager);

      // 创建装饰管理器
      decorationManager = new DocumentDecorationManager(scanner, [
        colorDecorator,
        valueDecorator
      ]);

      // 监听主题切换，自动刷新装饰
      context.subscriptions.push(
        themeManager.onThemeChange(() => {
          refreshThemeAwareViews(hoverProvider, hoverContentBuilder);
        })
      );

      // 监听数据源变化，刷新装饰和补全
      if (sourceManager) {
        context.subscriptions.push(
          sourceManager.onDidSourcesChange(() => {
            console.log('[Extension] Sources changed, refreshing...');
            refreshThemeAwareViews(hoverProvider, hoverContentBuilder);
          })
        );
      }

      // 注册到上下文
      context.subscriptions.push(decorationManager);

      console.log('Color Decorator initialized successfully');
    }

    // 创建 HoverProvider
    const hoverProvider = new AntdTokenHoverProvider(
      tokenRegistry,
      themeManager,
      scanner,
      hoverContentBuilder
    );
    sharedHoverProvider = hoverProvider;

    // 注册 HoverProvider 到所有支持的语言
    const supportedLanguages = [
      'css',
      'less',
      'scss',
      'sass',
      'javascript',
      'javascriptreact',
      'typescript',
      'typescriptreact',
      'vue',
      'html',
      'markdown'
    ];

    for (const language of supportedLanguages) {
      context.subscriptions.push(
        vscode.languages.registerHoverProvider(
          { scheme: 'file', language },
          hoverProvider
        )
      );
    }

    console.log('Hover provider registered for supported languages');

    // 初始化补全图标管理器
    CompletionIcons.initialize(context);

    // 创建 CompletionProvider
    completionProvider = new AntdTokenCompletionProvider(
      tokenRegistry,
      themeManager,
      hoverContentBuilder,
      context
    );

    // 注册 CompletionProvider 到所有支持的语言
    const completionTriggerCharacters = [
      '(',
      // 让用户继续输入（如 --ant-co）时也能触发本扩展补全
      ...'abcdefghijklmnopqrstuvwxyz'.split(''),
      ...'0123456789'.split(''),
      '_'
    ];
    for (const language of supportedLanguages) {
      context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          { scheme: 'file', language },
          completionProvider,
          ...completionTriggerCharacters
        )
      );
    }

    console.log('Completion provider registered for supported languages');

    // ========== JS/TS Token 支持 ==========
    const jsLanguages = [
      'javascript',
      'javascriptreact',
      'typescript',
      'typescriptreact'
    ];

    function initJsSupport() {
      // 1. 创建 JS 扫描器
      const jsScanner = new JsTokenScanner(tokenRegistry, themeManager);

      // 2. 让 CSS decorationManager 跳过 JS/TS 文件（避免与 jsDecorationManager 共享 decorator 时互相覆盖）
      const jsLanguageIds = new Set(jsLanguages);
      if (!isTestMode) {
        const cssOnlyScanner = {
          isSupportedDocument: (doc: vscode.TextDocument) =>
            !jsLanguageIds.has(doc.languageId) &&
            scanner.isSupportedDocument(doc),
          scanDocument: (doc: vscode.TextDocument) => scanner.scanDocument(doc),
          scanRange: (doc: vscode.TextDocument, range: vscode.Range) =>
            scanner.scanRange(doc, range),
          scanLine: (text: string, lineNumber: number) =>
            scanner.scanLine(text, lineNumber),
          clearCache: (uri?: string) => scanner.clearCache(uri)
        } as unknown as TokenScanner;
        decorationManager?.updateScanner(cssOnlyScanner);
      }

      // 3. 创建合并扫描器：对 JS/TS 文件同时识别 var(--ant-xxx) 和 token.xxx 两种模式
      const jsCombinedScanner = {
        isSupportedDocument: (doc: vscode.TextDocument) =>
          jsScanner.isSupportedDocument(doc),
        scanDocument: (doc: vscode.TextDocument) => [
          ...scanner.scanDocument(doc),
          ...jsScanner.scanDocument(doc)
        ],
        scanRange: (doc: vscode.TextDocument, range: vscode.Range) =>
          scanner.scanRange(doc, range),
        scanLine: (text: string, lineNumber: number) =>
          scanner.scanLine(text, lineNumber),
        clearCache: (uri?: string) => {
          scanner.clearCache(uri);
          jsScanner.clearCache(uri);
        }
      } as unknown as TokenScanner;

      const decorationDisposables: vscode.Disposable[] = [];

      if (!isTestMode) {
        const jsColorDecorator = new ColorDecorator(
          tokenRegistry,
          themeManager
        );
        const jsValueDecorator = new ValueDecorator(
          tokenRegistry,
          themeManager
        );
        const jsDm = new DocumentDecorationManager(jsCombinedScanner, [
          jsColorDecorator,
          jsValueDecorator
        ]);
        jsDecorationManager = jsDm;
        decorationDisposables.push(
          jsDm,
          themeManager.onThemeChange(() => {
            jsScanner.clearCache();
            refreshThemeAwareViews();
          })
        );

        if (sourceManager) {
          decorationDisposables.push(
            sourceManager.onDidSourcesChange(() => {
              jsScanner.clearCache();
              refreshThemeAwareViews();
            })
          );
        }
      }

      const hoverDisposables = jsLanguages.map((lang) =>
        vscode.languages.registerHoverProvider(
          { scheme: 'file', language: lang },
          new JsTokenHoverProvider(hoverContentBuilder)
        )
      );

      const jsCompletionProvider = new JsTokenCompletionProvider(
        tokenRegistry,
        themeManager
      );
      const completionDisposables = jsLanguages.map((lang) =>
        vscode.languages.registerCompletionItemProvider(
          { scheme: 'file', language: lang },
          jsCompletionProvider,
          '.'
        )
      );

      jsDisposables = [
        ...jsDisposables,
        ...decorationDisposables,
        ...hoverDisposables,
        ...completionDisposables
      ];

      console.log('JS/TS Token support initialized');
    }

    const enableJsSupport = vscode.workspace
      .getConfiguration('antdToken')
      .get<boolean>('enableJsSupport', true);

    if (enableJsSupport) {
      initJsSupport();
    }

    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('antdToken')) {
          completionProvider?.clearCache();
          console.log('Completion cache cleared due to config change');
        }

        if (e.affectsConfiguration('antdToken.enableJsSupport')) {
          const enabled = vscode.workspace
            .getConfiguration('antdToken')
            .get<boolean>('enableJsSupport', true);
          if (enabled) {
            initJsSupport();
          } else {
            disposeJsSupport();
          }
        }

        if (e.affectsConfiguration('antdToken.colorDecorator.enabled')) {
          jsDecorationManager?.refresh();
        }
      }
    );

    const themeCacheDisposable = themeManager.onThemeChange(() => {
      completionProvider?.clearCache();
    });

    context.subscriptions.push(configChangeDisposable, themeCacheDisposable);
  } catch (error) {
    console.error('Failed to initialize Token Registry:', error);
    vscode.window.showErrorMessage(
      'Ant Design Token extension failed to initialize'
    );
  }

  const commandDisposables = [
    vscode.commands.registerCommand('antdToken.refreshDecorations', () => {
      decorationManager?.refresh();
      jsDecorationManager?.refresh();
      vscode.window.showInformationMessage('Ant Design Token 装饰已刷新');
    }),
    vscode.commands.registerCommand('antdToken.toggleDecorator', () => {
      const config = vscode.workspace.getConfiguration('antdToken');
      const enabled = config.get('colorDecorator.enabled', true);
      config.update(
        'colorDecorator.enabled',
        !enabled,
        vscode.ConfigurationTarget.Global
      );

      if (decorationManager) {
        decorationManager.refresh();
      }
      jsDecorationManager?.refresh();

      vscode.window.showInformationMessage(
        `Ant Design Token 装饰器已${!enabled ? '启用' : '禁用'}`
      );
    }),
    vscode.commands.registerCommand(
      'antdToken.copyTokenValue',
      (tokenName: string) => {
        const tokenInfo = tokenRegistry.getToken(
          tokenName,
          themeManager.getCurrentTokenQuery()
        );

        if (tokenInfo) {
          vscode.env.clipboard.writeText(tokenInfo.value);
          vscode.window.showInformationMessage(`已复制: ${tokenInfo.value}`);
        }
      }
    ),
    vscode.commands.registerCommand(
      'antdToken.findReferences',
      async (tokenName?: string) => {
        let targetToken = tokenName;

        if (!targetToken) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const selection = editor.document.getText(editor.selection);
            if (selection && selection.trim().length > 0) {
              const varMatch = selection.match(/var\(([^)]+)\)/);
              if (varMatch) {
                targetToken = varMatch[1];
              } else {
                targetToken = selection.trim();
              }
            }
          }
        }

        if (!targetToken) {
          targetToken = await vscode.window.showInputBox({
            placeHolder: '输入 Token 名称 (例如 --ant-color-primary)',
            prompt: '查找 Token 引用',
            value: '--ant-'
          });
        }

        if (targetToken) {
          const query = targetToken.startsWith('var(')
            ? targetToken
            : `var(${targetToken})`;

          await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: query,
            isRegex: false
          });
        }
      }
    ),
    vscode.commands.registerCommand('antdToken.toggleThemePreview', () => {
      const currentTheme = themeManager.getCurrentTheme();
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      themeManager.clearPreviewTheme();
      themeManager.setTheme(newTheme);

      vscode.window.showInformationMessage(`已切换到 ${newTheme} 主题预览`);
    }),
    vscode.commands.registerCommand(
      'antdToken.selectThemePreview',
      async () => {
        const availableThemes = themeManager.getAvailableThemes();
        const items: Array<
          vscode.QuickPickItem & { themeId?: string; clearPreview?: boolean }
        > = [
          {
            label: '自动 / 默认预览',
            description: '跟随当前基础主题的默认结果',
            detail: `当前基础主题: ${themeManager.getCurrentTheme()}`,
            clearPreview: true
          },
          ...availableThemes.map((theme) => ({
            label: theme.isActive ? `$(check) ${theme.name}` : theme.name,
            description: `${theme.baseTheme} · ${theme.sourceType ?? 'builtin'}`,
            detail: [
              `ID: ${theme.id}`,
              theme.sourceId ? `Source: ${theme.sourceId}` : undefined,
              theme.isBuiltin ? '内置主题' : '命名主题'
            ]
              .filter(Boolean)
              .join(' | '),
            themeId: theme.id
          }))
        ];

        const selected = await vscode.window.showQuickPick(items, {
          title: '选择主题预览',
          placeHolder: '选择一个命名主题，或恢复自动预览'
        });

        if (!selected) {
          return;
        }

        if (selected.clearPreview) {
          themeManager.clearPreviewTheme();
          vscode.window.showInformationMessage('已恢复自动主题预览');
          return;
        }

        if (!selected.themeId) {
          return;
        }

        themeManager.setPreviewTheme(selected.themeId);
        const currentTheme = themeManager.getCurrentThemeDescriptor();
        vscode.window.showInformationMessage(
          `已切换到主题预览: ${currentTheme.name} (${currentTheme.baseTheme})`
        );
      }
    ),
    vscode.commands.registerCommand('antdToken.refreshTokens', async () => {
      const sourceManager = getSourceManager();
      if (sourceManager) {
        await sourceManager.reload();
      }

      refreshThemeAwareViews();

      vscode.window.showInformationMessage('Token 数据已刷新');
    }),
    vscode.commands.registerCommand('antdToken.reloadSources', async () => {
      const sourceManager = getSourceManager();
      if (sourceManager) {
        const results = await sourceManager.reload();
        const statuses = results.flatMap((result) =>
          result.status ? [result.status] : []
        );
        const summary = formatReloadSummary(statuses);

        if (statuses.some((status) => status.health === 'error')) {
          vscode.window.showWarningMessage(
            `${summary}。可执行“查看 Token 数据源”检查失败原因。`
          );
        } else if (statuses.some((status) => status.health === 'warning')) {
          vscode.window.showInformationMessage(
            `${summary}。存在警告，可在“查看 Token 数据源”中查看详情。`
          );
        } else {
          vscode.window.showInformationMessage(summary);
        }
      } else {
        vscode.window.showWarningMessage('数据源管理器未初始化');
      }
    }),
    vscode.commands.registerCommand('antdToken.showSources', async () => {
      const sourceManager = getSourceManager();
      if (!sourceManager) {
        vscode.window.showWarningMessage('数据源管理器未初始化');
        return;
      }

      const statuses = sourceManager.getSourceStatuses();
      const items = statuses.map((status) => formatSourceQuickPickItem(status));

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Token 数据源',
        placeHolder: '当前加载的数据源列表'
      });

      if (!selected) {
        return;
      }

      const sourceStatus = statuses.find(
        (status) => status.sourceId === selected.sourceId
      );

      if (!sourceStatus) {
        return;
      }

      const document = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: formatSourceStatusDetail(sourceStatus)
      });

      await vscode.window.showTextDocument(document, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside
      });
    }),
    vscode.commands.registerCommand('antdToken.rescanTokenFiles', async () => {
      const autoScanner = getAutoScanner();
      if (autoScanner) {
        await autoScanner.scan();
        vscode.window.showInformationMessage('Token 文件扫描完成');
      } else {
        vscode.window.showWarningMessage('自动扫描器未初始化');
      }
    }),
    vscode.commands.registerCommand(
      'antdToken.onCompletionItemSelected',
      (tokenName: string) => {
        completionProvider?.recordTokenUsage(tokenName);
      }
    ),
    vscode.commands.registerCommand('antdToken.clearRecentTokens', () => {
      completionProvider?.clearRecentTokens();
      vscode.window.showInformationMessage('已清空最近使用的 Token 记录');
    })
  ];

  context.subscriptions.push(...commandDisposables);
}

// This method is called when your extension is deactivated
export function deactivate() {
  decorationManager?.dispose();
  disposeJsSupport();
  dispose();
}
