import { StickerSegment } from '../types';

export const sliceImage = async (
  file: File,
  rows: number = 4,
  cols: number = 4
): Promise<StickerSegment[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const segments: StickerSegment[] = [];
      const segmentWidth = img.width / cols;
      const segmentHeight = img.height / rows;

      // Check if image is valid
      if (segmentWidth === 0 || segmentHeight === 0) {
        reject(new Error("Image dimensions are too small"));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = segmentWidth;
      canvas.height = segmentHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Clear canvas for transparency support
          ctx.clearRect(0, 0, segmentWidth, segmentHeight);
          
          ctx.drawImage(
            img,
            x * segmentWidth,
            y * segmentHeight,
            segmentWidth,
            segmentHeight,
            0,
            0,
            segmentWidth,
            segmentHeight
          );

          // Get Data URL for preview
          const dataUrl = canvas.toDataURL('image/png');
          
          // Get Blob for final file
          canvas.toBlob((blob) => {
            if (blob) {
              segments.push({
                id: y * cols + x,
                dataUrl,
                blob,
                label: `sticker_${y * cols + x + 1}`, // Default label
                isProcessing: true // Initially true until AI updates it
              });

              // Resolve when all segments are done
              if (segments.length === rows * cols) {
                // Sort by ID to ensure correct order (top-left to bottom-right)
                segments.sort((a, b) => a.id - b.id);
                resolve(segments);
              }
            }
          }, 'image/png');
        }
      }
    };

    img.onerror = (err) => {
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/png;base64, prefix if present for Gemini API usually,
        // but the SDK helper usually takes raw base64 data.
        // The SDK inlineData expects just the base64 string without the mime prefix.
        const base64Data = result.split(',')[1];
        resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Get the dimensions (width x height) of an image blob
 */
export const getImageDimensions = (blob: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Resize an image blob to a target square size using Canvas
 * Used for downscaling images when target size is smaller than current
 */
export const resizeImage = (blob: Blob, targetSize: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Use better quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image scaled to target size
      ctx.drawImage(img, 0, 0, targetSize, targetSize);

      canvas.toBlob((resultBlob) => {
        if (resultBlob) {
          resolve(resultBlob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};
