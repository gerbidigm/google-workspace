# Google Docs Image Insertion - Complete Guide

## Overview

This skill provides comprehensive guidance for creating Google Docs with images
using three powerful Gerbidigm tools:

1. **`gerbidigm.drive.uploadImage`** - Upload local images to Google Drive
2. **`gerbidigm.docs.insertImage`** - Insert images into existing documents
3. **`gerbidigm.docs.createWithImages`** - Create new documents with mixed
   text/image content

## Quick Start

### Simple Workflow: Create Doc with Images

```typescript
// Step 1: Upload a local image to Drive
const uploadResult = await gerbidigm.drive.uploadImage({
  localPath: '/Users/charlie/Desktop/diagram.png',
  makePublic: true, // Required for insertion into docs
});

// Step 2: Create a document with the image
await gerbidigm.docs.createWithImages({
  title: 'Project Report',
  content: [
    { type: 'text', text: '# Executive Summary\n\n' },
    { type: 'text', text: 'Architecture overview:\n\n' },
    {
      type: 'image',
      driveFileId: uploadResult.fileId,
      width: 500, // Optional: 500 points = ~7 inches
    },
    { type: 'text', text: '\n\nThe diagram above shows...' },
  ],
});
```

## Tool 1: `gerbidigm.drive.uploadImage`

### Purpose

Upload local image files to Google Drive to make them available for document
insertion.

### Parameters

| Parameter    | Type    | Required | Description                                                 |
| ------------ | ------- | -------- | ----------------------------------------------------------- |
| `localPath`  | string  | ✅       | Absolute path to image file (e.g., "/Users/name/photo.png") |
| `name`       | string  | ⬜       | Custom filename in Drive (defaults to original filename)    |
| `folderId`   | string  | ⬜       | Drive folder ID to upload to (defaults to root)             |
| `makePublic` | boolean | ⬜       | Make viewable by anyone with link (default: false)          |

### Supported Formats

- **PNG** - `.png` (image/png)
- **JPEG** - `.jpg`, `.jpeg` (image/jpeg)
- **GIF** - `.gif` (image/gif)
- **SVG** - `.svg` (image/svg+xml)

### Size Limit

- Maximum: **50MB** per image
- Google Docs limit: 50MB per embedded image

### Return Value

```json
{
  "fileId": "1ABC123...",
  "name": "diagram.png",
  "mimeType": "image/png",
  "size": "245678",
  "webViewLink": "https://drive.google.com/file/d/1ABC123...",
  "contentLink": "https://drive.google.com/uc?id=1ABC123..."
}
```

**Key Fields:**

- `fileId` - Use with `docs.insertImage` `driveFileId` parameter
- `contentLink` - Direct content URL (use with `imageUri` parameter)

### Best Practices

#### 1. Always Set `makePublic: true` for Doc Insertion

```typescript
// ✅ CORRECT - Image will be visible in docs
await gerbidigm.drive.uploadImage({
  localPath: '/path/to/image.png',
  makePublic: true, // Required for embedding
});

// ❌ WRONG - Image may not display in doc
await gerbidigm.drive.uploadImage({
  localPath: '/path/to/image.png',
  // makePublic defaults to false
});
```

#### 2. Organize with Folders

```typescript
// Create a folder for project images
const folder = await drive.createFolder({
  name: 'Project Images',
});

// Upload images to that folder
await gerbidigm.drive.uploadImage({
  localPath: '/path/to/image.png',
  folderId: folder.id,
  makePublic: true,
});
```

#### 3. Validate File Exists Before Upload

```typescript
// Always verify the path exists
const imagePath = '/Users/charlie/Desktop/photo.jpg';

// If path doesn't exist, you'll get:
// Error: File not found: /Users/charlie/Desktop/photo.jpg
```

## Tool 2: `gerbidigm.docs.insertImage`

### Purpose

Insert an image into an existing Google Doc at a specific position.

### Parameters

| Parameter     | Type           | Required | Description                                                    |
| ------------- | -------------- | -------- | -------------------------------------------------------------- |
| `documentId`  | string         | ✅       | Document ID or full URL                                        |
| `imageUri`    | string         | ⬜\*     | Public URL of image to insert                                  |
| `driveFileId` | string         | ⬜\*     | Google Drive file ID (alternative to imageUri)                 |
| `position`    | string\|number | ⬜       | Where to insert: "beginning", "end", or index (default: "end") |
| `width`       | number         | ⬜       | Width in points (72 points = 1 inch)                           |
| `height`      | number         | ⬜       | Height in points                                               |
| `tabId`       | string         | ⬜       | Tab ID for multi-tab documents                                 |

