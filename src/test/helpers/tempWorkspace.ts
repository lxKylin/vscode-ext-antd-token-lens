import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export async function createTempWorkspace(
  prefix: string = 'antd-token-lens-'
): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function writeWorkspaceFiles(
  rootDir: string,
  files: Record<string, string>
): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(rootDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
  }
}

export async function removeTempWorkspace(rootDir: string): Promise<void> {
  await fs.rm(rootDir, { recursive: true, force: true });
}

export async function createFakeAntdPackage(rootDir: string): Promise<void> {
  await writeWorkspaceFiles(rootDir, {
    'node_modules/antd/package.json': JSON.stringify(
      {
        name: 'antd',
        version: '5.99.0-test',
        main: 'index.js'
      },
      null,
      2
    ),
    'node_modules/antd/index.js': `
const theme = {
  defaultAlgorithm: { type: 'default' },
  darkAlgorithm: { type: 'dark' },
  compactAlgorithm: { type: 'compact' },
  getDesignToken(config = {}) {
    const algorithms = Array.isArray(config.algorithm)
      ? config.algorithm
      : config.algorithm
        ? [config.algorithm]
        : [];
    const token = {
      colorPrimary: '#1677ff',
      borderRadius: 6,
      ...(config.token || {})
    };

    if (algorithms.includes(theme.darkAlgorithm)) {
      token.colorBgBase = '#000000';
    }

    if (algorithms.includes(theme.compactAlgorithm)) {
      token.borderRadius = 4;
    }

    return token;
  }
};

module.exports = { theme };
`
  });
}
