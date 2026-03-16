# Google Workspace + Gerbidigm Claude Code Plugin

A comprehensive Google Workspace integration for Claude Code with enhanced
Gerbidigm tools for flexible Gmail operations.

## Features

### Core Google Workspace Tools (~100+ tools)

- **Gmail**: Send, search, read, label, draft management
- **Google Docs**: Create, read, update documents with rich formatting
- **Google Sheets**: Spreadsheet operations, data manipulation
- **Google Slides**: Presentation creation and editing
- **Google Drive**: File management, search, permissions
- **Google Calendar**: Event management, scheduling
- **Google Chat**: Messaging and space management
- **People API**: Contact and directory management

### Gerbidigm Enhanced Tools (5 tools)

#### Flexible Gmail Fetch Tools

1. **`gerbidigm_gmail_fetchFlexible`**
   - Fetch single Gmail messages with fine-grained control
   - Format options: minimal, metadata, full, raw
   - Field masks for partial responses (reduce bandwidth)
   - Selective header retrieval

2. **`gerbidigm_gmail_batchFetchFlexible`**
   - Batch fetch up to 100 messages in one call
   - Same flexible format and field mask control
   - Parallel processing under the hood
   - Efficient for processing search results

#### Utility Tools

3. **`gerbidigm_searchDirectory`** - Enhanced Google Workspace directory search
4. **`gerbidigm_echo`** - Example tool for testing
5. **`gerbidigm_anotherTool`** - Example tool for development

## Installation

### Prerequisites

1. **Node.js 20+** (required)
2. **Google Workspace account** with appropriate permissions
3. **Claude Code CLI** installed

### Quick Install

```bash
# Clone or download this repository
git clone https://github.com/gerbidigm/workspace
cd workspace

# Install dependencies and build
npm install
npm run build

# Authenticate with Google
node scripts/auth-utils.js login

# Install the plugin
claude plugins install ./claude-plugin
```

### Test Installation

```bash
claude
```

Then:

```
/mcp
```

You should see `google-workspace` server connected.

## Usage

### Basic Gmail Operations

```
Search my Gmail for emails from last week
```

```
Create a draft email to john@example.com with subject "Meeting followup"
```

### Flexible Gmail Fetch

**Get just metadata (fast):**

```
Use gerbidigm_gmail_fetchFlexible to fetch message <ID> with:
- format: "metadata"
- metadataHeaders: ["From", "Subject", "Date"]
```

**Batch process multiple emails:**

```
Search Gmail for unread emails, then use gerbidigm_gmail_batchFetchFlexible
to get metadata for the first 20 efficiently
```

**Optimize with field masks:**

```
Use gerbidigm_gmail_fetchFlexible with format "full" and
fields "id,snippet,payload/headers" to get just what you need
```

### Google Docs

```
Create a new Google Doc titled "Project Plan" with heading "Overview"
```

```
Search my Drive for documents containing "Q1 2024"
```

### Calendar

```
What's on my calendar tomorrow?
```

```
Create a calendar event for "Team standup" tomorrow at 10am
```

## Skills

The plugin includes comprehensive skill documentation:

- **`gmail-fetch.md`** - Complete guide for flexible Gmail tools
  - Format options explained
  - Field mask patterns
  - Real-world examples
  - Performance tips

See `skills/gerbidigm/` for all available skills.

## Configuration

### MCP Server Config

The plugin automatically configures the Google Workspace MCP server using
`.mcp.json`.

### Authentication

First-time use requires Google OAuth:

```bash
node scripts/auth-utils.js login
```

Credentials are stored securely in the system keychain.

### Debug Mode

Enable debug logging:

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

## Plugin Structure

```
claude-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── .mcp.json                 # MCP server configuration
├── README.md                 # This file
├── skills/                   # Skill documentation (symlink)
└── TESTING.md                # Testing guide
```

## Skills Available

All skills from `skills/gerbidigm/` are accessible:

- **gmail-fetch.md** - Flexible Gmail fetch guide
- **TESTING.md** - 10 test scenarios
- **TEST_PROMPTS.md** - Copy-paste test prompts
- **QUICK_START.md** - 5-minute getting started

Reference skills in conversation:

```
Can you show me the gmail-fetch skill for flexible email fetching?
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Verify tools are registered
node scripts/verify-tools.js

# Test locally
claude --plugin-dir ./claude-plugin
```

### Adding Custom Tools

1. Create service in `workspace-server/src/gerbidigm/services/`
2. Register in `workspace-server/src/gerbidigm/register-tools.ts`
3. Rebuild: `npm run build`
4. Update plugin version in `plugin.json`

## Troubleshooting

### Plugin Not Loading

```bash
# Verify plugin is installed
claude plugins list

# Reinstall
claude plugins remove google-workspace-gerbidigm
claude plugins install ./claude-plugin
```

### Authentication Errors

```bash
# Check auth status
node scripts/auth-utils.js status

# Re-authenticate
node scripts/auth-utils.js login
```

### Tools Not Appearing

```bash
# Rebuild
npm run build

# Verify registration
node scripts/verify-tools.js

# Restart Claude Code
exit
claude
```

### Server Not Starting

1. Ensure Node.js 20+ is installed: `node --version`
2. Install dependencies: `npm install`
3. Build the server: `npm run build`
4. Check server path in `.mcp.json`

## Performance Tips

### Use Flexible Gmail Tools

Standard `gmail_get` fetches complete messages. Use Gerbidigm flexible tools
instead:

- **Metadata only**: 5-10x smaller response, 3-5x faster
- **Batch operations**: 20-50x faster than individual fetches
- **Field masks**: 2-10x reduction in response size

See `skills/gerbidigm/gmail-fetch.md` for detailed patterns.

## Security Considerations

**Important**: This plugin grants access to your Google Workspace data.

- Never use with untrusted inputs
- Be cautious processing emails/documents from unknown sources
- Review the
  [security warning](../README.md#important-security-consideration-indirect-prompt-injection-risk)

## API Quotas

Google APIs have rate limits:

- Gmail: 250 quota units/second per user
- Drive: 12,000 requests/minute
- Calendar: 1,000,000 queries/day

Flexible fetch tools help stay within limits through:

- Reduced bandwidth with field masks
- Batch operations (fewer API calls)
- Format optimization

## License

Apache-2.0 - See [LICENSE](../LICENSE) for details.

## Contributing

Contributions welcome! See [CLAUDE.md](../CLAUDE.md) for development guidelines.

## Support

- **Issues**: https://github.com/gerbidigm/workspace/issues
- **Documentation**: See `docs/` directory
- **Skills**: See `skills/gerbidigm/` directory

## Changelog

### v0.1.0 (2024-03-09)

- Initial plugin release
- Core Google Workspace MCP integration (~100 tools)
- Gerbidigm flexible Gmail fetch tools
- Comprehensive skill documentation
- Testing infrastructure

## Related Resources

- [Google Workspace API Documentation](https://developers.google.com/workspace)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code Documentation](https://code.claude.com/docs)
