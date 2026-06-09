# Xerox Shop Manager - Replit Setup

## Overview
**Xerox Shop Manager** is a professional print shop management application, originally an Electron desktop app, now adapted to run as a web application within the Replit environment. Its primary purpose is to manage print jobs, offering advanced PDF preview capabilities, real-time print settings visualization, and comprehensive printer management. The application aims to streamline print shop operations through features like real-time PDF rendering, support for various paper sizes and N-up layouts, color mode preview (grayscale), and secure authentication.

## User Preferences
No specific user preferences have been set yet. This section will be updated as preferences are established.

## System Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS, Lucide React icons
- **PDF Handling**: pdfjs-dist, pdf-lib
- **Backend/Auth**: Supabase
- **Routing**: React Router DOM

### UI/UX Decisions
- Real-time PDF preview with instant updates.
- Support for various paper sizes (A3, A4, A5, Letter, Legal, Executive) and N-up layouts (1, 2, 4, 6, 9 pages per sheet).
- Real-time grayscale conversion preview for B&W printing.
- Enhanced PDF preview performance with:
    - Instant first-page rendering.
    - Debounced updates for smooth setting changes.
    - Module-level PDF document caching with 10-minute expiry.
    - Preemptive PDF loading (non-blocking upload, dashboard background loading).
    - Progressive Rendering System: Instant low-quality preview auto-enhanced to full quality.
    - Detailed loading status and production-grade race condition prevention.

### Technical Implementations & System Design
- **Web Application Adaptation**: The project, originally an Electron app, is configured to run as a web application in Replit, with the React/Vite frontend on port 5000.
- **Native Print Engine (Electron-specific)**: For the Electron version, a `nativePrintEngine.js` was created using `pdf-lib` for PDF transformations and bundled `SumatraPDF` for silent printing, supporting N-up layouts, orientation, and paper size control without external dependencies like Ghostscript or MuPDF. This is not available in the web version.
- **Security Architecture**:
    - **Email Verification**: Mandatory email confirmation for user access.
    - **Enhanced Signup/Login**: Duplicate email/phone prevention, input validation, rate limiting, and secure session management.
    - **Row Level Security (RLS)**: PostgreSQL RLS policies implemented for database-level data isolation, ensuring shop owners only access their own data across `shops`, `print_jobs`, `printer_configs`, `cost_configs`, and `profiles` tables.
- **Directory Structure**: Organized into `src/` (components, context, data, pages, utils), `electron/` (Electron-specific code, not for web), `supabase/` (database migrations), `dist/`, and `public/`.
- **Configuration**: Vite configured for Replit's proxy environment and preview server; `.gitignore` includes Replit-specific exclusions.

### Key Components
- **PdfPreview**: Advanced PDF rendering and real-time settings preview.
- **PrinterConfig**: Manages printer settings and configurations.
- **JobList**: Tracks and manages print jobs, potentially with drag-and-drop.
- **Authentication**: Handles user login and signup with enhanced security features.

## External Dependencies
- **Supabase**: Used for authentication, user management, and as the primary database. Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.
- **pdfjs-dist**: For PDF rendering and preview capabilities in the frontend.
- **pdf-lib**: (Electron-specific, not directly used in web version's client-side) For programmatic PDF creation and modification.
- **SumatraPDF**: (Electron-specific, not for web) Bundled for silent PDF printing in the desktop application.
- **React Router DOM**: For client-side routing within the React application.
- **Tailwind CSS**: For styling the application.
- **Lucide React**: For UI icons.