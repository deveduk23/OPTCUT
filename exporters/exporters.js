import { EXPORT_LINE_SCALE } from '../models/config.js';

function downloadBlob(filename, blob, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarArteSvg(svgExports) {
  if (!svgExports?.length) throw new Error('Nenhum resultado para exportar.');
  const pack = svgExports.map((s) => `<!-- ${s.id} | stroke x${EXPORT_LINE_SCALE} -->\n${s.svg}`).join('\n\n');
  downloadBlob('optcut-arte.svg', pack, 'image/svg+xml');
}

export async function exportarArtePng(svgExports) {
  if (!svgExports?.length) throw new Error('Nenhum resultado para exportar.');
  const first = svgExports[0];
  const img = new Image();
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(first.svg)}`;
  img.src = dataUri;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const canvas = document.createElement('canvas');
  canvas.width = first.svgW;
  canvas.height = first.svgH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  downloadBlob('optcut-arte.png', blob, 'image/png');
}

export function exportarPdf() {
  window.print();
}
