// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
  initializeTokenRegistry,
  tokenRegistry,
  themeManager,
  dispose
} from './tokenManager';
import { TokenScanner } from './tokenManager/tokenScanner';
import { ColorDecorator } from './providers/colorDecorator';
import { DocumentDecorationManager } from './providers/documentDecorationManager';
import { AntdTokenHoverProvider } from './providers/hoverProvider';
import { AntdTokenCompletionProvider } from './providers/completionProvider';
import { HoverContentBuilder } from './providers/hoverContentBuilder';
import { CompletionIcons } from './utils/completionIcons';

let decorationManager: DocumentDecorationManager | undefined;
let completionProvider: AntdTokenCompletionProvider | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "ant-design-token-lens" is now active!'
  );

  try {
    // 初始化 Token 管理模块
    initializeTokenRegistry(context.asAbsolutePath('out/assets/css'));
    console.log('Token Registry initialized successfully');
    console.log(`- Total tokens: ${tokenRegistry.size}`);
    console.log(`- Unique token names: ${tokenRegistry.uniqueSize}`);
    console.log(`- Current theme: ${themeManager.getCurrentTheme()}`);

    // 创建装饰器
    const scanner = new TokenScanner();
    const decorator = new ColorDecorator(tokenRegistry, themeManager);

    // 创建装饰管理器
    decorationManager = new DocumentDecorationManager(scanner, decorator);

    // 监听主题切换，自动刷新装饰
    context.subscriptions.push(
      themeManager.onThemeChange(() => {
        decorationManager?.refresh();
      })
    );

    // 注册到上下文
    context.subscriptions.push(decorationManager);

    console.log('Color Decorator initialized successfully');

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

    // 监听配置变化清空缓存
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('antdToken')) {
          completionProvider?.clearCache();
          console.log('Completion cache cleared due to config change');
        }
      })
    );

    // 监听主题变化清空补全缓存
    context.subscriptions.push(
      themeManager.onThemeChange(() => {
        completionProvider?.clearCache();
      })
    );
  } catch (error) {
    console.error('Failed to initialize Token Registry:', error);
    vscode.window.showErrorMessage(
      'Ant Design Token extension failed to initialize'
    );
  }

  // 注册命令：刷新装饰
  context.subscriptions.push(
    vscode.commands.registerCommand('antdToken.refreshDecorations', () => {
      decorationManager?.refresh();
      vscode.window.showInformationMessage('Ant Design Token 装饰已刷新');
    })
  );

  // 注册命令：切换装饰器
  context.subscriptions.push(
    vscode.commands.registerCommand('antdToken.toggleDecorator', () => {
      const config = vscode.workspace.getConfiguration('antdToken');
      const enabled = config.get('colorDecorator.enabled', true);
      config.update(
        'colorDecorator.enabled',
        !enabled,
        vscode.ConfigurationTarget.Global
      );

      // 立即刷新装饰
      if (decorationManager) {
        decorationManager.refresh();
      }

      vscode.window.showInformationMessage(
        `Ant Design Token 装饰器已${!enabled ? '启用' : '禁用'}`
      );
    })
  );

  // 命令：复制 Token 值
  context.subscriptions.push(
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
    )
  );

  // 命令：查找所有引用
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'antdToken.findReferences',
      async (tokenName?: string) => {
        let targetToken = tokenName;

        // 如果没有提供 token 名称，尝试从当前编辑器选区获取，或者让用户输入
        if (!targetToken) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const selection = editor.document.getText(editor.selection);
            // 简单的正则检查，看是否看起来像一个 token
            if (selection && selection.trim().length > 0) {
              // 如果选中的是完整的 var(--token)，提取 token 名
              const varMatch = selection.match(/var\(([^)]+)\)/);
              if (varMatch) {
                targetToken = varMatch[1];
              } else {
                // 假设选中的就是 token 名 (例如 --ant-primary-color)
                targetToken = selection.trim();
              }
            }
          }
        }

        // 如果还是没有获取到，弹出输入框让用户输入
        if (!targetToken) {
          targetToken = await vscode.window.showInputBox({
            placeHolder: '输入 Token 名称 (例如 --ant-color-primary)',
            prompt: '查找 Token 引用',
            value: '--ant-'
          });
        }

        if (targetToken) {
          // 在工作区中搜索该 Token 的所有使用
          // 如果用户输入的已经是 var(...) 格式，就不再包裹
          const query = targetToken.startsWith('var(')
            ? targetToken
            : `var(${targetToken})`;

          await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: query,
            isRegex: false
          });
        }
      }
    )
  );

  // 命令：切换主题预览
  context.subscriptions.push(
    vscode.commands.registerCommand('antdToken.toggleThemePreview', () => {
      const currentTheme = themeManager.getCurrentTheme();
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      themeManager.setTheme(newTheme);

      vscode.window.showInformationMessage(`已切换到 ${newTheme} 主题预览`);
    })
  );

  // 命令：刷新 Token 数据
  context.subscriptions.push(
    vscode.commands.registerCommand('antdToken.refreshTokens', () => {
      // 重新初始化 Token 注册表
      initializeTokenRegistry(context.asAbsolutePath('out/assets/css'));

      // 刷新所有装饰
      decorationManager?.refresh();

      // 清空补全缓存
      completionProvider?.clearCache();

      vscode.window.showInformationMessage('Token 数据已刷新');
    })
  );

  // 注册补全项选择命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'antdToken.onCompletionItemSelected',
      (tokenName: string) => {
        completionProvider?.recordTokenUsage(tokenName);
      }
    )
  );

  // 注册清空最近使用记录命令
  context.subscriptions.push(
    vscode.commands.registerCommand('antdToken.clearRecentTokens', () => {
      completionProvider?.clearRecentTokens();
      vscode.window.showInformationMessage('已清空最近使用的 Token 记录');
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  decorationManager?.dispose();
  dispose();
}