\* **Must provide either `imageUri` OR `driveFileId`, not both**

### Image Source Options

#### Option 1: Public URL (`imageUri`)

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  position: 'end',
});
```

**Requirements:**

- URL must be publicly accessible (no authentication)
- Must use HTTPS (not HTTP)
- Supports: PNG, JPEG, GIF, SVG

#### Option 2: Drive File ID (`driveFileId`)

```typescript
// Upload first
const upload = await gerbidigm.drive.uploadImage({
  localPath: '/path/to/image.png',
  makePublic: true,
});

// Then insert
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  driveFileId: upload.fileId, // Use the fileId from upload
});
```

**Automatic Conversion:**

- `driveFileId: "1ABC..."` → `https://drive.google.com/uc?id=1ABC...`
- The tool handles URL construction automatically

### Position Parameter - DETAILED EXPLANATION

Google Docs uses **1-based character indexing** to track content positions.

#### Position Types

##### 1. `"beginning"` - Insert at Start

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/logo.png',
  position: 'beginning', // Inserts at index 1
});
```

**Behavior:**

- Inserts at index 1 (immediately after document title)
- Pushes all existing content down

**Use Cases:**

- Logo at top of document
- Header images
- Banner graphics

##### 2. `"end"` - Insert at End (Default)

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  position: 'end', // Default behavior
});
```

**Behavior:**

- Automatically finds document's end index
- Reads document to locate last element
- Inserts at `endIndex - 1` (before final newline)

**Use Cases:**

- Append images to existing content
- Add supporting visuals at document end

##### 3. Numeric Index - Precise Placement

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/chart.png',
  position: 42, // Insert at specific index
});
```

**Behavior:**

- Inserts at exact character position
- Index must be >= 1
- Tool validates index range

**Use Cases:**

- Insert after specific paragraph
- Place image between known content blocks
- Programmatic content insertion

### Understanding Document Indices

#### How Indices Work

A document's content is indexed character-by-character:

```text
Document: "Hello\n\nWorld\n"

Index:  1234567 8 9101112
Chars:  H e l l o \n \n W o r l d \n
```

**Key Points:**

1. **1-based**: Index 1 is the first character
2. **Newlines count**: `\n` occupies one index
3. **Images occupy 1 index**: An embedded image = 1 character position

#### Calculating Indices Example

If you create a doc with this content:

```
Project Update\n\nStatus: Complete\n
```

Then indices are:

- Index 1-14: "Project Update"
- Index 15: First newline
- Index 16: Second newline
- Index 17-32: "Status: Complete"
- Index 33: Final newline

To insert an image after "Project Update" and before "Status":

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/image.png',
  position: 16, // After second newline, before "Status"
});
```

#### Multi-Step Insertion Strategy

When you need to insert at a specific location:

**Step 1: Read the document**

```typescript
const content = await docs.getText({ documentId: '1ABC...' });
// Examine content to determine insertion point
```

**Step 2: Calculate index**

```typescript
// If you want to insert after "Summary" section:
const summaryEnd = content.indexOf('Summary') + 'Summary'.length;
```

**Step 3: Insert image**

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/chart.png',
  position: summaryEnd + 2, // After "Summary" + newlines
});
```

### Image Sizing

#### Understanding Points

- **72 points = 1 inch**
- **1 point = 1/72 inch**
- Standard US Letter: 612 points wide (8.5 inches)
- Typical margins: ~72 points each side
- Usable width: ~468 points (6.5 inches)

#### Size Parameter Behavior

##### No Size Specified (Default)

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  // No width/height specified
});
```

- Google Docs uses **original image dimensions**
- May exceed page width
- Image maintains aspect ratio

##### Width Only

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  width: 400, // Height auto-calculated
});
```

- Sets width to 400 points (~5.5 inches)
- Height scales proportionally
- Preserves aspect ratio

##### Height Only

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  height: 300, // Width auto-calculated
});
```

- Sets height to 300 points (~4.2 inches)
- Width scales proportionally
- Preserves aspect ratio

