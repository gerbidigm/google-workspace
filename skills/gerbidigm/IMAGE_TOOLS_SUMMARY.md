# Image Tools - Complete Summary

This document summarizes the Gerbidigm tools for working with images in Google Docs:

- **Extraction & Analysis** - Extract images and analyze with Gemini AI
- **Insertion & Creation** - Upload images and create docs with embedded images

## What Was Added

### New Services

1. **[DocsImageService.ts](workspace-server/src/gerbidigm/services/DocsImageService.ts)**
   - Extracts images from Google Docs using the `positionedObjects` API field
   - Supports multi-tab documents
   - Returns image metadata: URLs, properties, positioning, tab info

2. **[GeminiService.ts](workspace-server/src/gerbidigm/services/GeminiService.ts)**
   - Integrates Gemini AI for image analysis
   - Supports URL and base64 image inputs
   - Provides single and batch analysis capabilities
   - Handles fetch, conversion, and API communication

### All Gerbidigm Tools (11 total)

| Tool Name | Description | Prerequisites |
|-----------|-------------|---------------|
| **Image Extraction & Analysis** | | |
| `gerbidigm.docs.extractImages` | Extract all images from a Google Doc with metadata | Google Workspace auth |
| `gerbidigm.gemini.describeImage` | Analyze a single image with Gemini AI | GEMINI_API_KEY |
| `gerbidigm.gemini.describeImageBatch` | Batch analyze up to 50 images efficiently | GEMINI_API_KEY |
| **Image Insertion & Creation** | | |
| `gerbidigm.drive.uploadImage` | Upload local images to Google Drive (PNG, JPEG, GIF, SVG) | Google Workspace auth |
| `gerbidigm.docs.insertImage` | Insert images into existing Google Docs | Google Workspace auth |
| `gerbidigm.docs.createWithImages` | Create new docs with mixed text/image content | Google Workspace auth |
| **Other Tools** | | |
| `gerbidigm.gmail.fetchFlexible` | Flexible Gmail message fetching | Google Workspace auth |
| `gerbidigm.gmail.batchFetchFlexible` | Batch Gmail fetching | Google Workspace auth |
| `gerbidigm.searchDirectory` | Search Workspace directory | Google Workspace auth |
| `gerbidigm.echo` | Example custom tool | None |
| `gerbidigm.anotherTool` | Example custom tool | None |

### Skills

1. **[docs-image-analysis.md](skills/gerbidigm/docs-image-analysis.md)** (2,400+ lines)
   - Image extraction and AI analysis workflow
   - 6 detailed use cases with examples
   - Performance and cost optimization
   - Model selection guidance
   - Rate limiting strategies
   - Advanced patterns and troubleshooting

2. **[docs-image-insertion.md](skills/gerbidigm/docs-image-insertion.md)** (New!)
   - Complete guide for creating docs with images
   - Image positioning (beginning, end, specific indices)
   - Image sizing in points (72 points = 1 inch)
   - 5 common workflows (reports, galleries, technical docs)
   - Batch upload patterns
   - Error handling and troubleshooting

3. **[SETUP.md](skills/gerbidigm/SETUP.md)** (300+ lines)
   - Prerequisites and installation
   - Gemini API key configuration
   - Tool verification steps
   - Troubleshooting guide
   - Security best practices

### Updated Files

1. **[package.json](package.json)**
   - Added `@google/generative-ai` dependency

2. **[register-tools.ts](workspace-server/src/gerbidigm/register-tools.ts)**
   - Registered 6 image tools total:
     - Extraction: extractImages
     - Analysis: describeImage, describeImageBatch
     - Insertion: uploadImage, insertImage, createWithImages
   - Updated tool count from 5 to 11

3. **[README.md](skills/gerbidigm/README.md)**
   - Added documentation for new skills
   - Updated available skills list

## Workflow Example

### Complete End-to-End Image Analysis

```typescript
// Step 1: Extract images from a Google Doc
const { images } = await gerbidigm.docs.extractImages({
  documentId: "1abc...xyz"
});
// Returns: Array of images with contentUri, mimeType, positioning, etc.

// Step 2: Analyze all images with Gemini AI
const analysis = await gerbidigm.gemini.describeImageBatch({
  images: images.map(img => ({
    url: img.contentUri,
    mimeType: img.mimeType
  })),
  prompt: "Describe each image in detail.",
  model: "gemini-1.5-flash",
  individualPrompts: true
});
// Returns: Descriptions for each image with success/error status

// Step 3: Process results
analysis.results.forEach((result, i) => {
  if (!result.error) {
    console.log(`Image ${i + 1}: ${result.description}`);
  }
});
```

## Key Features

### 1. Image Extraction
- **Positioned Objects API**: Uses official Google Docs API field
- **Multi-tab Support**: Works with tabbed documents
- **Rich Metadata**: Returns URLs, MIME types, dimensions, positioning
- **Tab Context**: Includes which tab each image is from

### 2. AI Analysis
- **Multiple Models**: Support for Flash (fast/cheap) and Pro (advanced)
- **Flexible Input**: URL or base64-encoded images
- **Batch Processing**: Up to 50 images per request
- **Two Strategies**:
  - Individual prompts: Each image analyzed separately (detailed)
  - Shared context: All images in one request (comparative)

