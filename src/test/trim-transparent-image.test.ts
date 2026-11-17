import { afterEach, expect, it, vi } from "vitest";
import { trimTransparentImage } from "@/lib/trim-transparent-image";

afterEach(() => vi.restoreAllMocks());

function fixture(data = new Uint8ClampedArray(10 * 10 * 4)) {
  const image = new Image();
  Object.defineProperties(image, { naturalWidth: { value: 10 }, naturalHeight: { value: 10 } });
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data })) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const encoded = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,cropped");
  return { image, context, encoded };
}

it("removes transparent borders and adds a small margin around every visible pixel", () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  for (const [x, y, alpha] of [[4, 4, 255], [5, 5, 255], [1, 1, 1]]) pixels[(y * 10 + x) * 4 + 3] = alpha;
  const { image, context, encoded } = fixture(pixels);
  expect(trimTransparentImage(image)).toBe("data:image/png;base64,cropped");
  expect(context.drawImage).toHaveBeenLastCalledWith(image, 1, 1, 5, 5, 1, 1, 5, 5);
  expect(encoded.mock.instances[0]).toMatchObject({ width: 7, height: 7 });
});

it.each([0, 255])("leaves a fully transparent or opaque image unchanged (alpha %s)", alpha => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4).fill(alpha);
  const { image, encoded } = fixture(pixels);
  expect(trimTransparentImage(image)).toBeUndefined();
  expect(encoded).not.toHaveBeenCalled();
});

it("preserves content touching an edge and adds padding outside it", () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  pixels[3] = 255; pixels[(2 * 10 + 3) * 4 + 3] = 255;
  const { image, context } = fixture(pixels);
  trimTransparentImage(image);
  expect(context.drawImage).toHaveBeenLastCalledWith(image, 0, 0, 4, 3, 1, 1, 4, 3);
});

it("falls back to the original when pixel access is blocked", () => {
  const { image, context, encoded } = fixture();
  context.getImageData.mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  expect(trimTransparentImage(image)).toBeUndefined();
  expect(encoded).not.toHaveBeenCalled();
});

it("does not allocate a pixel buffer for oversized images", () => {
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  const image = new Image();
  Object.defineProperties(image, { naturalWidth: { value: 4096 }, naturalHeight: { value: 4096 } });
  expect(trimTransparentImage(image)).toBeUndefined();
  expect(context).not.toHaveBeenCalled();
});