##### Both Width and Height

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/photo.jpg',
  width: 400,
  height: 300,
});
```

- Forces exact dimensions
- **May distort image** if aspect ratio doesn't match
- Use carefully

#### Recommended Sizes

| Use Case         | Width    | Notes                      |
| ---------------- | -------- | -------------------------- |
| Full-width image | 468pt    | 6.5" with standard margins |
| Large diagram    | 400pt    | 5.5" - good for charts     |
| Medium photo     | 300pt    | 4.2" - balanced size       |
| Small icon/logo  | 72-144pt | 1-2 inches                 |
| Thumbnail        | 50pt     | 0.7" - inline with text    |

### Multi-Tab Document Support

For documents with multiple tabs:

```typescript
// Get document to find tab IDs
const doc = await docs.getText({ documentId: '1ABC...' });
// If multi-tab, doc contains: [{ tabId: "xyz", title: "Section 1", ... }]

// Insert into specific tab
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: 'https://example.com/image.png',
  tabId: 'xyz', // Insert into "Section 1" tab
  position: 'end',
});
```

### Return Value

```json
{
  "documentId": "1ABC123...",
  "imageUri": "https://drive.google.com/uc?id=1XYZ...",
  "insertedAt": 42,
  "success": true
}
```

## Tool 3: `gerbidigm.docs.createWithImages`

### Purpose

Create a new Google Doc with mixed text and image content in a **single atomic
operation**.

### Parameters

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `title`   | string | ✅       | Document title                  |
| `content` | array  | ✅       | Array of text blocks and images |

### Content Array Structure

The `content` array can contain two types of objects:

#### Text Block

```typescript
{
  type: "text",
  text: string  // Can include newlines, formatting
}
```

#### Image Block

```typescript
{
  type: "image",
  uri?: string,         // Public URL (Option 1)
  driveFileId?: string, // Drive file ID (Option 2)
  width?: number,       // Optional width in points
  height?: number       // Optional height in points
}
```

**Must provide either `uri` OR `driveFileId`, not both**

### Complete Example

```typescript
// Upload images first
const diagram = await gerbidigm.drive.uploadImage({
  localPath: '/Users/charlie/architecture.png',
  makePublic: true,
});

const chart = await gerbidigm.drive.uploadImage({
  localPath: '/Users/charlie/metrics.png',
  makePublic: true,
});

// Create document with mixed content
const result = await gerbidigm.docs.createWithImages({
  title: 'Q4 Engineering Report',
  content: [
    {
      type: 'text',
      text: '# Q4 Engineering Report\n\n',
    },
    {
      type: 'text',
      text: '## Architecture Overview\n\nOur system architecture:\n\n',
    },
    {
      type: 'image',
      driveFileId: diagram.fileId,
      width: 468, // Full width
    },
    {
      type: 'text',
      text: '\n\n## Performance Metrics\n\nKey metrics for Q4:\n\n',
    },
    {
      type: 'image',
      driveFileId: chart.fileId,
      width: 400,
    },
    {
      type: 'text',
      text: '\n\n## Conclusion\n\nExcellent progress this quarter.',
    },
  ],
});

// Returns:
// {
//   "documentId": "1ABC...",
//   "title": "Q4 Engineering Report",
//   "contentItems": 6,
//   "webViewLink": "https://docs.google.com/document/d/1ABC.../edit"
// }
```

### How Content Sequencing Works

The tool automatically manages character indices:

1. **Document created** at index 1
2. **Each text block**:
   - Inserted at `currentIndex`
   - `currentIndex` advances by `text.length`
3. **Each image**:
   - Inserted at `currentIndex`
   - `currentIndex` advances by 1 (images = 1 character)

**Example:**

```typescript
content: [
  { type: 'text', text: 'Hello\n' }, // Indices 1-6 (6 chars)
  { type: 'image', uri: '...' }, // Index 7 (1 char)
  { type: 'text', text: 'World' }, // Indices 8-12 (5 chars)
];
```

### Best Practices

#### 1. Add Newlines Around Images

```typescript
// ✅ GOOD - Images have breathing room
content: [
  { type: 'text', text: 'See diagram below:\n\n' },
  { type: 'image', uri: '...', width: 400 },
  { type: 'text', text: '\n\nAs shown above...' },
];

