#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple verification script for Gerbidigm custom tools.
 * This script checks that:
 * - The project builds successfully
 * - The MCP server can start
 * - Custom tools are registered
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const SERVER_PATH = path.join(
  __dirname,
  '..',
  'workspace-server',
  'dist',
  'index.js',
);

console.log('🔍 Verifying Gerbidigm Custom Tools\n');

// Check if dist exists
const fs = require('node:fs');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Server not built. Run: npm run build');
  process.exit(1);
}

console.log('✅ Server build found');
console.log('📍 Server path:', SERVER_PATH);
console.log('\n🚀 Starting MCP server to verify tool registration...\n');

// Start the server process
const serverProcess = spawn('node', [SERVER_PATH, '--debug'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let toolRegistrationFound = false;
let gerbidigmToolsCount = 0;
let capturedOutput = [];

// Monitor stderr for tool registration message
const stderrReader = readline.createInterface({
  input: serverProcess.stderr,
  crlfDelay: Infinity,
});

stderrReader.on('line', (line) => {
  capturedOutput.push(line);

  // Look for tool registration message
  if (line.includes('Registered') && line.includes('Gerbidigm custom tools')) {
    toolRegistrationFound = true;
    const match = line.match(/Registered (\d+) Gerbidigm custom tools/);
    if (match) {
      gerbidigmToolsCount = parseInt(match[1], 10);
    }
  }

  // Show relevant lines
  if (
    line.includes('Gerbidigm') ||
    line.includes('gerbidigm') ||
    line.includes('MCP server running')
  ) {
    console.log('📋', line);
  }
});

// Monitor stdout for MCP protocol messages
serverProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach((line) => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        if (message.result?.tools) {
          // Server responded to list_tools request
          const gerbidigmTools = message.result.tools.filter((tool) =>
            tool.name.startsWith('gerbidigm'),
          );
          console.log(
            `\n✅ Found ${gerbidigmTools.length} gerbidigm tools in MCP response:\n`,
          );
          gerbidigmTools.forEach((tool) => {
            console.log(`   • ${tool.name}`);
            console.log(`     ${tool.description}\n`);
          });
        }
      } catch (e) {
        // Not JSON or not the message we're looking for
      }
    }
  });
});

// Handle server exit
serverProcess.on('close', (code) => {
  console.log('\n📊 Verification Results:\n');

  if (toolRegistrationFound) {
    console.log(`✅ Gerbidigm tools registered: ${gerbidigmToolsCount}`);
    console.log('✅ Server started successfully');
    console.log('\n📝 Expected tools:');
    console.log('   • gerbidigm_echo (or gerbidigm.echo)');
    console.log('   • gerbidigm_anotherTool (or gerbidigm.anotherTool)');
    console.log('   • gerbidigm_gmail_fetchFlexible (or gerbidigm.gmail.fetchFlexible)');
    console.log(
      '   • gerbidigm_gmail_batchFetchFlexible (or gerbidigm.gmail.batchFetchFlexible)',
    );
    console.log('   • gerbidigm_searchDirectory (if peopleService available)');
    console.log('\n✅ All checks passed!');
    console.log('\n📖 Next steps:');
    console.log('   1. Restart Claude Desktop to load the new tools');
    console.log('   2. See skills/gerbidigm/TEST_PROMPTS.md for test prompts');
    console.log('   3. See skills/gerbidigm/TESTING.md for detailed test scenarios');
    process.exit(0);
  } else {
    console.log('❌ Tool registration message not found');
    console.log('\n📋 Server output:');
    capturedOutput.forEach((line) => console.log('   ', line));
    console.log('\n⚠️  Possible issues:');
    console.log('   • Server failed to start');
    console.log('   • register-tools.ts not imported correctly');
    console.log('   • Build is outdated (run: npm run build)');
    process.exit(1);
  }
});

// Send a list_tools request after a short delay
setTimeout(() => {
  try {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    };
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
  } catch (e) {
    console.error('Failed to send request:', e.message);
  }
}, 1000);

// Wait a bit then kill the server
setTimeout(() => {
  serverProcess.kill('SIGTERM');
}, 3000);

// Handle errors
serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});
