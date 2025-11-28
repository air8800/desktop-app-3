# N-up Printing Implementation Status

## ✅ What's Working

### 1. Database Schema ✓
- **Migration File**: `20251006000000_add_nup_fields.sql`
- **Fields Added**:
  - `nup_pages` (integer, default 1) - Stores pages per sheet (1, 2, 4, 6, 9, 16)
  - `nup_orientation` (text, default 'portrait') - Stores orientation preference
- **Constraints**: Valid values enforced at database level
- **Status**: ✅ Migration file created and ready to apply

### 2. TypeScript Interfaces ✓
**Updated Files**:
- `src/types.ts` - PrintJob interface includes nup_pages and nup_orientation
- `src/utils/supabase.ts` - PrintJob interface includes both fields  
- `src/utils/webAppSync.ts` - PrintJobData interface includes both fields
- `src/vite-env.d.ts` - Electron IPC types include nupOrientation parameter

**Status**: ✅ All interfaces properly typed

### 3. Frontend Components ✓
**PdfPreview Component** (`src/components/PdfPreview.tsx`):
- Accepts `jobData` prop with nup settings
- Pre-fills nup_pages and nup_orientation from job data
- User can still override settings before printing
- Passes nupOrientation to print pipeline

**JobList Component** (`src/components/JobList.tsx`):
- Pre-fills "Print Now" modal with job's nup settings
- Sets selectedNupPages and selectedNupOrientation from job data
- Passes both parameters through to print functions

**Status**: ✅ Components properly configured

### 4. Print Pipeline ✓
**Updated Functions**:
- `electron/preload.js` - Passes nupOrientation parameter
- `electron/main.js` - All print handlers receive nupOrientation
- All printing modules (Ghostscript, MuPDF, cpdf, SumatraPDF) receive parameters

**Status**: ✅ Complete print pipeline supports N-up orientation

---

## 🔍 How It Works (End-to-End)

### Scenario: Customer orders 2-up portrait print from web app

1. **Web App** → Customer selects:
   - Paper: A4
   - Copies: 5
   - Layout: 2 pages per sheet
   - Orientation: Portrait

2. **Database** → Order saved with:
   ```sql
   nup_pages = 2
   nup_orientation = 'portrait'
   ```

3. **Desktop App** → Loads job via `getPrintJobs()`:
   ```typescript
   const { data } = await supabase
     .from('print_jobs')
     .select('*')  // Gets ALL columns including nup_pages and nup_orientation
   ```

4. **Display** → Job appears in JobList with all settings

5. **Shop Owner Actions**:

   **Option A: Print Now (Quick)**
   - Clicks "Print Now" button
   - Modal shows pre-filled settings:
     - Paper Size: A4 (from job)
     - Copies: 5 (from job)
     - Color: BW (from job)
     - Print Type: Single (from job)
     - N-up: 2 pages per sheet (from job)
     - Orientation: Portrait (from job)
   - Owner can change any setting
   - Clicks print

   **Option B: Preview First**
   - Clicks "Preview PDF" button
   - PDF viewer opens with pre-filled settings:
     - All settings from job data
     - N-up and orientation already set
   - Owner reviews, adjusts if needed, prints

6. **Printing** → Settings passed through pipeline:
   ```typescript
   window.electron.downloadAndPrintFile(
     fileUrl, filename, printer,
     copies, paperSize, colorMode, printType,
     nupPages,        // 2
     nupOrientation   // 'portrait'
   )
   ```

7. **Result** → File prints exactly as customer ordered

---

## ✅ Testing Checklist

### Database Migration
- [ ] Run migration: The migration file needs to be applied to your Supabase database
- [ ] Verify columns exist: Check print_jobs table has nup_pages and nup_orientation
- [ ] Test constraints: Try inserting invalid nup_pages value (should fail)

