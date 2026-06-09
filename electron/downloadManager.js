/**
 * Download Manager for PDF files
 * Handles background downloading with progress tracking, pause/resume, and cleanup
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class DownloadManager {
    constructor() {
        this.downloads = new Map(); // jobId -> download info
        this.downloadedFiles = new Map(); // jobId -> file info
        this.tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
        this.stateFile = path.join(this.tempDir, 'download-state.json');
        this.mainWindow = null;
        this.ensureTempDir();
        this.loadState();
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = fs.readFileSync(this.stateFile, 'utf8');
                const state = JSON.parse(data);

                // Restore downloaded files map
                if (state.downloadedFiles) {
                    for (const [jobId, info] of Object.entries(state.downloadedFiles)) {
                        // Only add if file still exists
                        if (fs.existsSync(info.filePath)) {
                            this.downloadedFiles.set(jobId, info);
                        }
                    }
                }
                console.log(`📦 [DownloadManager] Restored ${this.downloadedFiles.size} downloaded files from state`);
            }
        } catch (error) {
            console.error('Failed to load download state:', error);
        }
    }

    saveState() {
        try {
            const state = {
                downloadedFiles: Object.fromEntries(this.downloadedFiles)
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Failed to save download state:', error);
        }
    }

    /**
     * Get local file path if already downloaded
     * @param {string} jobId - Job ID to check
     * @returns {string|null} File path or null if not downloaded
     */
    getDownloadedPath(jobId) {
        const info = this.downloadedFiles.get(jobId);
        if (info && fs.existsSync(info.filePath)) {
            return info.filePath;
        }
        return null;
    }

    /**
     * Start downloading a file for a job
     */
    async startDownload(jobId, fileUrl, filename) {
        // Check if already downloading or downloaded
        if (this.downloads.has(jobId)) {
            const existing = this.downloads.get(jobId);
            if (existing.status === 'paused') {
                return this.resumeDownload(jobId);
            }
            return { success: false, error: 'Already downloading' };
        }

        if (this.downloadedFiles.has(jobId)) {
            const existing = this.downloadedFiles.get(jobId);
            if (fs.existsSync(existing.filePath)) {
                return { success: true, filePath: existing.filePath, cached: true };
            }
            this.downloadedFiles.delete(jobId);
        }

        // Create unique filename
        const timestamp = Date.now();
        const ext = path.extname(filename);
        const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const uniqueFilename = `${base}_${timestamp}${ext}`;
        const filePath = path.join(this.tempDir, uniqueFilename);

        // Initialize download tracking
        const downloadInfo = {
            jobId,
            filename,
            fileUrl,
            filePath,
            status: 'downloading',
            progress: 0,
            loaded: 0,
            total: 0,
            speed: 0,
            startedAt: Date.now(),
            controller: null,
            error: null
        };

        this.downloads.set(jobId, downloadInfo);
        this.emitUpdate();

        try {
            await this._performDownload(downloadInfo);
            return { success: true, filePath };
        } catch (error) {
            downloadInfo.status = 'error';
            downloadInfo.error = error.message;
            this.emitUpdate();
            return { success: false, error: error.message };
        }
    }

    async _performDownload(info, resumeFrom = 0) {
        try {
            console.log('📥 Starting download:', info.filename, resumeFrom > 0 ? `(resuming from ${resumeFrom})` : '');

            // Use Range header if resuming
            const headers = {};
            if (resumeFrom > 0) {
                headers['Range'] = `bytes=${resumeFrom}-`;
            }

            const response = await fetch(info.fileUrl, { headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // For resumed downloads, the content-length is the remaining size
            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const total = resumeFrom > 0 ? resumeFrom + contentLength : contentLength;
            info.total = total;

            const reader = response.body.getReader();
            const chunks = [];
            let loaded = resumeFrom; // Start from resume point
            let lastLoaded = resumeFrom;
            let lastTime = Date.now();

            while (true) {
                if (info.status === 'cancelled') {
                    reader.cancel();
                    throw new Error('Cancelled');
                }
                if (info.status === 'paused') {
                    reader.cancel();
                    // Save partial data to disk for resume
                    if (chunks.length > 0) {
                        const partialBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
                        const partialPath = info.filePath + '.partial';
                        fs.writeFileSync(partialPath, partialBuffer);
                        info.partialPath = partialPath;
                        info.partialSize = loaded;
                    }
                    console.log('⏸️ Paused download:', info.filename, 'at', loaded, 'bytes');
                    return;
                }

                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                loaded += value.length;
                info.loaded = loaded;
                info.progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

                // Calculate speed
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                if (timeDiff >= 0.5) {
                    info.speed = Math.round((loaded - lastLoaded) / timeDiff);
                    lastLoaded = loaded;
                    lastTime = now;
                }

                this.emitUpdate();
            }

            // Combine with any existing partial data
            let finalBuffer;
            if (resumeFrom > 0 && info.partialPath && fs.existsSync(info.partialPath)) {
                const existingData = fs.readFileSync(info.partialPath);
                const newData = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
                finalBuffer = Buffer.concat([existingData, newData]);
                // Clean up partial file
                fs.unlinkSync(info.partialPath);
            } else {
                finalBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
            }
            fs.writeFileSync(info.filePath, finalBuffer);

            info.status = 'completed';
            info.progress = 100;

            // Move to downloaded files
            this.downloadedFiles.set(info.jobId, {
                jobId: info.jobId,
                filename: info.filename,
                filePath: info.filePath,
                fileUrl: info.fileUrl,
                size: loaded,
                downloadedAt: Date.now(),
                printed: false
            });

            this.downloads.delete(info.jobId);
            this.saveState();
            this.emitUpdate();
            console.log('✅ Download complete:', info.filename);
        } catch (error) {
            console.error('❌ Download failed:', info.filename, error.message);
            throw error;
        }
    }

    pauseDownload(jobId) {
        const info = this.downloads.get(jobId);
        if (info && info.status === 'downloading') {
            info.status = 'paused';
            if (info.controller) {
                info.controller.destroy();
            }
            this.emitUpdate();
            return { success: true };
        }
        return { success: false, error: 'Not downloading' };
    }

    resumeDownload(jobId) {
        const info = this.downloads.get(jobId);
        if (info && info.status === 'paused') {
            info.status = 'downloading';
            this.emitUpdate();

            // Resume from where we left off
            const resumeFrom = info.partialSize || 0;

            this._performDownload(info, resumeFrom).then(() => {
                console.log('✅ Resume completed:', info.filename);
            }).catch(error => {
                info.status = 'error';
                info.error = error.message;
                this.emitUpdate();
            });

            return { success: true };
        }
        return { success: false, error: 'Not paused' };
    }

    cancelDownload(jobId) {
        const info = this.downloads.get(jobId);
        if (info) {
            info.status = 'cancelled';
            if (info.controller) {
                info.controller.destroy();
            }
            // Remove partial file
            try {
                if (fs.existsSync(info.filePath)) {
                    fs.unlinkSync(info.filePath);
                }
            } catch (e) { }
            this.downloads.delete(jobId);
            this.emitUpdate();
            return { success: true };
        }
        return { success: false, error: 'Not found' };
    }

    deleteDownloadedFile(jobId) {
        const info = this.downloadedFiles.get(jobId);
        if (info) {
            try {
                if (fs.existsSync(info.filePath)) {
                    fs.unlinkSync(info.filePath);
                }
            } catch (e) { }
            this.downloadedFiles.delete(jobId);
            this.saveState();
            this.emitUpdate();
            return { success: true };
        }
        return { success: false, error: 'Not found' };
    }

    markAsPrinted(jobId) {
        const info = this.downloadedFiles.get(jobId);
        if (info) {
            info.printed = true;
            info.printedAt = Date.now();
            this.emitUpdate();
            return { success: true };
        }
        return { success: false };
    }

    getFilePath(jobId) {
        const downloaded = this.downloadedFiles.get(jobId);
        if (downloaded && fs.existsSync(downloaded.filePath)) {
            return downloaded.filePath;
        }
        return null;
    }

    isDownloaded(jobId) {
        const downloaded = this.downloadedFiles.get(jobId);
        return downloaded && fs.existsSync(downloaded.filePath);
    }

    getActiveDownloads() {
        return Array.from(this.downloads.values());
    }

    getDownloadedFiles() {
        return Array.from(this.downloadedFiles.values()).filter(f => fs.existsSync(f.filePath));
    }

    getStatus() {
        return {
            downloading: this.getActiveDownloads(),
            downloaded: this.getDownloadedFiles()
        };
    }

    emitUpdate() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('download-update', this.getStatus());
        }
    }

    // Smart cleanup: delete printed files older than 1 hour
    cleanupPrintedFiles(maxAgeMs = 60 * 60 * 1000) {
        const now = Date.now();
        let count = 0;

        for (const [jobId, info] of this.downloadedFiles) {
            if (info.printed && info.printedAt && (now - info.printedAt) > maxAgeMs) {
                try {
                    if (fs.existsSync(info.filePath)) {
                        fs.unlinkSync(info.filePath);
                    }
                } catch (e) { }
                this.downloadedFiles.delete(jobId);
                count++;
            }
        }

        this.saveState();
        this.emitUpdate();
        return count;
    }
}

module.exports = new DownloadManager();
