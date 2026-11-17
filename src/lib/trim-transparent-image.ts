export function trimTransparentImage(image: HTMLImageElement): string | undefined {
  const { naturalWidth: width, naturalHeight: height } = image;
  // shortcut: Keep images above 4 MP unchanged; tile the scan if larger model previews are needed.
  if (!width || !height || width * height > 4_194_304) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) return;
    const contentWidth = right - left + 1, contentHeight = bottom - top + 1;
    const padding = Math.max(1, Math.ceil(Math.max(contentWidth, contentHeight) * .04));
    if (contentWidth + padding * 2 >= width && contentHeight + padding * 2 >= height) return;
    canvas.width = contentWidth + padding * 2; canvas.height = contentHeight + padding * 2;
    context.drawImage(image, left, top, contentWidth, contentHeight, padding, padding, contentWidth, contentHeight);
    return canvas.toDataURL("image/png");
  } catch {
    // A blocked pixel read or encoding failure must not hide an otherwise usable image.
    return;
  }
}
