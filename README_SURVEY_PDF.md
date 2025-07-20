# SurveyJS PDF Generator Utility

A comprehensive utility for converting SurveyJS JSON files into printable PDF documents. This utility is specifically designed for the Levante research platform to generate printable versions of surveys and assessments.

## Features

✅ **SurveyJS Compatibility**: Fully compatible with SurveyJS JSON format  
✅ **Multiple Question Types**: Supports text, radio, checkbox, dropdown, rating, comment, and more  
✅ **Customizable Layout**: Control fonts, margins, headers, footers, and styling  
✅ **Multi-page Support**: Handles both single-page and multi-page surveys  
✅ **Batch Processing**: Generate PDFs for multiple surveys at once  
✅ **TypeScript Support**: Full TypeScript integration with type safety  
✅ **Vue 3 Ready**: Includes composable and helper functions for Vue 3  
✅ **Download & Preview**: Download or preview PDFs in browser  

## Installation

The utility uses dependencies already available in your project:
- `jspdf` (already installed v2.5.1)
- `survey-core` (already installed v2.0.2)

No additional dependencies required!

## Usage

### Basic Usage with Helper Functions

```typescript
import { 
  generateSurveyPdf, 
  generateSurveyPdfFromUrl, 
  downloadPdf, 
  previewPdf 
} from '@/helpers/surveyPdfGenerator';

// Generate PDF from JSON object
const surveyJson = {
  title: "My Survey",
  elements: [
    {
      type: "text",
      name: "name",
      title: "Your Name",
      isRequired: true
    },
    {
      type: "radiogroup",
      name: "rating",
      title: "How satisfied are you?",
      choices: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"]
    }
  ]
};

const result = await generateSurveyPdf(surveyJson, {
  title: "Custom PDF Title",
  includeQuestionNumbers: true,
  fontSize: 12,
  margin: 25
});

if (result.success && result.blob && result.filename) {
  downloadPdf(result.blob, result.filename);
}
```

### Load from URL

```typescript
// Generate PDF from existing survey URLs
const result = await generateSurveyPdfFromUrl(
  'https://example.com/survey.json',
  {
    title: "Survey from URL",
    headerText: "Levante Research Platform",
    footerText: "Confidential"
  }
);

if (result.success && result.blob) {
  previewPdf(result.blob); // Opens in new tab
}
```

### Vue 3 Composable

```typescript
import useSurveyPdfGenerator from '@/composables/useSurveyPdfGenerator';

export default {
  setup() {
    const {
      isGenerating,
      progress,
      error,
      generatePdfFromJson,
      downloadPdf
    } = useSurveyPdfGenerator();

    const handleGeneratePdf = async (surveyData) => {
      const result = await generatePdfFromJson(surveyData, {
        title: "Generated Survey",
        includeQuestionNumbers: true
      });
      
      if (result.success && result.blob && result.filename) {
        downloadPdf(result.blob, result.filename);
      }
    };

    return {
      isGenerating,
      progress,
      error,
      handleGeneratePdf
    };
  }
};
```

## Configuration Options

```typescript
interface SurveyPdfOptions {
  title?: string;                    // PDF title (appears at top)
  includeQuestionNumbers?: boolean;  // Add 1., 2., 3., etc.
  includePages?: boolean;            // Show page titles for multi-page surveys
  fontSize?: number;                 // Base font size (8-16)
  margin?: number;                   // Page margins in mm (10-40)
  showChoices?: boolean;             // Display answer choices for radio/checkbox
  showDescriptions?: boolean;        // Include question descriptions
  headerText?: string;               // Text at top of each page
  footerText?: string;               // Text at bottom of each page
}
```

## Supported Question Types

| SurveyJS Type | PDF Representation |
|---------------|-------------------|
| `text` | Single-line input field |
| `comment` | Multi-line text area |
| `radiogroup` | Radio button options with ○ |
| `checkbox` | Checkbox options with ☐ |
| `dropdown` | Numbered list of options |
| `rating` | Rating scale with min/max labels |
| `boolean` | Yes/No checkboxes |
| `html` | Rendered as text content |
| `expression` | Calculated values displayed |

## Examples

### Basic Example
```typescript
import { exampleGenerateFromJson } from '@/examples/surveyPdfUsage';

// Generate a sample PDF
await exampleGenerateFromJson();
```

### Batch Processing
```typescript
import { exampleBatchProcess } from '@/examples/surveyPdfUsage';

// Generate PDFs for multiple surveys
await exampleBatchProcess();
```

### Integration with Existing Code
```typescript
// Use with existing survey loading logic
const surveyData = await fetchSurveyFromDatabase('survey-id');
const result = await generateSurveyPdf(surveyData, {
  title: surveyData.title,
  headerText: 'Levante Research Platform',
  footerText: `Generated on ${new Date().toLocaleDateString()}`
});
```

## File Structure

```
src/
├── composables/
│   └── useSurveyPdfGenerator.ts    # Vue 3 composable
├── helpers/
│   └── surveyPdfGenerator.ts       # Core helper functions
└── examples/
    └── surveyPdfUsage.ts           # Usage examples
```

## Error Handling

The utility provides comprehensive error handling:

```typescript
const result = await generateSurveyPdf(surveyJson);

if (!result.success) {
  console.error('PDF Generation failed:', result.error);
  // Handle error (show toast, log, etc.)
} else {
  console.log('PDF generated successfully:', result.filename);
  downloadPdf(result.blob!, result.filename!);
}
```

## Performance Considerations

- **Large Surveys**: For surveys with 50+ questions, consider splitting into multiple PDFs
- **Batch Processing**: Add delays between batch operations to avoid overwhelming the browser
- **File Size**: Generated PDFs are typically 50-200KB depending on survey complexity
- **Memory**: Large surveys may use significant memory during generation

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+  
- ✅ Safari 13.1+
- ✅ Edge 80+

## Integration with Existing Project Features

### With Survey Loading
```typescript
// Use with existing LEVANTE_BUCKET_URL surveys
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';

const surveyUrl = `${LEVANTE_BUCKET_URL}/child_survey.json`;
const result = await generateSurveyPdfFromUrl(surveyUrl);
```

### With Authentication
```typescript
// Add authentication headers if needed
const response = await fetch(surveyUrl, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
});
const surveyJson = await response.json();
const result = await generateSurveyPdf(surveyJson);
```

### With Vue Router
```typescript
// Generate PDF for current route's survey
import { useRoute } from 'vue-router';

const route = useRoute();
const surveyId = route.params.surveyId;
// Load survey data and generate PDF...
```

## Troubleshooting

### Common Issues

**PDF is blank or incomplete**
- Check that survey JSON is valid
- Ensure questions have proper `title` properties
- Verify question types are supported

**Large file sizes**
- Reduce font size or margins
- Consider splitting large surveys
- Remove unnecessary descriptions

**Memory issues**
- Process surveys in smaller batches
- Clear blob URLs after use
- Limit concurrent PDF generations

### Debug Mode

```typescript
// Enable detailed logging
const result = await generateSurveyPdf(surveyJson, {
  // ... options
});

console.log('Survey pages parsed:', parseSurveyJson(surveyJson));
```

## Contributing

To extend the utility:

1. **Add Question Types**: Extend the `parseQuestion` function in `surveyPdfGenerator.ts`
2. **Custom Styling**: Modify the `addQuestionToPdf` function
3. **New Features**: Add options to the `SurveyPdfOptions` interface

## License

This utility is part of the Levante research platform and follows the same licensing terms as the main project. 