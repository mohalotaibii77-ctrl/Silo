/**
 * IMAGE API ROUTES
 * Handles image processing including thumbnail generation
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../config/database';

const router = Router();

// Image size presets
const IMAGE_SIZES = {
  thumb: { width: 150, height: 150, quality: 60 },
  medium: { width: 400, height: 400, quality: 75 },
  large: { width: 800, height: 800, quality: 85 },
  full: { width: null, height: null, quality: 90 },
} as const;

type ImageSize = keyof typeof IMAGE_SIZES;

/**
 * Parse Supabase Storage URL to get bucket and path
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  // Match Supabase storage URLs like:
  // https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

/**
 * Generate thumbnail URL for an image
 * For Supabase Storage, we use the transform API
 */
function generateThumbnailUrl(originalUrl: string, size: ImageSize): string {
  if (!originalUrl) return '';
  
  const sizeConfig = IMAGE_SIZES[size];
  
  // If no transformation needed (full size), return original
  if (!sizeConfig.width && !sizeConfig.height) {
    return originalUrl;
  }

  // Check if it's a Supabase Storage URL
  if (originalUrl.includes('supabase.co/storage')) {
    // Use Supabase Image Transformation
    // Format: /storage/v1/render/image/public/bucket/path?width=W&height=H&quality=Q
    const transformUrl = originalUrl.replace(
      '/storage/v1/object/',
      '/storage/v1/render/image/'
    );
    
    const params = new URLSearchParams();
    if (sizeConfig.width) params.append('width', sizeConfig.width.toString());
    if (sizeConfig.height) params.append('height', sizeConfig.height.toString());
    params.append('quality', sizeConfig.quality.toString());
    params.append('resize', 'cover');
    
    return `${transformUrl}?${params.toString()}`;
  }

  // For external URLs, return as-is (could integrate with an image CDN service)
  return originalUrl;
}

/**
 * GET /api/images/transform
 * Transform an image URL to a specific size
 * Query params:
 *   - url: Original image URL
 *   - size: thumb, medium, large, full
 */
router.get('/transform', asyncHandler(async (req: Request, res: Response) => {
  const { url, size = 'thumb' } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Image URL is required',
    });
  }

  const imageSize = size as ImageSize;
  if (!IMAGE_SIZES[imageSize]) {
    return res.status(400).json({
      success: false,
      error: `Invalid size. Valid options: ${Object.keys(IMAGE_SIZES).join(', ')}`,
    });
  }

  const transformedUrl = generateThumbnailUrl(url, imageSize);

  res.json({
    success: true,
    data: {
      original: url,
      transformed: transformedUrl,
      size: imageSize,
      dimensions: IMAGE_SIZES[imageSize],
    },
  });
}));

/**
 * GET /api/images/product/:productId
 * Get product images with thumbnails
 */
router.get('/product/:productId', authenticate, requireBusinessAccess, asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId);
  const businessId = parseInt(req.user!.businessId);

  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('id, name, image_url, thumbnail_url')
    .eq('id', productId)
    .eq('business_id', businessId)
    .single();

  if (error || !product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  // Generate thumbnail URL if not stored
  let thumbnailUrl = product.thumbnail_url;
  if (!thumbnailUrl && product.image_url) {
    thumbnailUrl = generateThumbnailUrl(product.image_url, 'thumb');
  }

  res.json({
    success: true,
    data: {
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      thumbnail_url: thumbnailUrl,
      medium_url: product.image_url ? generateThumbnailUrl(product.image_url, 'medium') : null,
    },
  });
}));

/**
 * POST /api/images/generate-thumbnails
 * Generate and store thumbnails for products/bundles
 * This is a batch operation that should be run periodically or on-demand
 */
router.post('/generate-thumbnails', authenticate, requireBusinessAccess, asyncHandler(async (req, res) => {
  const businessId = parseInt(req.user!.businessId);
  const { type = 'products' } = req.body;

  let updated = 0;

  if (type === 'products' || type === 'all') {
    // Get products without thumbnails
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, image_url')
      .eq('business_id', businessId)
      .not('image_url', 'is', null)
      .is('thumbnail_url', null);

    if (products && products.length > 0) {
      for (const product of products) {
        const thumbnailUrl = generateThumbnailUrl(product.image_url, 'thumb');
        
        await supabaseAdmin
          .from('products')
          .update({ 
            thumbnail_url: thumbnailUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);
        
        updated++;
      }
    }
  }

  if (type === 'bundles' || type === 'all') {
    // Get bundles without thumbnails
    const { data: bundles } = await supabaseAdmin
      .from('bundles')
      .select('id, image_url')
      .eq('business_id', businessId)
      .not('image_url', 'is', null)
      .is('thumbnail_url', null);

    if (bundles && bundles.length > 0) {
      for (const bundle of bundles) {
        const thumbnailUrl = generateThumbnailUrl(bundle.image_url, 'thumb');
        
        await supabaseAdmin
          .from('bundles')
          .update({ 
            thumbnail_url: thumbnailUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bundle.id);
        
        updated++;
      }
    }
  }

  res.json({
    success: true,
    message: `Generated thumbnails for ${updated} items`,
    updated,
  });
}));

/**
 * Utility function to get image URLs with thumbnails
 * Can be used by other services
 */
export function getImageUrls(originalUrl: string | null): {
  original: string | null;
  thumbnail: string | null;
  medium: string | null;
} {
  if (!originalUrl) {
    return { original: null, thumbnail: null, medium: null };
  }

  return {
    original: originalUrl,
    thumbnail: generateThumbnailUrl(originalUrl, 'thumb'),
    medium: generateThumbnailUrl(originalUrl, 'medium'),
  };
}

export { generateThumbnailUrl, IMAGE_SIZES };
export default router;



