; Crisp UI on 125%/150%/200% Windows display scaling (stops DWM bitmap upscale blur)
ManifestDPIAware true

; 2x bitmaps (see scripts/generate-icons.mjs) scaled down cleanly on HiDPI
!define MUI_HEADERIMAGE_BITMAP_STRETCH AspectFitHeight
!define MUI_WELCOMEFINISHPAGE_BITMAP_STRETCH AspectFitHeight
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_STRETCH AspectFitHeight