// ❌ BAD - Image crammed with text
content: [
  { type: 'text', text: 'See diagram below:' },
  { type: 'image', uri: '...' },
  { type: 'text', text: 'As shown above...' },
];
```

#### 2. Use Consistent Sizing

```typescript
// Define standard sizes
const FULL_WIDTH = 468;
const LARGE = 400;
const MEDIUM = 300;

content: [
  { type: 'image', uri: '...', width: FULL_WIDTH },
  { type: 'text', text: '...' },
  { type: 'image', uri: '...', width: FULL_WIDTH },
];
```

#### 3. Upload All Images First

```typescript
// ✅ GOOD - Upload batch, then create doc
const [img1, img2, img3] = await Promise.all([
  gerbidigm.drive.uploadImage({ localPath: '...', makePublic: true }),
  gerbidigm.drive.uploadImage({ localPath: '...', makePublic: true }),
  gerbidigm.drive.uploadImage({ localPath: '...', makePublic: true }),
]);

await gerbidigm.docs.createWithImages({
  title: 'Report',
  content: [
    { type: 'image', driveFileId: img1.fileId },
    { type: 'image', driveFileId: img2.fileId },
    { type: 'image', driveFileId: img3.fileId },
  ],
});
```

## Common Workflows

### Workflow 1: Single Image Doc

**Use Case:** Create a doc with one explanatory image

```typescript
// Step 1: Upload
const upload = await gerbidigm.drive.uploadImage({
  localPath: '/Users/charlie/diagram.png',
  makePublic: true,
});

// Step 2: Create doc
await gerbidigm.docs.createWithImages({
  title: 'Architecture Diagram',
  content: [
    { type: 'text', text: '# System Architecture\n\n' },
    { type: 'image', driveFileId: upload.fileId, width: 468 },
  ],
});
```

### Workflow 2: Report with Multiple Images

**Use Case:** Quarterly report with charts and diagrams

```typescript
// Step 1: Upload all images
const images = await Promise.all(
  [
    '/path/to/revenue.png',
    '/path/to/users.png',
    '/path/to/architecture.png',
  ].map((path) =>
    gerbidigm.drive.uploadImage({
      localPath: path,
      makePublic: true,
    }),
  ),
);

// Step 2: Create report
await gerbidigm.docs.createWithImages({
  title: 'Q4 2024 Report',
  content: [
    { type: 'text', text: '# Q4 2024 Report\n\n## Financial Metrics\n\n' },
    { type: 'image', driveFileId: images[0].fileId, width: 400 },
    { type: 'text', text: '\n\n## User Growth\n\n' },
    { type: 'image', driveFileId: images[1].fileId, width: 400 },
    { type: 'text', text: '\n\n## Technical Updates\n\n' },
    { type: 'image', driveFileId: images[2].fileId, width: 468 },
  ],
});
```

### Workflow 3: Add Image to Existing Doc

**Use Case:** Insert screenshot into meeting notes

```typescript
// Upload screenshot
const screenshot = await gerbidigm.drive.uploadImage({
  localPath: '/Users/charlie/Desktop/Screenshot 2024-03-14.png',
  name: 'Meeting Screenshot.png',
  makePublic: true,
});

// Insert at end of existing doc
await gerbidigm.docs.insertImage({
  documentId: '1ABC...', // Existing meeting notes
  driveFileId: screenshot.fileId,
  position: 'end',
  width: 468,
});
```

### Workflow 4: Image Gallery Document

**Use Case:** Create a document showcasing multiple images

```typescript
// Upload images from directory
const imagePaths = [
  '/Users/charlie/Photos/photo1.jpg',
  '/Users/charlie/Photos/photo2.jpg',
  '/Users/charlie/Photos/photo3.jpg',
  '/Users/charlie/Photos/photo4.jpg',
];

const uploads = await Promise.all(
  imagePaths.map((path) =>
    gerbidigm.drive.uploadImage({
      localPath: path,
      makePublic: true,
    }),
  ),
);

// Create gallery doc
const content = [{ type: 'text', text: '# Photo Gallery\n\n' }];

uploads.forEach((upload, i) => {
  content.push(
    { type: 'text', text: `## Photo ${i + 1}\n\n` },
    { type: 'image', driveFileId: upload.fileId, width: 400 },
    { type: 'text', text: '\n\n' },
  );
});

