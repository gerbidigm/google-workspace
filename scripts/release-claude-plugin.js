/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Creates a pre-built Claude plugin artifact that recipients can install
 * without needing to build from source.
 *
 * Archive structure:
 *   .claude-plugin/  - plugin manifest and marketplace registry
 *   .mcp.json        - MCP server config (uses ${CLAUDE_PLUGIN_ROOT})
 *   dist/            - esbuild-bundled server (single index.js)
 *   node_modules/    - keytar + jsdom native dependencies only
 *   skills/          - skill documentation
 *   WORKSPACE-Context.md
 *
 * Install (recipient):
 *   tar -xzf google-workspace-claude-plugin.tar.gz
 *   claude plugin marketplace add ./google-workspace-claude-plugin
 *   claude plugin install google-workspace-gerbidigm@gerbidigm
 */

const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');
const argv = require('minimist')(process.argv.slice(2));

const deleteFilesByExtension = (dir, ext) => {
  if (!fs.existsSync(dir)) {
    return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);
    if (stat.isDirectory()) {
      deleteFilesByExtension(filePath, ext);
    } else if (filePath.endsWith(ext)) {
      fs.unlinkSync(filePath);
    }
  }
};

const main = async () => {
  const platform = argv.platform;
  if (platform && typeof platform !== 'string') {
    console.error(
      'Error: The --platform argument must be a string (e.g., --platform=linux).',
    );
    process.exit(1);
  }

  const baseName = 'google-workspace-claude-plugin';
  const name = platform ? `${platform}.${baseName}` : baseName;
  const extension = 'tar.gz';

  const rootDir = path.join(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release');
  const archiveName = `${name}.${extension}`;
  const archiveDir = path.join(releaseDir, baseName);
  const workspaceMcpServerDir = path.join(rootDir, 'workspace-server');

  fs.rmSync(archiveDir, { recursive: true, force: true });
  fs.mkdirSync(archiveDir, { recursive: true });

  // Copy dist/ (esbuild-bundled server)
  fs.cpSync(
    path.join(workspaceMcpServerDir, 'dist'),
    path.join(archiveDir, 'dist'),
    { recursive: true },
  );

  // Strip source maps and type declarations
  const distDir = path.join(archiveDir, 'dist');
  deleteFilesByExtension(distDir, '.d.ts');
  deleteFilesByExtension(distDir, '.map');

  // Copy native dependencies (keytar, jsdom)
  const nodeModulesDir = path.join(archiveDir, 'node_modules');
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  const { getTransitiveDependencies } = require('./utils/dependencies');
  const visited = getTransitiveDependencies(rootDir, ['keytar', 'jsdom']);

  visited.forEach((pkg) => {
    const source = path.join(rootDir, 'node_modules', pkg);
    const dest = path.join(nodeModulesDir, pkg);
    if (fs.existsSync(source)) {
      fs.cpSync(source, dest, { recursive: true });
    }
  });

  const packageJson = require('../package.json');
  const version = (process.env.GITHUB_REF_NAME || packageJson.version).replace(
    /^v/,
    '',
  );

  // .claude-plugin/ — copy plugin.json from source and generate marketplace.json
  const claudePluginDir = path.join(archiveDir, '.claude-plugin');
  fs.mkdirSync(claudePluginDir, { recursive: true });

  const sourcePluginJson = require('../claude-plugin/.claude-plugin/plugin.json');
  fs.writeFileSync(
    path.join(claudePluginDir, 'plugin.json'),
    JSON.stringify({ ...sourcePluginJson, version }, null, 2),
  );

  // marketplace.json: source "." because plugin root IS the archive root
  const marketplaceJson = {
    name: 'gerbidigm',
    owner: { name: 'Gerbidigm' },
    metadata: {
      description:
        'Google Workspace MCP integration with Gerbidigm enhancements',
      version,
    },
    plugins: [
      {
        name: 'google-workspace-gerbidigm',
        source: '.',
        description:
          'Google Workspace MCP integration with Gerbidigm enhancements. Manage Gmail, Docs, Sheets, Slides, Drive, Calendar, Chat, and People API.',
        version,
        author: { name: 'Gerbidigm' },
      },
    ],
  };
  fs.writeFileSync(
    path.join(claudePluginDir, 'marketplace.json'),
    JSON.stringify(marketplaceJson, null, 2),
  );

  // .mcp.json — flat path: dist/ is at plugin root, no workspace-server subdir
  const mcpJson = {
    'google-workspace': {
      command: 'node',
      args: ['${CLAUDE_PLUGIN_ROOT}/dist/index.js'],
    },
  };
  fs.writeFileSync(
    path.join(archiveDir, '.mcp.json'),
    JSON.stringify(mcpJson, null, 2),
  );

  // Copy skills documentation
  const skillsDir = path.join(rootDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    fs.cpSync(skillsDir, path.join(archiveDir, 'skills'), {
      recursive: true,
    });
  }

  // Copy context file
  fs.copyFileSync(
    path.join(workspaceMcpServerDir, 'WORKSPACE-Context.md'),
    path.join(archiveDir, 'WORKSPACE-Context.md'),
  );

  // Create archive (placed in release/ alongside the Gemini tarballs)
  const output = fs.createWriteStream(path.join(releaseDir, archiveName));
  const archive = archiver('tar', { gzip: true });

  const archivePromise = new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(archive.pointer() + ' total bytes');
      console.log('Claude plugin archive created: ' + archiveName);
      resolve();
    });
    archive.on('error', reject);
  });

  archive.pipe(output);
  archive.directory(archiveDir, baseName);
  archive.finalize();

  await archivePromise;
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
