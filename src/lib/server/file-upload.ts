import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { adminSettingsService, getCloudStorageSettings } from './admin-settings';
import { storageService } from './storage';

const UPLOAD_DIR = 'static/uploads';
const BRANDING_DIR = join(UPLOAD_DIR, 'branding');

// File magic numbers (signatures) for server-side validation
// This prevents attackers from bypassing client-side MIME type checks
const FILE_SIGNATURES: Record<string, { signatures: number[][]; offset?: number; additionalCheck?: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': {
    signatures: [[0xFF, 0xD8, 0xFF]]
  },
  'image/jpg': {
    signatures: [[0xFF, 0xD8, 0xFF]]
  },
  'image/png': {
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]
  },
  'image/gif': {
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
    ]
  },
  'image/webp': {
    signatures: [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    additionalCheck: (bytes: Uint8Array) => {
      // Check for WEBP marker at offset 8
      if (bytes.length >= 12) {
        const webpMarker = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        return webpMarker === 'WEBP';
      }
      return false;
    }
  },
  'image/x-icon': {
    signatures: [
      [0x00, 0x00, 0x01, 0x00], // ICO
      [0x00, 0x00, 0x02, 0x00]  // CUR (cursor, also valid for favicons)
    ]
  }
};

/**
 * Validates file content against magic number signatures.
 * This provides server-side security by verifying actual file content,
 * not just the client-provided MIME type which can be spoofed.
 */
async function validateFileMagic(file: File): Promise<{ valid: boolean; error?: string; detectedType?: string }> {
  // Read first 16 bytes for signature checking
  const buffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Handle SVG separately (text-based XML format)
  if (file.type === 'image/svg+xml') {
    // SVG files are XML text, need to check for XML declaration or svg tag
    const textBuffer = await file.slice(0, 1024).arrayBuffer();
    const text = new TextDecoder().decode(textBuffer).toLowerCase();

    // Check for valid SVG indicators
    if (text.includes('<?xml') || text.includes('<svg') || text.includes('<!doctype svg')) {
      return { valid: true, detectedType: 'image/svg+xml' };
    }

    return { valid: false, error: 'Invalid SVG file: does not contain valid SVG markup' };
  }

  // Check binary signatures for other image types
  for (const [mimeType, config] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of config.signatures) {
      // Check if file starts with the expected signature
      const matches = signature.every((byte, index) => bytes[index] === byte);

      if (matches) {
        // Run additional check if defined (e.g., WEBP needs RIFF + WEBP marker)
        if (config.additionalCheck && !config.additionalCheck(bytes)) {
          continue;
        }

        return { valid: true, detectedType: mimeType };
      }
    }
  }

  return { valid: false, error: 'File content does not match any supported image format' };
}

// Check if R2 cloud storage is available and configured
async function isCloudStorageEnabled(): Promise<boolean> {
  try {
    const settings = await getCloudStorageSettings();

    return !!(
      settings.r2_account_id &&
      settings.r2_access_key_id &&
      settings.r2_secret_access_key &&
      settings.r2_bucket_name
    );
  } catch (error) {
    console.error('Failed to check cloud storage settings:', error);
    return false;
  }
}


// Ensure upload directories exist
async function ensureUploadDirs() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(BRANDING_DIR)) {
    await mkdir(BRANDING_DIR, { recursive: true });
  }
}

// Generate safe filename
function generateSafeFilename(originalName: string): string {
  const id = randomUUID();
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  return `${id}.${ext}`;
}

