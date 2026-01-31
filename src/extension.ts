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

let decorationManager: DocumentDecorationManager | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "antd-css-tokens" is now active!'
  );

  try {
    // 初始化 Token 管理模块
    initializeTokenRegistry();
    console.log('Token Registry initialized successfully');
    console.log(`- Total tokens: ${tokenRegistry.size}`);
    console.log(`- Unique token names: ${tokenRegistry.uniqueSize}`);
    console.log(`- Current theme: ${themeManager.getCurrentTheme()}`);

    // 创建装饰器
    const scanner = new TokenScanner();
    const decorator = new ColorDecorator(tokenRegistry, themeManager);

    // 创建装饰管理器
    decorationManager = new DocumentDecorationManager(scanner, decorator);

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
      'html'
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
  } catch (error) {
    console.error('Failed to initialize Token Registry:', error);
    vscode.window.showErrorMessage(
      'Ant Design Token extension failed to initialize'
    );
  }

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    'antd-css-tokens.helloWorld',
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      const stats = `Token Registry Stats:
- Total tokens: ${tokenRegistry.size}
- Unique names: ${tokenRegistry.uniqueSize}
- Current theme: ${themeManager.getCurrentTheme()}
- Color tokens: ${tokenRegistry.getByCategory('color').length}
- Size tokens: ${tokenRegistry.getByCategory('size').length}`;

      vscode.window.showInformationMessage(stats);
    }
  );

  context.subscriptions.push(disposable);

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
      async (tokenName: string) => {
        // 在工作区中搜索该 Token 的所有使用
        const pattern = `var(${tokenName})`;
        await vscode.commands.executeCommand('workbench.action.findInFiles', {
          query: pattern,
          isRegex: false
        });
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
      initializeTokenRegistry();

      // 刷新所有装饰
      decorationManager?.refresh();

      vscode.window.showInformationMessage('Token 数据已刷新');
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  decorationManager?.dispose();
  dispose();
}