await gerbidigm.docs.createWithImages({
  title: 'Photo Gallery',
  content,
});
```

### Workflow 5: Technical Documentation

**Use Case:** API documentation with code and diagrams

```typescript
// Upload diagrams
const [flowchart, sequence] = await Promise.all([
  gerbidigm.drive.uploadImage({
    localPath: '/docs/api-flow.png',
    makePublic: true,
  }),
  gerbidigm.drive.uploadImage({
    localPath: '/docs/sequence.png',
    makePublic: true,
  }),
]);

// Create technical doc
const doc = await gerbidigm.docs.createWithImages({
  title: 'API Documentation',
  content: [
    { type: 'text', text: '# API Documentation\n\n## Authentication Flow\n\n' },
    { type: 'text', text: 'The authentication process:\n\n' },
    { type: 'image', driveFileId: flowchart.fileId, width: 468 },
    { type: 'text', text: '\n\n## Request Sequence\n\n' },
    { type: 'text', text: 'API call sequence:\n\n' },
    { type: 'image', driveFileId: sequence.fileId, width: 468 },
  ],
});

// Apply formatting
await docs.formatText({
  documentId: doc.documentId,
  formats: [
    { startIndex: 1, endIndex: 18, style: 'heading1' },
    { startIndex: 20, endIndex: 41, style: 'heading2' },
  ],
});
```

## Error Handling

### Common Errors

#### 1. File Not Found

```
Error: File not found: /Users/charlie/image.png
```

**Solution:** Verify file path is correct and file exists

#### 2. Both imageUri and driveFileId Provided

```
Error: Cannot provide both imageUri and driveFileId. Please provide only one.
```

**Solution:** Choose one image source method

#### 3. Neither imageUri nor driveFileId Provided

```
Error: Either imageUri or driveFileId must be provided
```

**Solution:** Specify at least one image source

#### 4. Invalid Position Index

```
Error: Position index must be >= 1
```

**Solution:** Use index >= 1 or "beginning"/"end"

#### 5. Unsupported File Format

```
Error: Unsupported file extension: .bmp. Supported: .png, .jpg, .jpeg, .gif, .svg
```

**Solution:** Convert image to supported format

#### 6. File Too Large

```
Error: File size 52428800 bytes exceeds maximum allowed size of 52428800 bytes (50MB)
```

**Solution:** Compress or resize image

## Performance Tips

### 1. Batch Upload Images

```typescript
// ✅ GOOD - Parallel uploads
const uploads = await Promise.all([
  gerbidigm.drive.uploadImage({ localPath: 'img1.png', makePublic: true }),
  gerbidigm.drive.uploadImage({ localPath: 'img2.png', makePublic: true }),
]);

// ❌ SLOW - Sequential uploads
const upload1 = await gerbidigm.drive.uploadImage({ localPath: 'img1.png' });
const upload2 = await gerbidigm.drive.uploadImage({ localPath: 'img2.png' });
```

### 2. Use createWithImages for New Docs

```typescript
// ✅ GOOD - Single API call
await gerbidigm.docs.createWithImages({
  title: 'Report',
  content: [
    { type: 'text', text: '...' },
    { type: 'image', uri: '...' },
  ],
});

// ❌ SLOW - Multiple API calls
const doc = await docs.create({ title: 'Report' });
await docs.writeText({ documentId: doc.id, text: '...' });
await gerbidigm.docs.insertImage({ documentId: doc.id, uri: '...' });
```

### 3. Optimize Image Sizes Before Upload

```typescript
// Pre-process images to reduce upload time
// Use tools like ImageMagick, sharp, or Pillow

// Example dimensions that work well:
// - Screenshots: 1280x720 or 1920x1080
// - Diagrams: 2000px wide max
// - Photos: 1600px wide max
```

## Security Considerations

### Making Images Public

When you set `makePublic: true`:

- **Anyone with the link** can view the image
- Link is not guessable but not secret
- Image appears in Google search if indexed

**Best Practice:**

- Use `makePublic: true` only for documents you'll share
- For private docs, consider alternative authentication

### Alternative: Domain-Restricted Sharing

```typescript
// Instead of makePublic, restrict to domain
const upload = await gerbidigm.drive.uploadImage({
  localPath: '/path/to/sensitive.png',
  makePublic: false, // Keep private
});

