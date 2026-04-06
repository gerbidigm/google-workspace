/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Creates a DXT (Desktop Extension) bundle for Claude Desktop.
 *
 * A DXT is a zip archive containing:
 *   manifest.json   - DXT manifest (spec version 0.3)
 *   dist/           - esbuild-bundled MCP server (single index.js)
 *   node_modules/   - native dependencies only (keytar, jsdom)
 *
 * Install (recipient):
 *   Double-click the .dxt file in Claude Desktop, or drag it onto the
 *   Claude Desktop window.
 */

const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');
const argv = require('minimist')(process.argv.slice(2));

const deleteFilesByExtension = (dir, ext) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
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
      'Error: --platform must be a string (e.g., --platform=darwin).',
    );
    process.exit(1);
  }

  const baseName = 'google-workspace-gerbidigm';
  const archiveName = platform
    ? `${platform}.${baseName}.dxt`
    : `${baseName}.dxt`;

  const rootDir = path.join(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release');
  const stagingDir = path.join(releaseDir, `${baseName}-dxt`);
  const workspaceServerDir = path.join(rootDir, 'workspace-server');

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(releaseDir, { recursive: true });

  // manifest.json — embed version from package.json / git tag
  const packageJson = require('../package.json');
  const version = (process.env.GITHUB_REF_NAME || packageJson.version).replace(
    /^v/,
    '',
  );
  const manifest = require('../dxt/manifest.json');
  fs.writeFileSync(
    path.join(stagingDir, 'manifest.json'),
    JSON.stringify({ ...manifest, version }, null, 2),
  );

  // dist/ — esbuild-bundled server
  fs.cpSync(
    path.join(workspaceServerDir, 'dist'),
    path.join(stagingDir, 'dist'),
    { recursive: true },
  );
  deleteFilesByExtension(path.join(stagingDir, 'dist'), '.d.ts');
  deleteFilesByExtension(path.join(stagingDir, 'dist'), '.map');

  // Remove headless-login — it's a standalone CLI tool, not the MCP server
  const headlessLogin = path.join(stagingDir, 'dist', 'headless-login.js');
  if (fs.existsSync(headlessLogin)) fs.unlinkSync(headlessLogin);

  // node_modules/ — native dependencies only (keytar, jsdom)
  const nodeModulesDir = path.join(stagingDir, 'node_modules');
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

  // Create the zip archive with a .dxt extension
  const outputPath = path.join(releaseDir, archiveName);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log(`DXT bundle created: ${archiveName}`);
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(stagingDir, false);
    archive.finalize();
  });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
