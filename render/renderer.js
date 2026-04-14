import { EXPORT_LINE_SCALE } from '../models/config.js';
import { formatarMoedaBRL, formatarNumero, formatarTempo, mmParaMetros } from '../utils/formatters.js';

function corPorId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = id.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},70%,78%)`;
}

export function renderResumo(resumoEl, resumo) {
  resumoEl.classList.remove('empty');
  resumoEl.innerHTML = `
    <div class="summary-grid">
      <div class="kpi"><div class="label">Chapas usadas</div><div class="value">${resumo.totalChapasUsadas}</div></div>
      <div class="kpi"><div class="label">Aproveitamento médio</div><div class="value">${formatarNumero(resumo.aproveitamentoMedio,2)}%</div></div>
      <div class="kpi"><div class="label">Tempo total</div><div class="value">${formatarTempo(resumo.tempoTotalGeralMin)} (${formatarNumero(resumo.tempoTotalGeralMin,3)} min)</div></div>
      <div class="kpi"><div class="label">Custo total geral</div><div class="value">${formatarMoedaBRL(resumo.custoTotalGeral)}</div></div>
      <div class="kpi"><div class="label">Peças totais / alocadas</div><div class="value">${resumo.quantidadeTotalPecas} / ${resumo.totalPecasAlocadas}</div></div>
      <div class="kpi"><div class="label">Área ocupada / sobra</div><div class="value">${formatarNumero(resumo.areaOcupadaTotal,0)} / ${formatarNumero(resumo.areaSobraTotal,0)} mm²</div></div>
      <div class="kpi"><div class="label">Tentativa vencedora</div><div class="value">#${resumo.tentativaSelecionada}</div></div>
    </div>`;
}

export function renderRelatorioPecas(el, pecas) {
  el.classList.remove('empty');
  el.innerHTML = `<div class="summary-grid">${pecas.map((p) => `
      <div class="kpi">
        <div class="label">${p.id} - ${p.nome}</div>
        <div class="value">Área: ${formatarNumero(p.areaMm2,2)} mm²</div>
        <div class="value">Tempo/peça: ${formatarTempo(p.tempoPorPecaMin)} (${formatarNumero(p.tempoPorPecaMin,3)} min)</div>
        <div class="value">Tempo lote: ${formatarTempo(p.tempoTotalLoteMin)}</div>
        <div class="value">Comp. total: ${formatarNumero(mmParaMetros(p.comprimentoTotalMm),3)} m</div>
        <div class="value">Perf. totais: ${formatarNumero(p.perfuracoesTotais,0)}</div>
        <div class="value">Custo/peça: ${formatarMoedaBRL(p.custoPorPeca)}</div>
        <div class="value">Custo lote: ${formatarMoedaBRL(p.custoTotal)}</div>
      </div>`).join('')}</div>`;
}

function createSheetSvg(sheet, maxWidth = 1000) {
  const scale = Math.min(1, maxWidth / sheet.width);
  const svgW = Math.round(sheet.width * scale);
  const svgH = Math.round(sheet.height * scale);
  const stroke = 1 * EXPORT_LINE_SCALE;
  const parts = sheet.placements.map((p) => {
    const x = p.x * scale;
    const y = p.y * scale;
    const w = p.larguraUsada * scale;
    const h = p.alturaUsada * scale;
    return `
      <g>
        <rect class="piece-shape" x="${x}" y="${y}" width="${w}" height="${h}" fill="${corPorId(p.id)}" stroke-width="${stroke}" />
        <text class="piece-label" x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle">${p.id}${p.rotated ? ' (R)' : ''}</text>
      </g>`;
  }).join('');

  const svg = `<svg class="sheet-svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
  return { svg, svgW, svgH };
}

export function renderResultados(el, plan) {
  el.classList.remove('empty');
  if (!plan.sheets.length) {
    el.innerHTML = '<p>Nenhuma peça alocada nas chapas disponíveis.</p>';
    return [];
  }

  const svgExports = [];

  el.innerHTML = '';
  plan.sheets.forEach((sheet) => {
    const art = createSheetSvg(sheet);
    svgExports.push({ id: `chapa-${sheet.index}`, ...art });

    const block = document.createElement('article');
    block.className = 'sheet-block';
    block.innerHTML = `
      <div class="sheet-title">
        <strong>Chapa ${sheet.index}</strong>
        <span class="sheet-meta">aproveitamento ${formatarNumero(sheet.aproveitamento,2)}% | sobra ${formatarNumero(sheet.areaSobra,0)} mm² | tempo ${formatarTempo(sheet.tempoChapaMin)} | custo ${formatarMoedaBRL(sheet.custoChapa)}</span>
      </div>
      <div class="canvas-wrap">${art.svg}</div>
    `;
    el.appendChild(block);
  });

  if (plan.unallocated.length) {
    const un = document.createElement('div');
    un.className = 'unallocated';
    un.innerHTML = '<h3>Peças não alocadas</h3>';
    plan.unallocated.forEach((p) => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `${p.id} ${p.largura}x${p.altura}`;
      un.appendChild(badge);
    });
    el.appendChild(un);
  }

  return svgExports;
}
