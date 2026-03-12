# Gerbidigm Tools Setup

Quick setup guide for using the Gerbidigm custom tools.

## Prerequisites

1. **Google Workspace Authentication**
   - Already configured via `node scripts/auth-utils.js login`
   - Required for: docs, gmail, directory tools

2. **Gemini API Key** (Required for image analysis tools)

## Setting up Gemini API

The `gerbidigm.gemini.*` tools require a Gemini API key.

### Get Your API Key

1. Visit: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy your key

### Configure API Key

**Option 1: Environment Variable (Recommended)**

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
export GEMINI_API_KEY="your-api-key-here"

# Reload your shell
source ~/.bashrc  # or ~/.zshrc
```

**Option 2: Project-specific .env file**

```bash
# Create .env in project root (not committed to git)
echo "GEMINI_API_KEY=your-api-key-here" > .env
```

**Option 3: Runtime (for testing)**

```bash
# Set for single session
GEMINI_API_KEY="your-key" gemini
```

### Verify Setup

After setting the environment variable, restart the MCP server and test:

```bash
# Restart Gemini CLI or Claude Code
gemini --debug

# Or rebuild and relink
npm run build
gemini extensions uninstall google-workspace
gemini extensions link .
```

Test with a simple image:

```typescript
await gerbidigm.gemini.describeImage({
  image: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
  },
  prompt: "What animal is this?"
});
```

## Available Tool Sets

### 1. Gmail Tools (No extra setup)

- `gerbidigm.gmail.fetchFlexible` - Flexible Gmail message fetching
- `gerbidigm.gmail.batchFetchFlexible` - Batch Gmail fetching

**Skill:** `skills/gerbidigm/gmail-fetch.md`

### 2. Docs Tools (No extra setup)

- `gerbidigm.docs.extractImages` - Extract images from Google Docs

**Skill:** `skills/gerbidigm/docs-image-analysis.md`

### 3. Gemini Tools (Requires GEMINI_API_KEY)

- `gerbidigm.gemini.describeImage` - Analyze single image
- `gerbidigm.gemini.describeImageBatch` - Analyze multiple images

**Skill:** `skills/gerbidigm/docs-image-analysis.md`

### 4. Directory Tools (No extra setup)

- `gerbidigm.searchDirectory` - Search Google Workspace directory

**Skill:** (wrapper for people.getUserProfile)

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install `@google/generative-ai` and other required packages.

### 2. Build

```bash
npm run build
```

### 3. Link Extension (Gemini CLI)

```bash
gemini extensions link .
```

### 4. Or Configure for Claude Code

See `.mcp.json` in project root or `claude-plugin/` directory.

## Troubleshooting

### "Gemini API not initialized"

**Problem:** GEMINI_API_KEY environment variable not set.

**Solution:**
1. Set the environment variable (see above)
2. Restart your terminal/shell
3. Restart the MCP server (Gemini CLI or Claude Code)
4. Verify: `echo $GEMINI_API_KEY` should show your key

### "Failed to fetch image"

**Problem:** Image URL not accessible.

**Solutions:**
- Verify the contentUri is correct
- Google Docs images may require authentication
- Try downloading the image and passing as base64:

```typescript
const response = await fetch(imageUrl);
const buffer = await response.arrayBuffer();
const base64 = Buffer.from(buffer).toString('base64');

await gerbidigm.gemini.describeImage({
  image: {
    base64: base64,
    mimeType: "image/jpeg"
  }
});
```

### Rate Limit Errors

**Problem:** Hitting Gemini API rate limits.

**Solutions:**
- Free tier: 15 requests/min, 1M tokens/day
- Use smaller batches (5-10 images)
- Add delays between batches
- Upgrade to paid tier for higher limits

### Build Errors

**Problem:** TypeScript compilation errors.

**Solution:**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

## Cost Management

### Free Tier Limits

Gemini API free tier includes:
- 15 requests per minute
- 1 million tokens per day
- 1,500 requests per day

This is sufficient for:
- ~3,870 images/day with Flash
- Development and testing
- Small-scale production use

### Paid Tier

For production use with higher volume:
- 360 requests/minute
- No daily token limits
- ~$0.0002 per image (Flash)
- ~$0.003 per image (Pro)

See: https://ai.google.dev/pricing

## Next Steps

1. Review skill documentation:
   - `skills/gerbidigm/docs-image-analysis.md` - Complete image workflow
   - `skills/gerbidigm/gmail-fetch.md` - Gmail tools usage

2. Try the test prompts:
   - `skills/gerbidigm/TEST_PROMPTS.md`

3. Run verification:
   ```bash
   node scripts/verify-tools.js
   ```

## Getting Help

- Check skill documentation for detailed usage examples
- Review API documentation:
  - [Google Docs API](https://developers.google.com/workspace/docs/api)
  - [Gemini API](https://ai.google.dev/docs)
- Open an issue in the repository

## Security Notes

- Never commit `.env` files with API keys
- Keep `GEMINI_API_KEY` secure
- API keys in environment variables are safer than in code
- Rotate keys periodically
- Monitor API usage in Google AI Studio
