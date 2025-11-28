/**
 * Truncates a filename while preserving the extension
 * @param filename The full filename to truncate
 * @param maxLength Maximum length of the truncated filename
 * @returns Truncated filename with preserved extension
 */
export const truncateFilename = (filename: string, maxLength: number = 25): string => {
  if (!filename) return '';
  if (filename.length <= maxLength) return filename;
  
  const extension = filename.includes('.') 
    ? filename.substring(filename.lastIndexOf('.')) 
    : '';
  
  const nameWithoutExtension = filename.includes('.')
    ? filename.substring(0, filename.lastIndexOf('.'))
    : filename;
  
  // Calculate how much of the name we can keep
  const maxNameLength = maxLength - extension.length - 3; // 3 for the ellipsis
  
  if (maxNameLength <= 0) {
    // If extension is too long, truncate the extension
    return nameWithoutExtension.substring(0, maxLength - 3) + '...';
  }
  
  return nameWithoutExtension.substring(0, maxNameLength) + '...' + extension;
};

/**
 * Gets the file extension from a filename
 * @param filename The filename to extract extension from
 * @returns The file extension (lowercase, without the dot)
 */
export const getFileExtension = (filename: string): string => {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Checks if a file is a PDF based on its filename
 * @param filename The filename to check
 * @returns True if the file is a PDF
 */
export const isPdfFile = (filename: string): boolean => {
  return getFileExtension(filename) === 'pdf';
};

/**
 * Checks if a file is an image based on its filename
 * @param filename The filename to check
 * @returns True if the file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
};

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes File size in bytes
 * @returns Formatted file size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};