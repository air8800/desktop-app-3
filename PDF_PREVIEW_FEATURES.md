# Enhanced PDF Preview Features

## Overview

The PDF preview component has been completely redesigned to provide real-time, accurate visualization of print settings. Users can now see exactly how their documents will print before sending them to the printer.

## Key Features

### 1. High-Quality Rendering

- **High-DPI Support**: Automatically scales rendering based on device pixel ratio for crisp, clear previews on all displays
- **Anti-Aliasing**: Smooth text and graphics rendering with high-quality image smoothing
- **Progressive Loading**: Fast initial render with enhancement as resources load
- **Zoom Quality**: Content maintains quality at all zoom levels (30% to 300%)

### 2. Real-Time Settings Preview

The preview updates instantly when any print setting changes:

- **Paper Size**: Visual boundaries showing A3, A4, A5, Letter, Legal, and Executive sizes
- **Color Mode**: Real-time grayscale conversion when B&W mode is selected
- **N-up Layout**: Shows actual page arrangement for 1-up, 2-up, 4-up, and 9-up layouts
- **Print Type**: Visual indicators for single vs double-sided printing
- **Orientation**: Dynamic layout rotation for portrait and landscape N-up orientations

### 3. N-up Layout Visualization

**Supported Layouts:**
- **1-up**: Traditional one page per sheet
- **2-up**: Two pages side-by-side (2x1 grid)
- **4-up**: Four pages in a 2x2 grid
- **9-up**: Nine pages in a 3x3 grid

**N-up Features:**
- Proper margins and gaps between pages
- Page borders showing individual page boundaries
- Page numbers displayed on each cell
- Automatic scaling to fit pages optimally on the sheet
- Portrait and landscape orientation support

### 4. Color Mode Preview

**Black & White Mode:**
- Applies accurate luminance-based grayscale conversion
- Formula: `gray = 0.299*R + 0.587*G + 0.114*B`
- Shows exact appearance of final B&W print
- Real-time conversion (no delay)

**Color Mode:**
- Full color preview maintaining original document colors
- Accurate color representation for print output

### 5. Advanced Zoom Controls

**Zoom Methods:**
- **Zoom In/Out Buttons**: Step through zoom levels (80% and 125% increments)
- **Preset Levels**: Quick access to 50%, 75%, 100%, 125%, 150%, 200%, 300%
- **Reset Button**: One-click return to optimal fit-to-page view
- **Percentage Display**: Shows current zoom level relative to optimal scale

**Zoom Behavior:**
- Zooms the actual PDF content, not just the viewport
- Maintains aspect ratio and quality at all levels
- High-DPI rendering ensures sharpness when zoomed in
- Canvas resolution scales with zoom for crystal-clear text

### 6. Visual Indicators

**Settings Badges:**
Colored badges overlay the preview showing:
- Paper size (blue)
- Color mode (gray for B&W, green for Color)
- Print type (purple for Duplex, Simplex)
- N-up layout (red, e.g., "2-up", "4-up")
- Copy count (orange, e.g., "5x")

**Paper Boundaries:**
- Dashed blue outline showing paper edges
- Paper size label displayed at top
- Margin guidelines (gray dashed lines)
- Safe print area indication

### 7. Performance Optimizations

- **Debounced Updates**: Settings changes trigger preview refresh after brief delay
- **Canvas Caching**: Rendered pages cached for instant zoom response
- **Progressive Rendering**: Complex layouts render progressively for better UX
- **Loading Indicators**: Shows "Updating preview..." during re-renders
- **Error Recovery**: Graceful fallback if rendering fails

## Technical Implementation

### PDF Transformations (`pdfTransformations.ts`)

**Key Functions:**

1. `renderHighQualityPdfPage()` - High-DPI rendering with device pixel ratio scaling
2. `renderNupPreview()` - Complete N-up layout rendering with margins and gaps
3. `applyGrayscaleFilter()` - Accurate luminance-based B&W conversion
4. `calculateNupLayout()` - Grid calculations for any N-up configuration
5. `drawSettingsIndicators()` - Overlay badges showing active settings
6. `calculateNupOptimalScale()` - Scale calculation for N-up layouts

