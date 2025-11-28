# PDF Preview - User Guide

## Overview

The enhanced PDF preview shows you exactly how your document will print with your selected settings. Every change you make is instantly reflected in the preview.

## Visual Elements

### Settings Badges (Top-Right Corner)

Colored badges show your active print settings:

```
┌─────────────────────────────────────┐
│  [A4] [BW] [Duplex] [2-up] [5x]    │
│   ↑    ↑      ↑       ↑      ↑     │
│   │    │      │       │      │     │
│   │    │      │       │      └─ Copy count (orange)
│   │    │      │       └──────── N-up layout (red)
│   │    │      └──────────────── Print type (purple)
│   │    └─────────────────────── Color mode (gray/green)
│   └──────────────────────────── Paper size (blue)
│                                     │
│  [Preview of your PDF with all     │
│   transformations applied]          │
└─────────────────────────────────────┘
```

### Paper Boundary

Blue dashed lines show the paper edges for your selected size:

```
╔═══════════════════════════════════╗
║ A4 (210 × 297 mm)                 ║ ← Paper size label
║ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   ║
║ ┆                             ┆   ║ ← Margin guidelines
║ ┆   [Your document content]   ┆   ║
║ ┆                             ┆   ║
║ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   ║
╚═══════════════════════════════════╝
```

## Features You'll See in Action

### 1. Color Mode Preview

**Color Mode = "Color"**
```
┌──────────────┐
│ [Full color] │ ← Displays colors as they appear in PDF
│   document   │
└──────────────┘
```

**Color Mode = "B&W"**
```
┌──────────────┐
│ [Grayscale]  │ ← Automatically converts to accurate grayscale
│   document   │
└──────────────┘
```

The conversion uses the luminance formula: `gray = 0.299*R + 0.587*G + 0.114*B`

### 2. N-up Layout Preview

**1-up (Normal)**
```
┌─────────────────┐
│                 │
│   Page 1        │
│   [Full page]   │
│                 │
└─────────────────┘
```

**2-up (2 pages per sheet)**
```
┌─────────────────────┐
│  Page 1  │  Page 2  │
│  [Half]  │  [Half]  │
│          │          │
└─────────────────────┘
```

**4-up (4 pages per sheet)**
```
┌─────────────────────┐
│  Page 1  │  Page 2  │
│─────────────────────│
│  Page 3  │  Page 4  │
└─────────────────────┘
```

**9-up (9 pages per sheet)**
```
┌────────────────────────┐
│  P1  │  P2  │  P3     │
│──────────────────────  │
│  P4  │  P5  │  P6     │
│──────────────────────  │
│  P7  │  P8  │  P9     │
└────────────────────────┘
```

### 3. Orientation Change

**Portrait N-up**
```
┌──────────┐
│  P1  P2  │
│  P3  P4  │
└──────────┘
```

**Landscape N-up**
```
┌────────────────┐
│  P1  P2  P3    │
│  P4  P5  P6    │
└────────────────┘
```

## Controls Guide

### Zoom Controls (Top Toolbar)

```
[-] [100%] [+]
 ↑    ↑     ↑
 │    │     └─ Zoom in (125% per click)
 │    └─────── Current zoom (click to reset, hover for presets)
 └──────────── Zoom out (80% per click)
```

**Hover over percentage for zoom presets:**
- 50% - Half size (overview)
- 75% - Three-quarter size
- 100% - Optimal fit (default)
- 125% - Slight enlargement
- 150% - 1.5x size
- 200% - Double size
- 300% - Triple size (detail inspection)

### Print Settings Panel (Right Side)

```
┌────────────────────────┐
│  🖨️ Print Settings     │
├────────────────────────┤
│  Printer: HP LaserJet  │ ← Select your printer
│  Paper: [A4 ▼]         │ ← Choose paper size
│  Layout: [1][2][4][9]  │ ← N-up options
│  Copies: [5]           │ ← Number of copies
│  Color: [BW][Color]    │ ← Color mode toggle
│  Sides: [Single][Dual] │ ← Print type
│                        │
│  [🖨️ Print 2-up (BW)] │ ← Print button shows settings
└────────────────────────┘
```