### 3. Cost Optimization
- **Token-based pricing**: ~$0.0002 per image (Flash)
- **Batch efficiency**: Saves rate limits, not costs
- **Free tier**: 15 requests/min, 1M tokens/day
- **Model selection**: Flash 17x cheaper than Pro

## Use Cases

1. **Document Image Inventory**
   - Catalog all images with AI-generated descriptions
   - Extract metadata for asset management

2. **Technical Diagram Analysis**
   - Explain architecture diagrams
   - Document system designs
   - Extract component relationships

3. **Accessibility**
   - Generate alt text for all images
   - Improve document accessibility

4. **Data Extraction**
   - Pull data from embedded charts/graphs
   - Convert visual data to structured format

5. **Quality Assurance**
   - Verify images match descriptions
   - Check for consistency

6. **Content Analysis**
   - Compare image sequences
   - Identify common themes

## Setup Requirements

### 1. Google Workspace (Already Configured)
- Required for `gerbidigm.docs.extractImages`
- Uses existing OAuth authentication
- No additional setup needed

### 2. Gemini API Key (New Requirement)
- Required for `gerbidigm.gemini.*` tools
- Get key at: https://aistudio.google.com/app/apikey
- Set environment variable:
  ```bash
  export GEMINI_API_KEY="your-api-key-here"
  ```

### 3. Install Dependencies
```bash
npm install  # Installs @google/generative-ai
npm run build
```

## API Costs & Limits

### Google Workspace APIs
- **Cost**: FREE ✅
- **Rate Limits**: 300 requests/min (Docs API)
- **Usage**: 1 request per extractImages call

### Gemini API

**Free Tier:**
- 15 requests/minute
- 1 million tokens/day
- 1,500 requests/day
- Good for ~3,870 images/day

**Paid Tier (Flash):**
- 360 requests/minute
- $0.075 per 1M input tokens
- $0.30 per 1M output tokens
- ~$0.0002 per image analyzed

**Cost Examples:**
- 100 images with descriptions: **$0.017** (Flash) or **$0.28** (Pro)
- Alt text for 1,000 images: **$0.17** (Flash)

## Performance Tips

1. **Use Batching**: Process 10-15 images per batch
2. **Choose Model Wisely**: Flash for simple images, Pro for complex diagrams
3. **Optimize Prompts**: Shorter prompts = fewer output tokens = lower cost
4. **Respect Rate Limits**: Add delays if processing many batches
5. **Filter First**: Extract all images, then analyze only relevant ones

## Next Steps

### For Users

1. **Setup**: Follow [SETUP.md](skills/gerbidigm/SETUP.md)
2. **Learn**: Read [docs-image-analysis.md](skills/gerbidigm/docs-image-analysis.md)
3. **Test**: Try extracting images from a sample document
4. **Analyze**: Use Gemini tools to describe the images

### For Developers

1. **Review Code**:
   - [DocsImageService.ts](workspace-server/src/gerbidigm/services/DocsImageService.ts) - Image extraction
   - [GeminiService.ts](workspace-server/src/gerbidigm/services/GeminiService.ts) - AI analysis

2. **Extend**:
   - Add more image analysis prompts
   - Create specialized workflows
   - Integrate with other tools

3. **Test**:
   - Verify tools with [verify-tools.js](scripts/verify-tools.js)
   - Add unit tests for new services

## Technical Details

### Architecture

```text
User Request
    ↓
DocsImageService.extractImages()
    ↓
Google Docs API (positionedObjects field)
    ↓
Return: Array of image metadata + contentUri
    ↓
GeminiService.describeImageBatch()
    ↓
Fetch images from contentUri
    ↓
Convert to base64 inline data
    ↓
Gemini API (generateContent)
    ↓
Return: AI-generated descriptions
```

### API Integration

**Google Docs API:**
- Endpoint: `docs.documents.get()`
- Fields: `tabs` with `includeTabsContent: true`
- Extracts: `tabs.documentTab.positionedObjects`

**Gemini API:**
- Package: `@google/generative-ai`
- Models: `gemini-1.5-flash`, `gemini-1.5-pro`
- Input: Text prompts + inline image data (base64)

### Error Handling

Both services include comprehensive error handling:
- Invalid document IDs
- Missing API keys
- Network failures
- Rate limit errors
- Individual image failures in batch operations

## File Changes Summary

```text
New Files:
  workspace-server/src/gerbidigm/services/DocsImageService.ts
  workspace-server/src/gerbidigm/services/GeminiService.ts
  skills/gerbidigm/docs-image-analysis.md
  skills/gerbidigm/SETUP.md
  IMAGE_TOOLS_SUMMARY.md (this file)

Modified Files:
  workspace-server/src/gerbidigm/register-tools.ts
  skills/gerbidigm/README.md
  package.json

Total Lines Added: ~3,000+
```

## Resources

- [Google Docs API - Positioned Objects](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#DocumentTab.FIELDS.positioned_objects)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Google AI Studio](https://aistudio.google.com/)

## Contributing

When adding new Gerbidigm tools:

1. Create service in `workspace-server/src/gerbidigm/services/`
2. Register in `register-tools.ts`
3. Add skill documentation in `skills/gerbidigm/`
4. Update `skills/gerbidigm/README.md`
5. Test with `scripts/verify-tools.js`
6. Document in main README or summary files

## Support

For questions or issues:
- Review skill documentation first
- Check [SETUP.md](skills/gerbidigm/SETUP.md) troubleshooting
- Verify API keys and authentication
- Check rate limits and quotas
