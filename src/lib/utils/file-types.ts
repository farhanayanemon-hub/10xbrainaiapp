/**
 * Text file MIME types supported for inline content extraction
 */
export const TEXT_FILE_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const;

/**
 * Check if a MIME type represents a text file that can be read as content
 */
export function isTextFileMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('text/') || mimeType === 'application/json';
}
