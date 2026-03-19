# Docs Image Analysis Skill

Complete workflow for extracting and analyzing images from Google Docs using
Gemini AI.

## Overview

This skill combines three powerful tools to extract images from Google Docs and
analyze them with Gemini AI:

1. **gerbidigm.docs.extractImages** - Extract image URLs from any Google Doc
2. **gerbidigm.gemini.describeImage** - Analyze a single image with Gemini
3. **gerbidigm.gemini.describeImageBatch** - Analyze multiple images efficiently

## Prerequisites

**Required Environment Variable:**

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Get your API key at: https://aistudio.google.com/app/apikey

## Quick Start

### Basic Workflow

```typescript
// Step 1: Extract all images from a document
const { images } = await gerbidigm.docs.extractImages({
  documentId: '1abc...xyz',
});

// Step 2: Analyze images in batch
const result = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({
    url: img.contentUri,
    mimeType: img.mimeType,
  })),
  prompt: 'Describe each image briefly.',
  model: 'gemini-1.5-flash',
});
```

## Use Cases

### 1. Document Image Inventory

Generate a complete inventory of all images in a document with descriptions:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'your-doc-id',
});

const descriptions = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  prompt: 'Provide a concise title and description for this image.',
  individualPrompts: true,
});
```

### 2. Technical Diagram Analysis

Extract and explain all diagrams from technical documentation:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'technical-spec-doc',
});

const analysis = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  prompt:
    'Explain this diagram, including all components, connections, and data flow.',
  sharedContext:
    'These diagrams are from a microservices architecture document.',
  model: 'gemini-1.5-pro', // Use Pro for complex technical diagrams
  individualPrompts: true,
});
```

### 3. Accessibility: Generate Alt Text

Create alt text for all images to improve document accessibility:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'your-doc-id',
});

const altTexts = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  prompt: 'Generate concise alt text for this image (max 125 characters).',
  model: 'gemini-1.5-flash',
  individualPrompts: true,
});
```

### 4. Compare Related Images

Analyze relationships between multiple images:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'your-doc-id',
});

// Take first 5 images for comparison
const comparison = await gerbidigm.gemini.describeImageBatch({
  images: images.slice(0, 5).map((img) => ({ url: img.contentUri })),
  prompt:
    'Compare these images and identify common themes, differences, and progression.',
  sharedContext: 'These images show the evolution of a UI design.',
  individualPrompts: false, // Keep all images in one request for comparison
});
```

### 5. Extract Data from Charts/Graphs

Pull structured data from embedded visualizations:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'quarterly-report',
});

const dataExtraction = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  prompt:
    'Extract all data points, labels, and values from this chart. Format as structured data.',
  model: 'gemini-1.5-pro',
  individualPrompts: true,
});
```

### 6. Quality Assurance

Verify that images match their surrounding text context:

```typescript
const { images } = await gerbidigm.docs.extractImages({
  documentId: 'your-doc-id',
});

// You would also need to get the surrounding text from docs.getText
const qa = await gerbidigm.gemini.describeImage({
  image: { url: images[0].contentUri },
  prompt:
    "Does this image match the description: 'System architecture diagram showing 3-tier web application'? Explain any discrepancies.",
  model: 'gemini-1.5-flash',
});
```

## Tool Details

### gerbidigm.docs.extractImages

Extract all images from a Google Doc with metadata.

**Parameters:**

- `documentId` (required): Document ID or full URL
- `tabId` (optional): Extract from specific tab only

**Returns:**

```json
{
  "images": [
    {
      "objectId": "kix.abc123",
      "contentUri": "https://lh3.googleusercontent.com/...",
      "mimeType": "image/png",
      "imageProperties": {
        "contentUri": "...",
        "sourceUri": "..."
      },
      "positioning": {
        "layout": "WRAP_TEXT",
        "leftOffset": 0,
        "topOffset": 0
      },
      "tabId": "tab-id",
      "tabTitle": "Tab Name"
    }
  ],
  "count": 1
}
```

### gerbidigm.gemini.describeImage

Analyze a single image with Gemini AI.

**Parameters:**

- `image` (required): Object with `url` or `base64` and optional `mimeType`
- `prompt` (optional): Custom analysis prompt (default: "Describe this image in
  detail.")
- `model` (optional): Model to use (default: "gemini-1.5-flash")

**Model Options:**

- `gemini-1.5-flash` - Fast and cost-effective ($0.075/1M input tokens)
- `gemini-1.5-pro` - Most capable for complex analysis ($1.25/1M input tokens)

**Returns:**

```json
{
  "description": "Detailed image description...",
  "imageUrl": "https://...",
  "model": "gemini-1.5-flash"
}
```

### gerbidigm.gemini.describeImageBatch

Analyze multiple images efficiently in batch.

**Parameters:**

- `images` (required): Array of image objects (max 50)
- `prompt` (optional): Prompt for all images
- `sharedContext` (optional): Context shared across all images
- `model` (optional): Gemini model (default: "gemini-1.5-flash")
- `individualPrompts` (optional): Process separately vs together (default:
  false)

**Strategy Recommendations:**

| Scenario                         | individualPrompts | Reason                         |
| -------------------------------- | ----------------- | ------------------------------ |
| Detailed individual descriptions | `true`            | Each image gets full attention |
| Quick summaries                  | `false`           | Single API call, faster        |
| Comparing images                 | `false`           | Model sees all images together |
| Diverse images                   | `true`            | Prevent cross-contamination    |
| Alt text generation              | `true`            | Independent descriptions       |

**Returns:**

```json
{
  "results": [
    {
      "description": "Image 1 description...",
      "imageUrl": "https://...",
      "model": "gemini-1.5-flash"
    }
  ],
  "totalImages": 5,
  "successCount": 5,
  "errorCount": 0
}
```

## Performance & Cost Optimization

### Batch Size Recommendations

- **1-5 images**: Use `describeImage` or small batch
- **6-20 images**: Use `describeImageBatch` with `individualPrompts: true`
- **21-50 images**: Consider splitting into multiple batches of 10-15
- **50+ images**: Process in chunks with delays to respect rate limits

### Model Selection

**Use gemini-1.5-flash when:**

- Generating alt text or simple descriptions
- Processing many images (cost-effective)
- Speed is important
- Images are straightforward (photos, simple diagrams)

**Use gemini-1.5-pro when:**

- Analyzing complex technical diagrams
- Extracting detailed data from charts
- Requiring deep reasoning about image content
- Accuracy is more important than cost

### Cost Examples (100 images)

**Scenario 1: Alt text generation**

- Model: Flash
- Tokens: ~25,800 input + ~25,000 output
- Cost: **~$0.01** ✨

**Scenario 2: Technical diagram analysis**

- Model: Pro
- Tokens: ~25,800 input + ~100,000 output (detailed explanations)
- Cost: **~$0.53**

**Scenario 3: Mixed approach**

- Flash for simple images (80): ~$0.008
- Pro for complex diagrams (20): ~$0.11
- Total: **~$0.12** (saves 77% vs all-Pro)

## Rate Limits

**Free Tier:**

- 15 requests/minute
- 1 million tokens/day
- 1,500 requests/day

**Paid Tier:**

- 360 requests/minute
- No daily token limit
- Higher throughput

**Strategy:**

- Use batching to stay within request limits
- Process 10 images per batch = 150 images/min (free tier)
- Add delays between batches if hitting limits

## Error Handling

```typescript
const result = await gerbidigm.gemini.describeImageBatch({
  images: imageArray,
  individualPrompts: true,
});

