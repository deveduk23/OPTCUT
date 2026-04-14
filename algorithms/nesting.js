import { normalizarDimensoesPeca } from '../models/config.js';

function rand(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function embaralhar(arr, seed) {
  const r = rand(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function gerarInstanciasDasPecas(pecas) {
  const inst = [];
  pecas.map(normalizarDimensoesPeca).forEach((p) => {
    for (let i = 0; i < p.quantidade; i += 1) {
      inst.push({
        ...p,
        instancia: i + 1,
        area: p.largura * p.altura,
        margemEntrePecas: Number.isFinite(p.margemEntrePecas) ? p.margemEntrePecas : 0
      });
    }
  });
  return inst;
}

function createSheet(chapa, index) {
  return {
    index,
    width: chapa.largura,
    height: chapa.altura,
    placements: [],
    freeRects: [{ x: chapa.margemBorda, y: chapa.margemBorda, w: chapa.largura - chapa.margemBorda * 2, h: chapa.altura - chapa.margemBorda * 2 }]
  };
}

function intersects(a, b) {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y);
}

function prune(rects) {
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const a = rects[i];
    if (a.w <= 0 || a.h <= 0) { rects.splice(i, 1); continue; }
    for (let j = 0; j < rects.length; j += 1) {
      if (i === j) continue;
      const b = rects[j];
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        rects.splice(i, 1);
        break;
      }
    }
  }
}

function splitByUsed(freeRects, used) {
  for (let i = freeRects.length - 1; i >= 0; i -= 1) {
    const fr = freeRects[i];
    if (!intersects(fr, used)) continue;
    freeRects.splice(i, 1);
    if (used.y > fr.y) freeRects.push({ x: fr.x, y: fr.y, w: fr.w, h: used.y - fr.y });
    if (used.y + used.h < fr.y + fr.h) freeRects.push({ x: fr.x, y: used.y + used.h, w: fr.w, h: fr.y + fr.h - (used.y + used.h) });
    if (used.x > fr.x) freeRects.push({ x: fr.x, y: fr.y, w: used.x - fr.x, h: fr.h });
    if (used.x + used.w < fr.x + fr.w) freeRects.push({ x: used.x + used.w, y: fr.y, w: fr.x + fr.w - (used.x + used.w), h: fr.h });
  }
  prune(freeRects);
}

function avaliarEncaixe(item, rect, rotated, gapPadrao) {
  const w = rotated ? item.altura : item.largura;
  const h = rotated ? item.largura : item.altura;
  const gap = Math.max(gapPadrao, item.margemEntrePecas || 0);
  const consumedW = w + (rect.w > w ? gap : 0);
  const consumedH = h + (rect.h > h ? gap : 0);
  if (consumedW > rect.w || consumedH > rect.h) return null;
  const leftoverArea = rect.w * rect.h - consumedW * consumedH;
  const shortSide = Math.min(rect.w - consumedW, rect.h - consumedH);
  return { w, h, consumedW, consumedH, leftoverArea, shortSide, rotated };
}

export function posicionarPecasNaChapa(items, chapa, gapPadrao) {
  const sheets = [];
  const unallocated = [];

  for (const item of items) {
    let placed = false;
    for (const sheet of sheets) {
      const best = encontrarMelhor(sheet, item, gapPadrao);
      if (best) { aplicarPosicao(sheet, item, best); placed = true; break; }
    }

    if (!placed && sheets.length < chapa.quantidadeDisponivel) {
      const sheet = createSheet(chapa, sheets.length + 1);
      sheets.push(sheet);
      const best = encontrarMelhor(sheet, item, gapPadrao);
      if (best) { aplicarPosicao(sheet, item, best); placed = true; }
    }

    if (!placed) unallocated.push(item);
  }

  return { sheets, unallocated };
}

function encontrarMelhor(sheet, item, gapPadrao) {
  let best = null;
  sheet.freeRects.forEach((rect, rectIndex) => {
    const candidatas = [avaliarEncaixe(item, rect, false, gapPadrao)];
    if (item.rotacaoPermitida) candidatas.push(avaliarEncaixe(item, rect, true, gapPadrao));
    candidatas.filter(Boolean).forEach((c) => {
      if (!best || c.leftoverArea < best.leftoverArea || (c.leftoverArea === best.leftoverArea && c.shortSide < best.shortSide)) {
        best = { ...c, rectIndex, rect };
      }
    });
  });
  return best;
}

function aplicarPosicao(sheet, item, best) {
  const placement = { ...item, x: best.rect.x, y: best.rect.y, larguraUsada: best.w, alturaUsada: best.h, rotated: best.rotated };
  sheet.placements.push(placement);
  sheet.freeRects.splice(best.rectIndex, 1);
  splitByUsed(sheet.freeRects, { x: best.rect.x, y: best.rect.y, w: best.consumedW, h: best.consumedH });
}

export function calcularAproveitamentoChapa(sheet) {
  const areaTotal = sheet.width * sheet.height;
  const areaOcupada = sheet.placements.reduce((s, p) => s + p.larguraUsada * p.alturaUsada, 0);
  const aproveitamento = areaTotal > 0 ? (areaOcupada / areaTotal) * 100 : 0;
  return { areaTotal, areaOcupada, areaSobra: Math.max(0, areaTotal - areaOcupada), aproveitamento };
}

function scoreResultado(resultado, chapa) {
  const usedSheets = resultado.sheets.length;
  const areaTotal = usedSheets * chapa.largura * chapa.altura;
  const areaOcupada = resultado.sheets.reduce((s, sh) => s + calcularAproveitamentoChapa(sh).areaOcupada, 0);
  const util = areaTotal > 0 ? areaOcupada / areaTotal : 0;
  return util * 100000 + (resultado.sheets.length ? 1000 - usedSheets : 0) + (100 - resultado.unallocated.length);
}

export function otimizarDistribuicao(pecas, chapa, cfg = { agressivo: false, maxTentativas: 100, gapPadrao: 0 }) {
  const instancias = gerarInstanciasDasPecas(pecas);
  const baseOrdenada = [...instancias].sort((a, b) => {
    if ((b.prioridadeOpcional || 0) !== (a.prioridadeOpcional || 0)) return (b.prioridadeOpcional || 0) - (a.prioridadeOpcional || 0);
    if (b.area !== a.area) return b.area - a.area;
    return Math.max(b.largura, b.altura) - Math.max(a.largura, a.altura);
  });

  const tentativas = cfg.agressivo ? Math.max(1, cfg.maxTentativas) : 1;
  let best = null;

  for (let i = 0; i < tentativas; i += 1) {
    const order = i === 0 ? baseOrdenada : embaralhar(baseOrdenada, 97 + i * 11);
    const resultado = posicionarPecasNaChapa(order, chapa, cfg.gapPadrao);
    const score = scoreResultado(resultado, chapa);
    if (!best || score > best.score) best = { ...resultado, score, tentativa: i + 1 };
  }

  return best;
}
