/**
 * Image optimization utility to enhance text readability and resize images.
 */
export async function optimizeImage(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // 1. Resize logic - maintain aspect ratio but ensure it's not too small or too huge
      // Target width around 1600px for good OCR balance
      const targetWidth = 1600;
      const scale = targetWidth / img.width;
      
      // Only resize if the image is significantly different from target
      if (img.width > 2000 || img.width < 1000) {
        canvas.width = targetWidth;
        canvas.height = img.height * scale;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // 2. Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 3. Image Enhancement for OCR
      // We'll use canvas filters for contrast and brightness
      // High contrast helps separate text from background
      ctx.filter = 'contrast(1.4) brightness(1.1) grayscale(0.2)';
      ctx.drawImage(canvas, 0, 0);

      // 4. Return optimized base64
      resolve(canvas.toDataURL('image/png', 0.9));
    };
    img.onerror = reject;
    img.src = base64;
  });
}
