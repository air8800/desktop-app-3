# Extra Resources for Xerox Shop Manager

This folder contains bundled executables that are packaged with the app.

## Required Files

### SumatraPDF.exe (REQUIRED for Windows)
- Download from: https://www.sumatrapdfreader.org/download-free-pdf-viewer
- Get the **Portable version** (single .exe file, ~6-10MB)
- Place `SumatraPDF.exe` in this folder

## How It Works

When you build the Electron app:
1. This folder is copied to `resources/extraResources/` in the final app
2. The Native Print Engine automatically finds SumatraPDF here
3. Users don't need to install anything separately - it's all bundled!

## Print Flow

```
PDF from Web App
      |
      v
  pdf-lib (JavaScript)
  - N-up layouts (2-up, 4-up, etc.)
  - Paper size adjustment
  - Page transformations
      |
      v
  SumatraPDF (bundled here)
  - Silent printing with -silent flag
  - No popup dialogs
      |
      v
   Printer
```

## Supported Features

- N-up layouts (1, 2, 4, 6, 9 pages per sheet)
- Paper sizes: A3, A4, A5, Letter, Legal, Executive
- Color modes: Color, Black & White
- Print types: Single-sided, Double-sided (duplex)
- Silent printing: No Windows print dialog

## License

SumatraPDF is licensed under GPLv3 (free/open source).