## How It Works

### Real-Time Updates

Every change you make triggers an instant preview update:

1. **Change Paper Size** → Preview adjusts to show new paper boundaries
2. **Toggle Color Mode** → Document converts to grayscale or color
3. **Select N-up Layout** → Preview shows multi-page grid arrangement
4. **Change Orientation** → Layout rotates to portrait or landscape
5. **Adjust Zoom** → Content scales with maintained quality

### Loading Indicator

While the preview updates, you'll see:

```
┌─────────────────────────┐
│  ⟳ Updating preview...  │
└─────────────────────────┘
```

This appears briefly during:
- Initial PDF load
- Setting changes
- Page navigation
- Zoom operations

## Tips for Best Results

### 1. Check Settings Before Printing

Look at the badges to verify:
- ✓ Correct paper size selected
- ✓ Right color mode (save ink with B&W)
- ✓ Proper N-up layout for your needs
- ✓ Copy count is correct

### 2. Use Zoom for Detail Inspection

- Zoom in (150-300%) to check text clarity
- Verify images look correct at print resolution
- Check that margins are appropriate

### 3. N-up Layout Selection

**When to use each layout:**
- **1-up**: Normal documents, presentations, important papers
- **2-up**: Handouts, notes, drafts
- **4-up**: Meeting notes, reading material, proofs
- **9-up**: Reference sheets, contact lists, thumbnails

### 4. Orientation Considerations

- **Portrait N-up**: Better for standard documents, letter-sized content
- **Landscape N-up**: Better for wide content, spreadsheets, presentations

### 5. Color Mode Choice

**Use Color when:**
- Charts and graphs with colored data
- Presentations with branding
- Photos or images
- Marketing materials

**Use B&W when:**
- Text-only documents
- Drafts and proofs
- Saving on color ink
- Standard office documents

## What the Preview Shows You

✅ **Exact print output** - WYSIWYG (What You See Is What You Get)
✅ **Paper size boundaries** - See if content fits properly
✅ **Color conversion** - Accurate grayscale rendering
✅ **Multi-page layouts** - See N-up arrangement
✅ **Margins and spacing** - Proper gaps between pages
✅ **Print settings** - All active options displayed
✅ **High quality** - Crisp rendering at all zoom levels

## Common Scenarios

### Scenario 1: Printing a Report

1. Select **A4** paper size
2. Choose **Color** mode (for charts)
3. Set **1-up** layout (full page)
4. Keep **Single** sided
5. Verify: ✓ Report looks professional, charts are clear

### Scenario 2: Creating Handouts

1. Select **A4** paper size
2. Choose **B&W** mode (save ink)
3. Set **2-up** layout (two slides per page)
4. Select **Portrait** orientation
5. Set **Double** sided (save paper)
6. Verify: ✓ Two slides fit nicely, text is readable

### Scenario 3: Quick Reference Sheet

1. Select **A4** paper size
2. Choose **B&W** mode
3. Set **9-up** layout (nine pages per sheet)
4. Select **Landscape** orientation
5. Keep **Single** sided
6. Verify: ✓ All pages visible, enough detail to read

## Troubleshooting

**Preview looks blurry?**
→ Zoom in to 100% or higher - quality improves with zoom

**Settings not updating?**
→ Wait for "Updating preview..." indicator to clear

**Can't see all pages in N-up?**
→ Navigate to next page to see additional pages in the grid

**Colors look different from original?**
→ Check if B&W mode is active (convert to Color mode if needed)

**Paper boundaries don't match?**
→ Verify correct paper size is selected

## Benefits

🎯 **Confidence**: See exactly what you'll print before using paper and ink
💰 **Savings**: Catch errors before wasting resources
⚡ **Efficiency**: Adjust settings visually without test prints
✨ **Quality**: High-resolution preview ensures clarity
🔍 **Detail**: Zoom capability for close inspection
🎨 **Accuracy**: Color conversion matches actual printer output

---

**Remember**: The preview is your friend! Take a moment to verify everything looks right before hitting print. A few seconds of preview inspection can save paper, ink, and reprints.

---

*For technical details, see `PDF_PREVIEW_FEATURES.md`*