// Then use Drive API to share with specific domain
await drive.permissions.create({
  fileId: upload.fileId,
  requestBody: {
    role: 'reader',
    type: 'domain',
    domain: 'yourcompany.com',
  },
});
```

## Troubleshooting

### Images Not Displaying

**Symptom:** Image appears as broken link icon in document

**Causes:**

1. Image not public: Set `makePublic: true` when uploading
2. Invalid URL: Verify URL is accessible
3. Drive file deleted: Check file still exists in Drive

**Solution:**

```typescript
// Re-upload with makePublic
const upload = await gerbidigm.drive.uploadImage({
  localPath: '/path/to/image.png',
  makePublic: true, // ← This is critical
});
```

### Images Too Large/Small

**Symptom:** Image exceeds page width or appears tiny

**Solution:** Specify width explicitly

```typescript
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  imageUri: '...',
  width: 468, // Full page width with margins
});
```

### Wrong Position

**Symptom:** Image appears in wrong location

**Solution:** Use createWithImages for predictable placement, or call
`docs.getStructure` first to see element indices and pick the right position

## Advanced Patterns

### Pattern 1: Conditional Image Insertion

```typescript
// Only insert image if certain conditions met
const includeCharts = true;

const content = [{ type: 'text', text: '# Report\n\n' }];

if (includeCharts) {
  content.push(
    { type: 'text', text: '## Charts\n\n' },
    { type: 'image', uri: '...', width: 400 },
  );
}

await gerbidigm.docs.createWithImages({
  title: 'Conditional Report',
  content,
});
```

### Pattern 2: Dynamic Content Generation

```typescript
// Generate doc from data
const data = [
  { section: 'Revenue', chartPath: '/charts/revenue.png' },
  { section: 'Users', chartPath: '/charts/users.png' },
  { section: 'Engagement', chartPath: '/charts/engagement.png' },
];

// Upload all charts
const uploads = await Promise.all(
  data.map((d) =>
    gerbidigm.drive.uploadImage({
      localPath: d.chartPath,
      makePublic: true,
    }),
  ),
);

// Build content array
const content = [{ type: 'text', text: '# Metrics Report\n\n' }];

data.forEach((item, i) => {
  content.push(
    { type: 'text', text: `## ${item.section}\n\n` },
    { type: 'image', driveFileId: uploads[i].fileId, width: 400 },
    { type: 'text', text: '\n\n' },
  );
});

await gerbidigm.docs.createWithImages({
  title: 'Metrics Report',
  content,
});
```

### Pattern 3: Image Replacement

```typescript
// To "replace" an image, insert new one and document the old location
// Google Docs API doesn't have direct image replacement, so:

// Option A: Insert new image, then delete old one by index
// Images occupy exactly 1 character in the document index.
// Use getStructure to find the old image's index first.
await gerbidigm.docs.insertImage({
  documentId: '1ABC...',
  driveFileId: newImageId,
  position: 42, // Index of the old image
});
// Old image is now at index 43 (shifted by the insertion).
// Delete it:
await gerbidigm.docs.deleteRange({
  documentId: '1ABC...',
  startIndex: 43,
  endIndex: 44, // images are 1 character wide
});

// Option B: Create new doc with updated images
// Better for automated workflows
```

## Summary

### Tool Selection Guide

| Scenario                   | Recommended Tool                  |
| -------------------------- | --------------------------------- |
| Create new doc with images | `createWithImages`                |
| Add to existing doc        | `insertImage`                     |
| Upload local image first   | `drive.uploadImage`               |
| Multiple images, new doc   | `createWithImages`                |
| Single image, existing doc | `insertImage`                     |
| Complex layout             | `createWithImages` + `formatText` |

### Key Takeaways

1. **Always upload local images** with `makePublic: true` for doc insertion
2. **Use createWithImages** for new documents with known content
3. **Specify width** to ensure consistent sizing
4. **Add newlines** around images for visual spacing
5. **Batch uploads** for better performance
6. **Images occupy 1 character** in document index

### Next Steps

1. Try creating a simple doc with one image
2. Experiment with `createWithImages` for complex layouts
3. Combine with `docs.formatText` for professional formatting
4. Explore image analysis with `gerbidigm.docs.extractImages`
