import { expect, it } from "vitest";
import jsQR from "jsqr";
import { createQR, qrSVG, QR_MAX_BYTES, type QRLevel } from "./qrcode";

it("QR matrices decode back to the exact URL, Unicode and multiline text", () => {
  for (const content of [
    "https://example.com/?q=中文&x=1#part",
    "你好 😀\n日本語・Español\n  trailing spaces  ",
    "1234567890".repeat(150),
  ]) {
    for (const level of ["L", "M", "Q", "H"] as QRLevel[]) {
      const qr = createQR(content, level)!;
      const scale = 4,
        side = (qr.modules.size + 8) * scale;
      const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
      for (let y = 0; y < qr.modules.size; y++)
        for (let x = 0; x < qr.modules.size; x++) {
          if (!qr.modules.get(y, x)) continue;
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) {
              const i =
                (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
              pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
            }
        }
      expect(jsQR(pixels, side, side)?.data).toBe(content);
      const svg = qrSVG(qr, 512);
      expect(svg).toContain(
        `viewBox="0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}"`,
      );
      expect(svg).not.toContain(content); // Input never becomes SVG markup.
    }
  }
});
it("empty input clears output and UTF-8/correction limits fail explicitly", () => {
  expect(createQR("")).toBeNull();
  expect(() => createQR("a".repeat(QR_MAX_BYTES + 1))).toThrow("内容过长");
  expect(() => createQR("中".repeat(800))).toThrow("内容过长");
  expect(() => createQR("a".repeat(2000), "H")).toThrow("容错级别");
  expect(createQR("a".repeat(2000), "L")).toBeTruthy();
});
