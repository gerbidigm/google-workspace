# Installation Guide

Step-by-step guide to install the Google Workspace + Gerbidigm plugin for Claude Code.

## Prerequisites

### 1. Node.js 20+

Check your version:
```bash
node --version
```

If you need to install or upgrade:
- **macOS**: `brew install node@20`
- **Linux**: Use nvm or your package manager
- **Windows**: Download from [nodejs.org](https://nodejs.org)

### 2. Claude Code CLI

Install if you haven't already:
```bash
npm install -g @anthropic/claude-code
```

Or via brew:
```bash
brew install claude-code
```

### 3. Google Workspace Account

You need a Google account with access to Gmail, Drive, Docs, etc.

## Installation Steps

### Step 1: Clone and Build

```bash
# Clone the repository
git clone https://github.com/gerbidigm/workspace
cd workspace

# Install dependencies
npm install

# Build the MCP server
npm run build
```

**Verify build succeeded:**
```bash
ls workspace-server/dist/index.js
```

Should show the built server file.

### Step 2: Authenticate with Google

```bash
node scripts/auth-utils.js login
```

Follow the prompts:
1. A browser will open for Google OAuth
2. Sign in to your Google account
3. Grant the requested permissions
4. Return to the terminal

**Verify authentication:**
```bash
node scripts/auth-utils.js status
```

Should show: "✅ Authenticated"

### Step 3: Verify Tools Registration

```bash
node scripts/verify-tools.js
```

Expected output:
```
✅ Gerbidigm tools registered: 5
✅ Server started successfully
✅ All checks passed!
```

### Step 4: Install the Plugin

Claude Code requires a marketplace to install local plugins. Register this repo as a
local marketplace, then install from it:

```bash
# From the workspace root directory:
claude plugin marketplace add .
claude plugin install google-workspace-gerbidigm@gerbidigm
```

Expected output:
```
Adding marketplace...
✔ Successfully added marketplace: gerbidigm (declared in user settings)
Installing plugin "google-workspace-gerbidigm@gerbidigm"...
✔ Successfully installed plugin: google-workspace-gerbidigm@gerbidigm (scope: user)
```

**Verify installation:**
```bash
claude plugin list
```

Should show:
```
google-workspace-gerbidigm@gerbidigm  v0.1.0  enabled
```

### Step 5: Test the Installation

Start Claude Code:
```bash
claude
```

Check MCP status:
```
/mcp
```

Expected:
- `google-workspace` server listed
- Status: **connected** ✅

Test tools are available:
```
What gerbidigm tools are available?
```

Expected: List of 5 gerbidigm tools

### Step 6: Run First Test

```
Search my Gmail for emails from the last 24 hours and show me 5 message IDs
```

If this works, you're all set! 🎉

## Installation Verification Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] Claude Code CLI installed (`claude --version`)
- [ ] Repository cloned and built (`npm run build`)
- [ ] Authenticated with Google (`node scripts/auth-utils.js status`)
- [ ] Tools verified (`node scripts/verify-tools.js`)
- [ ] Plugin installed (`claude plugins list`)
- [ ] Server connected (`/mcp` shows connected)
- [ ] Tools available (gerbidigm tools listed)
- [ ] Gmail search works

## Common Installation Issues

### Issue: npm install fails

**Solution:**
```bash
# Clear cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules

# Reinstall
npm install
```

### Issue: Build fails

**Solution:**
```bash
# Check Node version
node --version  # Should be 20.x

# Clean and rebuild
rm -rf workspace-server/dist
npm run build
```

### Issue: Authentication fails

**Solution:**
```bash
# Clear existing credentials
node scripts/auth-utils.js clear

# Try login again
node scripts/auth-utils.js login
```

**For headless environments (SSH, WSL, etc.):**
The login script will display a URL you can open in any browser (phone, local machine, etc.).

### Issue: Plugin install fails

**Error:** "Plugin not found in any configured marketplace"

`claude plugins install ./path` does not work for local plugins. You must register a
marketplace first:

```bash
# From the workspace root directory
claude plugin marketplace add .
claude plugin install google-workspace-gerbidigm@gerbidigm
```

**Error:** "Marketplace file not found"

The `.claude-plugin/marketplace.json` file is missing. Ensure you have the latest version
of the repo (it should be present at `.claude-plugin/marketplace.json`).

### Issue: Server not connecting

**Check plugin configuration:**
```bash
claude plugin get google-workspace-gerbidigm@gerbidigm
```

**Reinstall plugin:**
```bash
claude plugin uninstall google-workspace-gerbidigm@gerbidigm
claude plugin install google-workspace-gerbidigm@gerbidigm
```

**Check server manually:**
```bash
node workspace-server/dist/index.js --debug
```

Should start without errors. Press Ctrl+C to stop.

## Post-Installation

### Update Plugin

After making changes or pulling updates:

```bash
# Rebuild
npm run build

# Update version in plugin.json (if needed)
# Then reinstall
claude plugin uninstall google-workspace-gerbidigm@gerbidigm
claude plugin install google-workspace-gerbidigm@gerbidigm
```

### Enable Debug Mode

Edit `claude-plugin/.mcp.json`:

```json
{
  "google-workspace": {
    "command": "node",
    "args": [
      "${CLAUDE_PLUGIN_ROOT}/../workspace-server/dist/index.js",
      "--debug"
    ]
  }
}
```

Reinstall the plugin for changes to take effect.

### Multiple Installations

You can install the plugin in different ways for different use cases:

**Development (local, from source):**
```bash
claude --plugin-dir ./claude-plugin
```

**Personal (installed, user-scoped):**
```bash
claude plugin marketplace add .
claude plugin install google-workspace-gerbidigm@gerbidigm
```

**Team (git clone + install):**
Team members clone the repo and run the same two commands above.

## Uninstallation

To remove the plugin:

```bash
claude plugin uninstall google-workspace-gerbidigm@gerbidigm
```

To also clear authentication:

```bash
node scripts/auth-utils.js clear
```

## Next Steps

After successful installation:

1. **Quick test** - See [TESTING.md](TESTING.md) for test prompts
2. **Learn skills** - See [skills/gerbidigm/](skills/gerbidigm/) for guides
3. **Read docs** - See [README.md](README.md) for features and usage

## Getting Help

- **Verification**: Run `node scripts/verify-tools.js`
- **Auth status**: Run `node scripts/auth-utils.js status`
- **Plugin info**: Run `claude plugin get google-workspace-gerbidigm@gerbidigm`
- **Issues**: https://github.com/gerbidigm/workspace/issues

## System Requirements

- **OS**: macOS, Linux, or Windows (with WSL recommended)
- **Node.js**: 20.19.0 or later
- **Claude Code**: Latest version
- **Memory**: 2GB RAM minimum
- **Disk**: 500MB for dependencies and build

## Security Notes

- Credentials stored in system keychain (macOS) or equivalent
- OAuth tokens never exposed to AI models
- Plugin runs locally (no data sent to third parties)
- Review [security considerations](README.md#security-considerations)

## Support

If you encounter issues not covered here:

1. Check [TESTING.md](TESTING.md) troubleshooting section
2. Review [docs/CLAUDE_CODE_CLI.md](../docs/CLAUDE_CODE_CLI.md)
3. Search existing [GitHub issues](https://github.com/gerbidigm/workspace/issues)
4. Open a new issue with:
   - Output of `node --version`
   - Output of `node scripts/verify-tools.js`
   - Output of `claude plugins list`
   - Error messages and logs