// Allowed MIME types for branding images
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_FAVICON_TYPES = [...ALLOWED_IMAGE_TYPES, 'image/x-icon'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Validates image file with both MIME type and magic number checks.
 * Server-side validation that cannot be bypassed by client manipulation.
 */
async function validateImageFile(file: File, isFavicon: boolean = false): Promise<{ valid: boolean; error?: string }> {
  const allowedTypes = isFavicon ? ALLOWED_FAVICON_TYPES : ALLOWED_IMAGE_TYPES;

  // Check declared MIME type
  if (!allowedTypes.includes(file.type)) {
    const formats = isFavicon ? 'JPG, PNG, GIF, WebP, SVG, or ICO' : 'JPG, PNG, GIF, WebP, or SVG';
    return {
      valid: false,
      error: `Invalid file type. Please upload ${formats} files.`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size must be less than 2MB.'
    };
  }

  // Validate magic number matches declared type (server-side security)
  const magicResult = await validateFileMagic(file);

  if (!magicResult.valid) {
    console.warn(`Magic number validation failed for ${file.name}: ${magicResult.error}`);
    return {
      valid: false,
      error: magicResult.error || 'File content validation failed'
    };
  }

  // Verify detected type matches declared type (accounting for jpg/jpeg equivalence)
  const declaredType = file.type.toLowerCase();
  const detectedType = magicResult.detectedType?.toLowerCase();

  if (detectedType && declaredType !== detectedType) {
    // Allow jpg/jpeg mismatch since they're equivalent
    const isJpegMismatch =
      (declaredType === 'image/jpg' && detectedType === 'image/jpeg') ||
      (declaredType === 'image/jpeg' && detectedType === 'image/jpg');

    if (!isJpegMismatch) {
      console.warn(`MIME type mismatch: declared ${declaredType}, detected ${detectedType}`);
      return {
        valid: false,
        error: `File content (${detectedType}) does not match declared type (${declaredType})`
      };
    }
  }

  return { valid: true };
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  path: string;
  url: string;
}

export async function uploadBrandingFile(file: File, category: string = 'logo'): Promise<UploadedFile> {
  // Validate file with magic number check (favicon allows ICO format)
  const isFavicon = category === 'favicon';
  const validation = await validateImageFile(file, isFavicon);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate safe filename
  const filename = generateSafeFilename(file.name);

  // Check if cloud storage is available
  const useCloudStorage = await isCloudStorageEnabled();

  if (useCloudStorage) {
    try {
      // Upload to R2 cloud storage
      console.log(`Uploading ${category} to R2 cloud storage`);

      const buffer = Buffer.from(await file.arrayBuffer());
      const storageFile = { buffer, mimeType: file.type, filename };

      // Upload using the StorageService branding-specific method
      const result = await storageService.uploadBrandingFile(storageFile, category);

      // Save file info to database
      const fileRecord = await adminSettingsService.saveFile({
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        category,
        path: result.path,
        url: result.publicUrl || result.url,
        storageLocation: result.storageLocation
      });

      console.log(`Successfully uploaded ${category} to R2: ${result.publicUrl || result.url}`);

      return {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        category: fileRecord.category,
        path: fileRecord.path,
        url: fileRecord.url || result.publicUrl || result.url || '',
      };
    } catch (cloudError) {
      console.error(`Failed to upload ${category} to R2, falling back to local storage:`, cloudError);
      // Fall through to local storage
    }
  }

  // Fallback to local storage (or primary method if cloud storage disabled)
  console.log(`Uploading ${category} to local storage`);

  // Ensure directories exist
  await ensureUploadDirs();

  const filePath = join(BRANDING_DIR, filename);
  const publicUrl = `/uploads/branding/${filename}`;

  // Convert File to Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Write file to disk
  await writeFile(filePath, buffer);

  // Save file info to database
  const fileRecord = await adminSettingsService.saveFile({
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    category,
    path: filePath,
    url: publicUrl,
    storageLocation: 'local'
  });

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    originalName: fileRecord.originalName,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
    category: fileRecord.category,
    path: fileRecord.path,
    url: fileRecord.url || publicUrl,
  };
}

export async function deleteBrandingFile(category: string): Promise<void> {
  // Get existing file
  const existingFile = await adminSettingsService.getFile(category);

  if (existingFile) {
    // Delete from storage based on storage location
    if (existingFile.storageLocation === 'r2') {
      try {
        console.log(`Deleting ${category} from R2 cloud storage: ${existingFile.path}`);
        await storageService.delete(existingFile.path);
        console.log(`Successfully deleted ${category} from R2`);
      } catch (error) {
        console.error(`Failed to delete ${category} from R2:`, error);
        // Continue with database cleanup even if cloud deletion fails
      }
    } else {
      // Delete local files to prevent orphaned files accumulating on disk
      try {
        if (existsSync(existingFile.path)) {
          console.log(`Deleting local branding file: ${existingFile.path}`);
          await unlink(existingFile.path);
          console.log(`Successfully deleted local file: ${existingFile.path}`);
        } else {
          console.log(`Local file not found (already deleted?): ${existingFile.path}`);
        }
      } catch (error) {
        console.error(`Failed to delete local branding file ${existingFile.path}:`, error);
        // Continue with database cleanup even if file deletion fails
      }
    }

    // Delete from database
    await adminSettingsService.deleteFile(existingFile.id);
  }
}

// Helper function to get current branding file
export async function getCurrentBrandingFile(category: string): Promise<UploadedFile | null> {
  const file = await adminSettingsService.getFile(category);
  if (!file) return null;
  
  return {
    id: file.id,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category,
    path: file.path,
    url: file.url || `/uploads/branding/${file.filename}`,
  };
}