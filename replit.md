# Xerox Shop Manager - Replit Setup

## Project Overview

**Xerox Shop Manager** is a professional print shop management application originally designed as an Electron desktop app. It has been configured to run as a web application in the Replit environment.

### Purpose
Manage print jobs with advanced PDF preview capabilities, printer management, and real-time print settings visualization.

### Key Features
- **Real-time PDF Preview**: High-quality rendering with instant updates when print settings change
- **Advanced Print Settings**: Support for various paper sizes (A3, A4, A5, Letter, Legal, Executive)
- **N-up Layouts**: 1-up, 2-up, 4-up, and 9-up page arrangements
- **Color Mode**: Real-time grayscale conversion preview for B&W printing
- **Printer Management**: Configure and manage multiple printers
- **Authentication**: Secure login with Supabase integration
- **Customer Reports**: Track print jobs and analytics

## Current State

### Environment: Web Application
The project was originally an Electron desktop application but has been adapted to run as a web application in Replit. The React/Vite frontend runs on port 5000.

### Technology Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **PDF Handling**: pdfjs-dist
- **Backend/Auth**: Supabase (requires configuration)
- **Routing**: React Router DOM

## Recent Changes (October 31, 2025)

### PDF Preview Performance & Bug Fixes ⭐
**Completely resolved rendering issues and dramatically improved performance:**

1. ✅ **Eliminated Wasted Header Space**
   - Removed modal header completely by passing `showCloseButton={false}`
   - PdfPreview component now uses full available vertical space
   - Close button still available within PdfPreview toolbar
   - Maximized viewing area for PDF content

2. ✅ **Fixed First Page Rendering Completely**
   - First page now renders **instantly** at correct scale with no double-render
   - Viewer container always rendered (even during loading) so viewerRef is available
   - Optimal scale calculated immediately in loadPdf before first render
   - Canvas initialization with white background prevents transparency artifacts
   - Transform matrix reset ensures clean rendering every time
   - No more race conditions, closure issues, or scale calculation delays
   - Canvas configured with `alpha: false` for better performance
   - Loading/error states shown as overlays instead of early returns

3. ✅ **Drastically Improved Loading Performance**
   - First page: 0ms delay for immediate display
   - Subsequent changes: 5ms debounce for smooth updates
   - PDF load retry: reduced from 1000ms to 300ms
   - Render retry: reduced from 500ms to 200ms
   - Effect-driven rendering avoids state synchronization issues
   - Significantly faster response when opening PDFs
   - **Detailed loading status**: Shows exactly what's happening (downloading, processing, calculating, preparing)
   - User always knows what the system is doing

4. ✅ **Implemented PDF Document Caching**
   - Module-level cache eliminates redundant network downloads
   - First load: Network download (same as before)
   - Subsequent views: Near-instant from memory cache
   - N-up renders: Massively faster (single download, multiple page renders)
   - 10-minute cache expiry balances memory usage with performance
   - Proper memory cleanup with pdfDocument.destroy()
   - Manual cache clearing available via clearPdfCache()

5. ✅ **Preemptive PDF Loading**
   - **Non-blocking upload**: Upload completes immediately, PDF caches in background
   - **Dashboard background loading**: All job PDFs preload while browsing dashboard
   - **Smart caching**: First preview may show loading, subsequent views are instant
   - **Fire-and-forget**: Preloading doesn't block user workflow
   - **Fast UX**: Upload feels instant, preview shows progress when needed

6. ✅ **Progressive Rendering System** 🚀 **NEW**
   - **Instant low-quality preview**: 0.4x scale at 0.5 quality renders immediately (0ms delay)
   - **Auto-enhancement**: After 50ms, automatically upgrades to full quality
   - **Clean loading UI**: Spinner and status text only (no emoji icons)
   - **Production-grade race condition prevention**:
     * Render versioning system prevents stale renders from reaching the canvas
     * 7 version checkpoints ensure outdated renders abort immediately
     * Infinite retry with exponential backoff (no dropped renders)
     * Complete deadlock prevention - lock always released on all code paths
     * Handles rapid setting changes without stuck UI or stale content
   - **Detailed progress tracking**: Loading, Processing, Calculating, Preparing stages
   - **User Experience**: Instant feedback + smooth enhancement + no flicker

### Industry-Level Security Implementation ⭐
**Enhanced authentication and data isolation to enterprise standards:**

1. ✅ **Email Verification Requirement**
   - Users must verify their email before accessing the dashboard
   - Automatic verification email sent on signup
   - Resend verification email functionality
   - Login blocked until email is confirmed

2. ✅ **Enhanced Signup Security**
   - Duplicate email detection with clear error messages
   - Duplicate phone number prevention
   - Unique constraints at database level
   - Email format validation
   - Phone number validation (minimum 10 digits)

3. ✅ **Improved Login Security**
   - Email verification status checked on login
   - Better error messages for invalid credentials
   - Rate limiting to prevent brute force attacks
   - Session management with secure tokens