// Check for errors
result.results.forEach((r, i) => {
  if (r.error) {
    console.error(`Image ${i} failed: ${r.error}`);
  } else {
    console.log(`Image ${i}: ${r.description}`);
  }
});
```

## Common Patterns

### Pattern 1: Progressive Enhancement

Extract images, then analyze only the important ones:

```typescript
// 1. Get all images
const { images } = await gerbidigm.docs.extractImages({ documentId });

// 2. Quick scan of all images
const quickScan = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  prompt:
    'In 1-2 words, what type of image is this? (diagram/photo/chart/screenshot/other)',
  model: 'gemini-1.5-flash',
  individualPrompts: false,
});

// 3. Deep analysis of diagrams only
const diagrams = images.filter((img, i) =>
  quickScan.results[i].description.toLowerCase().includes('diagram'),
);

const detailedAnalysis = await gerbidigm.gemini.describeImageBatch({
  images: diagrams.map((img) => ({ url: img.contentUri })),
  prompt: 'Provide detailed technical analysis of this diagram...',
  model: 'gemini-1.5-pro',
  individualPrompts: true,
});
```

### Pattern 2: Contextual Analysis

Use document text to inform image analysis:

```typescript
// 1. Get document text and images
const text = await docs.getText({ documentId });
const { images } = await gerbidigm.docs.extractImages({ documentId });

// 2. Analyze images with document context
const analysis = await gerbidigm.gemini.describeImageBatch({
  images: images.map((img) => ({ url: img.contentUri })),
  sharedContext: `Document context: ${text.slice(0, 1000)}...`,
  prompt: 'Describe this image in the context of the document.',
  model: 'gemini-1.5-flash',
});
```

## Troubleshooting

**Error: "Gemini API not initialized"**

- Set `GEMINI_API_KEY` environment variable
- Restart the MCP server after setting the variable

**Error: "Failed to fetch image"**

- Check that the contentUri is publicly accessible
- Google Docs images may require authentication
- Try downloading and passing as base64 instead

**Error: "Maximum 50 images per batch request"**

- Split large batches into chunks of 50 or fewer
- Process chunks sequentially or with limited parallelism

**Rate limit errors:**

- Add delays between batch requests
- Reduce batch size
- Upgrade to paid tier for higher limits

**Poor quality descriptions:**

- Try more specific prompts
- Switch to gemini-1.5-pro for complex images
- Use `individualPrompts: true` for better focus

## Advanced: Custom Workflows

### Multi-Tab Document Analysis

```typescript
// Get all tabs
const doc = await docs.getText({ documentId });
const tabs = JSON.parse(doc); // If multi-tab, returns array

// Extract and analyze images per tab
for (const tab of tabs) {
  const { images } = await gerbidigm.docs.extractImages({
    documentId,
    tabId: tab.tabId,
  });

  const analysis = await gerbidigm.gemini.describeImageBatch({
    images: images.map((img) => ({ url: img.contentUri })),
    sharedContext: `Tab: ${tab.title}`,
    prompt: 'Analyze this image in the context of the tab.',
    model: 'gemini-1.5-flash',
  });

  console.log(`Tab "${tab.title}": ${images.length} images analyzed`);
}
```

## Related Skills

- **gmail-fetch.md** - Flexible Gmail fetching with field masks
- **docs-processing.md** - General Google Docs workflows

## API References

- [Google Docs API - Positioned Objects](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents#DocumentTab.FIELDS.positioned_objects)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini API Pricing](https://ai.google.dev/pricing)