### Paper Sizes

Supported paper sizes with exact dimensions in points (1 point = 1/72 inch):

```typescript
A3: { width: 842, height: 1191 }      // 297 × 420 mm
A4: { width: 595, height: 842 }       // 210 × 297 mm
A5: { width: 420, height: 595 }       // 148 × 210 mm
Letter: { width: 612, height: 792 }   // 8.5 × 11 inches
Legal: { width: 612, height: 1008 }   // 8.5 × 14 inches
Executive: { width: 522, height: 756 } // 7.25 × 10.5 inches
```

### Rendering Pipeline

1. **Load PDF**: PDF.js loads document with proper CMap configuration
2. **Calculate Layout**: Determine optimal scale based on container and N-up settings
3. **Render Content**:
   - For 1-up: Single high-quality page render
   - For N-up: Grid-based multi-page layout with borders
4. **Apply Filters**: Grayscale conversion if B&W mode selected
5. **Add Overlays**: Settings badges and paper boundaries
6. **Display**: Canvas updated with final rendered output

## Usage Example

```tsx
<PdfPreview
  fileUrl="/path/to/document.pdf"
  jobData={{
    paper_size: 'A4',
    copies: 2,
    color_mode: 'BW',
    print_type: 'Double',
    pages_per_sheet: 4,
    nup_orientation: 'landscape'
  }}
  onPrint={handlePrint}
  onClose={handleClose}
/>
```

## User Interface

### Print Settings Panel

Located on the right side of the preview, includes:

1. **Printer Selection**: Dropdown with available printers
2. **Paper Size**: Selection from standard sizes
3. **Layout (N-up)**: Buttons for 1-up, 2-up, 4-up, 9-up
4. **N-up Orientation**: Portrait/Landscape toggle (shown when N-up > 1)
5. **Copies**: Numeric input for copy count
6. **Color Mode**: B&W / Color toggle buttons
7. **Print Type**: Single / Double sided toggle buttons
8. **Print Button**: Shows current settings (e.g., "Print 4-up (BW)")

### Preview Area

- **Canvas**: Rendered PDF with all transformations applied
- **Loading Indicator**: Shows when preview is updating
- **Zoom Controls**: Top toolbar with +/- and percentage display
- **Page Navigation**: Previous/Next buttons and page counter
- **Settings Badges**: Colored overlays showing active options

## Benefits

1. **Accuracy**: Users see exactly what will print - no surprises
2. **Confidence**: Visual confirmation of settings before printing
3. **Efficiency**: Catch errors before wasting paper and ink
4. **Professional**: High-quality preview reflects professional software
5. **Intuitive**: Real-time updates make settings changes immediately clear

## Future Enhancements

Potential future improvements:

- [ ] Pan/drag when zoomed in for navigation
- [ ] Minimap for large documents
- [ ] Side-by-side comparison of different settings
- [ ] Print cost estimation overlay
- [ ] Duplex page flow visualization (front/back)
- [ ] Page range selection with preview
- [ ] Thumbnail strip for multi-page documents
- [ ] Print preview history and favorites
- [ ] Export settings as templates

## Browser Compatibility

- **Chrome/Edge**: Full support with WebGL acceleration
- **Firefox**: Full support with high-quality rendering
- **Safari**: Full support on macOS and iOS
- **Electron**: Optimized for desktop app environment

## Performance Notes

- Rendering time scales with document complexity
- N-up layouts require more processing (rendering multiple pages)
- High-DPI displays use more memory for quality
- Typical render time: 100-500ms per update
- Canvas size limits: ~16384x16384 pixels (browser dependent)

---

**Last Updated**: October 6, 2025
**Version**: 2.0
**Module**: `src/components/PdfPreview.tsx` + `src/utils/pdfTransformations.ts`
