import QRCode from "qrcode";
export type QRLevel = "L" | "M" | "Q" | "H";
export const QR_MAX_BYTES = 2331; // Version 40, byte mode, medium error correction.
export function createQR(input: string, level: QRLevel = "M") {
  if (!input) return null;
  if (new TextEncoder().encode(input).length > QR_MAX_BYTES)
    throw Error("内容过长，请缩短文字或网址");
  try {
    return QRCode.create(input, { errorCorrectionLevel: level });
  } catch {
    throw Error("内容超过当前容错级别的容量，请缩短内容或降低容错级别");
  }
}
export function qrSVG(
  qr: NonNullable<ReturnType<typeof createQR>>,
  size: number,
) {
  const n = qr.modules.size,
    side = n + 8;
  let path = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${side}v${side}H0z"/><path fill="#000" d="${path}"/></svg>`;
}
export function qrCanvas(
  qr: NonNullable<ReturnType<typeof createQR>>,
  size: number,
) {
  const n = qr.modules.size,
    scale = Math.max(1, Math.floor(size / (n + 8)));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (n + 8) * scale;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(y, x))
        context.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
  return canvas;
}