4. ✅ **Row Level Security (RLS) Policies**
   - Database-level data isolation for all shop tables
   - Shop owners can only access their own data
   - RLS policies on: shops, print_jobs, printer_configs, cost_configs, profiles
   - Defense-in-depth security against application bugs

5. ✅ **Email Verification UI**
   - Clean verification screen with instructions
   - Resend verification email button
   - User-friendly error messages
   - Seamless flow back to login

### Files Modified/Created
- `src/components/PdfPreview.tsx`: Fixed rendering bugs and optimized performance
- `src/components/JobList.tsx`: Removed duplicate header from PDF preview modal
- `src/utils/pdfUtils.ts`: PDF caching system and async preloadPdf function
- `src/utils/supabase.ts`: Upload waits for PDF preload completion
- `src/pages/Dashboard.tsx`: Background PDF preloading on job load
- `src/utils/auth.ts`: Enhanced login/signup with email verification
- `src/pages/Login.tsx`: Added email verification UI and flow
- `supabase/migrations/20251006120000_add_auth_security_constraints.sql`: Email/phone uniqueness
- `supabase/migrations/20251031000000_add_row_level_security.sql`: RLS policies for data isolation

### Replit Environment Setup
1. ✅ Configured Vite to run on port 5000 with host `0.0.0.0`
2. ✅ Fixed CSS import order (Google Fonts before Tailwind directives)
3. ✅ Created `.gitignore` with Node.js and Replit-specific exclusions
4. ✅ Configured workflow to run Vite dev server
5. ✅ Set up deployment configuration for autoscale production deployment

## Project Architecture

### Directory Structure
```
├── src/
│   ├── components/      # React components (JobList, PdfPreview, PrinterConfig, etc.)
│   ├── context/         # React context (ThemeContext)
│   ├── data/            # Mock data
│   ├── pages/           # Page components (Dashboard, Login, Printers, Settings)
│   ├── utils/           # Utilities (auth, PDF utils, Supabase, file utils)
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── electron/            # Electron-specific code (not used in web version)
├── supabase/            # Database migrations
├── dist/                # Build output
└── public/              # Static assets
```

### Key Components
- **PdfPreview**: Advanced PDF rendering with real-time settings preview
- **PrinterConfig**: Printer management and configuration
- **JobList**: Print job tracking with drag-and-drop
- **Authentication**: Industry-level login/signup with email verification and RLS

### Security Architecture
**Industry-Level Multi-Tenant Security:**
- **Email Verification**: Mandatory email confirmation before dashboard access
- **Duplicate Prevention**: Email and phone uniqueness enforced at database level
- **Row Level Security**: PostgreSQL RLS policies ensure complete data isolation
- **Shop Isolation**: Each shop's data (jobs, printers, configs) is completely isolated
- **Rate Limiting**: Protection against brute force login attempts
- **Token Management**: Secure session handling with expiration
- **Defense-in-Depth**: Security at application AND database levels

## Configuration Requirements

### Supabase Setup
The application uses Supabase for authentication and database. To fully enable functionality:

1. Create a Supabase project at https://supabase.com
2. Run the migrations in `supabase/migrations/` to set up the database schema
3. Configure environment variables (see below)

### Environment Variables
Required for production deployment:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

These can be set in Replit's Secrets tab.

## Running the Application

### Development
The application is configured to run automatically via the workflow:
- **Workflow**: `vite-dev-server`
- **Command**: `npm run dev`
- **Port**: 5000
- **URL**: Available in Replit webview

### Production Deployment
Configured for Replit's autoscale deployment:
- **Build**: `npm run build`
- **Run**: `npx vite preview --host 0.0.0.0 --port 5000`

## User Preferences

No specific user preferences have been set yet. This section will be updated as preferences are established.

## Known Limitations

### Electron Features Not Available
Since this is running as a web app (not Electron desktop app), the following features from the original desktop app are not available:
- Direct printer access (requires Electron IPC)
- Local file system operations
- Silent PDF printing to system printers
- Electron-specific features (window controls, system tray, etc.)

### Workarounds
- Authentication and data storage work via Supabase
- PDF preview and transformation features work in the browser
- Print jobs can be managed through the web interface

## Next Steps

To fully enable all features:
1. Set up Supabase project and configure environment variables
2. Run database migrations
3. Configure authentication settings
4. Test printer management features
5. Customize for specific print shop requirements

## Documentation Files
The project includes extensive documentation:
- `AUTHENTICATION_SECURITY_SUMMARY.md`: Security implementation details
- `SUPABASE_CONNECTION_GUIDE.md`: Supabase setup instructions
- `WEB_APP_INTEGRATION_GUIDE.md`: Web app integration information
- `PDF_PREVIEW_FEATURES.md`: PDF preview feature documentation
- `PREVIEW_USER_GUIDE.md`: User guide for preview features
