/**
 * STORAGE SERVICE
 * Handles file uploads to Supabase Storage
 */

import { supabaseAdmin } from '../config/database';

const BUCKET_NAME = 'business-assets';

export interface UploadResult {
  url: string;
  path: string;
}

export class StorageService {
  
  /**
   * Ensure the storage bucket exists
   */
  async ensureBucket(): Promise<void> {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        // Bucket might already exist, continue
      }
    }
  }

  /**
   * Upload a file from base64 data
   */
  async uploadBase64(
    base64Data: string, 
    businessId: number, 
    type: 'logo' | 'certificate' | 'product'
  ): Promise<UploadResult> {
    await this.ensureBucket();

    // Extract the mime type and base64 content
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data format');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Generate file extension from mime type
    const extension = this.getExtensionFromMime(mimeType);
    const timestamp = Date.now();
    const filePath = `${businessId}/${type}_${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath
    };
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      // Don't throw, just log - file might not exist
    }
  }

  /**
   * Get file extension from mime type
   */
  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf'
    };
    return mimeMap[mimeType] || 'bin';
  }
}

export const storageService = new StorageService();

