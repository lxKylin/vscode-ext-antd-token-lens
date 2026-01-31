const esbuild = require('esbuild');
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        if (location) {
          console.error(
            `${location.file}:${location.line}:${location.column}: Error: ${text}`
          );
        } else {
          console.error(`Error: ${text}`);
        }
      });
      console.log('[watch] build finished');
    });
  }
};

const fs = require('fs');
const path = require('path');

// Plugin to copy assets
const copyAssetsPlugin = {
  name: 'copy-assets',
  setup(build) {
    build.onEnd(() => {
      const sourceDir = path.join(__dirname, 'src/assets');
      const destDir = path.join(__dirname, 'out/assets');

      if (!fs.existsSync(sourceDir)) {
        return;
      }

      // Recursive copy function
      function copyRecursive(src, dest) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      try {
        copyRecursive(sourceDir, destDir);
        console.log('[assets] copied successfully');
      } catch (err) {
        console.error('[assets] copy failed:', err);
      }
    });
  }
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    // 显式配置 tsconfig 路径，确保 esbuild 正确读取 paths 映射
    tsconfig: './tsconfig.json',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
      copyAssetsPlugin
    ]
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
