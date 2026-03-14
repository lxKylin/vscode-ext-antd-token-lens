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
import { AntdTokenCompletionProvider } from './providers/completionProvider';
import { HoverContentBuilder } from './providers/hoverContentBuilder';
import { CompletionIcons } from './utils/completionIcons';
import { loadBuiltinTokens } from './data/antdTokens';
import { JsTokenScanner } from './tokenManager/jsTokenScanner';
import { JsTokenHoverProvider } from './providers/javascript/jsHoverProvider';
import { JsTokenCompletionProvider } from './providers/javascript/jsCompletionProvider';

let decorationManager: DocumentDecorationManager | undefined;
let completionProvider: AntdTokenCompletionProvider | undefined;
let jsDecorationManager: DocumentDecorationManager | undefined;
let jsDisposables: vscode.Disposable[] = [];

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
          decorationManager?.refresh();
        })
      );

      // 监听数据源变化，刷新装饰和补全
      if (sourceManager) {
        context.subscriptions.push(
          sourceManager.onDidSourcesChange(() => {
            console.log('[Extension] Sources changed, refreshing...');

            // 刷新所有编辑器的装饰
            decorationManager?.refresh();

            // 清空补全缓存
            completionProvider?.clearCache();
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
      scanner
    );

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

    // 创建 HoverContentBuilder（供 CompletionProvider 复用）
    const hoverContentBuilder = new HoverContentBuilder(
      tokenRegistry,
      themeManager
    );

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
            jsDecorationManager?.refresh();
          })
        );

        if (sourceManager) {
          decorationDisposables.push(
            sourceManager.onDidSourcesChange(() => {
              jsScanner.clearCache();
              jsDecorationManager?.refresh();
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
        const currentTheme = themeManager.getCurrentTheme();
        const tokenInfo = tokenRegistry.get(tokenName, currentTheme);

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
      themeManager.setTheme(newTheme);

      vscode.window.showInformationMessage(`已切换到 ${newTheme} 主题预览`);
    }),
    vscode.commands.registerCommand('antdToken.refreshTokens', async () => {
      const sourceManager = getSourceManager();
      if (sourceManager) {
        await sourceManager.reload();
      }

      decorationManager?.refresh();
      jsDecorationManager?.refresh();
      completionProvider?.clearCache();

      vscode.window.showInformationMessage('Token 数据已刷新');
    }),
    vscode.commands.registerCommand('antdToken.reloadSources', async () => {
      const sourceManager = getSourceManager();
      if (sourceManager) {
        await sourceManager.reload();
        vscode.window.showInformationMessage('Token 数据源已重新加载');
      } else {
        vscode.window.showWarningMessage('数据源管理器未初始化');
      }
    }),
    vscode.commands.registerCommand('antdToken.showSources', () => {
      const sourceManager = getSourceManager();
      if (!sourceManager) {
        vscode.window.showWarningMessage('数据源管理器未初始化');
        return;
      }

      const sources = sourceManager.getSourcesInfo();
      const items = sources.map((s) => ({
        label: s.description,
        detail: `类型: ${s.type} | 优先级: ${s.priority} | ${s.enabled ? '已启用' : '已禁用'}`,
        description: s.id
      }));

      vscode.window.showQuickPick(items, {
        title: 'Token 数据源',
        placeHolder: '当前加载的数据源列表'
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