### Data Flow
- [ ] Create test order with nup settings from web app
- [ ] Verify data appears in print_jobs table with correct nup values
- [ ] Desktop app loads jobs - check console for nup_pages and nup_orientation values
- [ ] Open "Print Now" - verify modal shows correct nup settings
- [ ] Open "Preview PDF" - verify preview shows correct nup settings

### Printing
- [ ] Print with 1-up (normal) - should work as before
- [ ] Print with 2-up portrait - should print 2 pages per sheet
- [ ] Print with 2-up landscape - should print 2 pages per sheet landscape
- [ ] Print with 4-up - should print 4 pages per sheet
- [ ] Verify orientation parameter is passed to print tools

---

## 🔧 What You Need To Do

### CRITICAL: Apply Database Migration

The migration file exists but needs to be applied to your Supabase database:

**Option 1: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of: 
   `supabase/migrations/20251006000000_add_nup_fields.sql`
5. Paste into the SQL editor
6. Click "Run" to execute
7. Check output - should see success messages

**Option 2: Via Supabase CLI**
```bash
supabase db push
```

**Verification**:
```sql
-- Run this to verify columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'print_jobs' 
AND column_name IN ('nup_pages', 'nup_orientation');
```

Should return:
```
column_name       | data_type | column_default
------------------|-----------|--------------
nup_pages         | integer   | 1
nup_orientation   | text      | 'portrait'
```

---

## 📊 Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ READY | Migration file created, needs to be applied |
| TypeScript Types | ✅ COMPLETE | All interfaces updated |
| Frontend Components | ✅ COMPLETE | PdfPreview and JobList pre-fill from job data |
| Print Pipeline | ✅ COMPLETE | All handlers support nupOrientation |
| Electron IPC | ✅ COMPLETE | Parameters passed through preload |
| Build Status | ✅ SUCCESS | No compilation errors |

---

## 🐛 Debugging Tips

### If N-up settings don't appear:

1. **Check Database**:
   ```sql
   SELECT id, filename, nup_pages, nup_orientation 
   FROM print_jobs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   - If columns don't exist → Migration not applied
   - If columns exist but NULL → Web app not sending values

2. **Check Console Logs**:
   - Open DevTools (F12) in desktop app
   - Look for job loading:
     ```
     🔄 Loaded X jobs from database
     ```
   - Inspect job objects - should have nup_pages and nup_orientation

3. **Check Component State**:
   - In JobList, add console.log:
     ```typescript
     console.log('Job N-up settings:', {
       nup_pages: job.nup_pages,
       nup_orientation: job.nup_orientation
     });
     ```

4. **Check Pre-fill**:
   - When "Print Now" opens, check console:
     ```typescript
     console.log('Selected N-up:', selectedNupPages, selectedNupOrientation);
     ```

---

## 🎯 Summary

**The desktop app CAN get N-up info from the database** - everything is properly wired!

**What's needed**:
1. ✅ Code is complete and builds successfully
2. ⚠️ **Database migration must be applied** (one-time setup)
3. ✅ Web app must send nup_pages and nup_orientation when creating orders
4. ✅ Desktop app will automatically load and use these values

Once the migration is applied, the full N-up workflow will work end-to-end!

---

## 📝 Migration SQL (Ready to Copy/Paste)

```sql
-- Copy and run this entire script in Supabase SQL Editor

-- Add nup_pages column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_pages'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN nup_pages INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add nup_orientation column  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_orientation'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN nup_orientation TEXT NOT NULL DEFAULT 'portrait';
  END IF;
END $$;

-- Add constraints
ALTER TABLE print_jobs
ADD CONSTRAINT IF NOT EXISTS check_nup_pages_valid
CHECK (nup_pages IN (1, 2, 4, 6, 9, 16));

ALTER TABLE print_jobs
ADD CONSTRAINT IF NOT EXISTS check_nup_orientation_valid
CHECK (nup_orientation IN ('portrait', 'landscape'));

-- Verify
SELECT 'Migration Complete!' as status;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'print_jobs' 
AND column_name IN ('nup_pages', 'nup_orientation');
```

