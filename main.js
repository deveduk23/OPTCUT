import { DEFAULT_CUT_CONFIG } from './models/config.js';
import { executarPlanejamento } from './services/report-service.js';
import { renderResumo, renderRelatorioPecas, renderResultados } from './render/renderer.js';
import { salvarProjetoJson, carregarProjetoJson } from './services/project-io.js';
import { exportarArteSvg, exportarArtePng, exportarPdf } from './exporters/exporters.js';

const els = {
  sheetWidth: document.getElementById('sheetWidth'),
  sheetHeight: document.getElementById('sheetHeight'),
  sheetQty: document.getElementById('sheetQty'),
  edgeMargin: document.getElementById('edgeMargin'),
  partGap: document.getElementById('partGap'),
  sheetMaterial: document.getElementById('sheetMaterial'),
  sheetThickness: document.getElementById('sheetThickness'),
  maxAttempts: document.getElementById('maxAttempts'),
  cutSpeed: document.getElementById('cutSpeed'),
  pierceTime: document.getElementById('pierceTime'),
  moveTime: document.getElementById('moveTime'),
  minuteRate: document.getElementById('minuteRate'),
  addPartBtn: document.getElementById('addPartBtn'),
  calculateBtn: document.getElementById('calculateBtn'),
  aggressiveBtn: document.getElementById('aggressiveBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  exportSvgBtn: document.getElementById('exportSvgBtn'),
  exportPngBtn: document.getElementById('exportPngBtn'),
  pdfBtn: document.getElementById('pdfBtn'),
  fileLoader: document.getElementById('fileLoader'),
  partsBody: document.getElementById('partsBody'),
  partRowTemplate: document.getElementById('partRowTemplate'),
  summary: document.getElementById('summary'),
  pieceReport: document.getElementById('pieceReport'),
  results: document.getElementById('results')
};

let lastPlan = null;
let lastSvgExports = [];

function num(el, label, min = 0) {
  const v = Number(el.value);
  if (!Number.isFinite(v) || v < min) throw new Error(`Valor inválido em ${label}`);
  return v;
}

function addPartRow(data = {}) {
  const row = els.partRowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.part-id').value = data.id ?? 'P1';
  row.querySelector('.part-name').value = data.nome ?? 'Peça';
  row.querySelector('.part-width').value = data.largura ?? 500;
  row.querySelector('.part-height').value = data.altura ?? 300;
  row.querySelector('.part-qty').value = data.quantidade ?? 1;
  row.querySelector('.part-cut').value = data.comprimentoCorteMm ?? 1600;
  row.querySelector('.part-pierce').value = data.perfuracoes ?? 1;
  row.querySelector('.part-rotation').value = String(data.rotacaoPermitida ?? true);
  row.querySelector('.part-thickness').value = data.espessura ?? 1.2;
  row.querySelector('.part-material').value = data.material ?? 'Aço carbono';
  row.querySelector('.part-gap').value = data.margemEntrePecas ?? num(els.partGap, 'margem entre peças');
  row.querySelector('.part-priority').value = data.prioridadeOpcional ?? 0;
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
  els.partsBody.appendChild(row);
}

function coletarProjeto() {
  const chapa = {
    largura: num(els.sheetWidth, 'largura chapa', 1),
    altura: num(els.sheetHeight, 'altura chapa', 1),
    quantidadeDisponivel: Math.floor(num(els.sheetQty, 'qtd chapas', 1)),
    margemBorda: num(els.edgeMargin, 'margem borda', 0),
    margemEntrePecas: num(els.partGap, 'margem entre peças', 0),
    material: els.sheetMaterial.value.trim() || 'N/I',
    espessura: num(els.sheetThickness, 'espessura chapa', 0)
  };

  const configuracaoCorte = {
    velocidadeEfetivaMmMin: num(els.cutSpeed, 'velocidade efetiva', 0.01),
    tempoPorPerfuracaoMin: num(els.pierceTime, 'tempo perfuração', 0),
    tempoMovimentosMin: num(els.moveTime, 'tempo movimentos', 0),
    valorMinutoMaquina: num(els.minuteRate, 'valor minuto', 0)
  };

  const pecas = [...els.partsBody.querySelectorAll('tr')].map((row, idx) => ({
    id: row.querySelector('.part-id').value.trim() || `P${idx + 1}`,
    nome: row.querySelector('.part-name').value.trim() || `Peça ${idx + 1}`,
    largura: Number(row.querySelector('.part-width').value),
    altura: Number(row.querySelector('.part-height').value),
    quantidade: Math.floor(Number(row.querySelector('.part-qty').value)),
    comprimentoCorteMm: Number(row.querySelector('.part-cut').value),
    perfuracoes: Math.floor(Number(row.querySelector('.part-pierce').value)),
    rotacaoPermitida: row.querySelector('.part-rotation').value === 'true',
    espessura: Number(row.querySelector('.part-thickness').value),
    material: row.querySelector('.part-material').value.trim() || chapa.material,
    margemEntrePecas: Number(row.querySelector('.part-gap').value),
    prioridadeOpcional: Number(row.querySelector('.part-priority').value) || 0
  }));

  if (!pecas.length) throw new Error('Cadastre ao menos uma peça.');
  pecas.forEach((p) => {
    if (!(p.largura > 0 && p.altura > 0 && p.quantidade > 0)) throw new Error(`Dados inválidos na peça ${p.id}`);
    if (!(p.comprimentoCorteMm >= 0 && p.perfuracoes >= 0)) throw new Error(`Corte/perfuração inválidos na peça ${p.id}`);
  });

  return {
    chapa,
    configuracaoCorte,
    pecas,
    maxTentativasOtimizacao: Math.floor(num(els.maxAttempts, 'tentativas', 1))
  };
}

function renderPlan(plan) {
  renderResumo(els.summary, plan.resumoGeral);
  renderRelatorioPecas(els.pieceReport, plan.indicadoresPecas);
  lastSvgExports = renderResultados(els.results, plan);
}

function calcular(agressivo = false) {
  const projeto = coletarProjeto();
  const plan = executarPlanejamento(projeto, agressivo);
  lastPlan = plan;
  renderPlan(plan);
}

function carregarProjetoNaTela(projeto) {
  els.sheetWidth.value = projeto.chapa.largura;
  els.sheetHeight.value = projeto.chapa.altura;
  els.sheetQty.value = projeto.chapa.quantidadeDisponivel;
  els.edgeMargin.value = projeto.chapa.margemBorda;
  els.partGap.value = projeto.chapa.margemEntrePecas;
  els.sheetMaterial.value = projeto.chapa.material || 'Aço carbono';
  els.sheetThickness.value = projeto.chapa.espessura || 1.2;

  const cut = { ...DEFAULT_CUT_CONFIG, ...(projeto.configuracaoCorte || {}) };
  els.cutSpeed.value = cut.velocidadeEfetivaMmMin;
  els.pierceTime.value = cut.tempoPorPerfuracaoMin;
  els.moveTime.value = cut.tempoMovimentosMin;
  els.minuteRate.value = cut.valorMinutoMaquina;
  els.maxAttempts.value = projeto.maxTentativasOtimizacao || 120;

  els.partsBody.innerHTML = '';
  (projeto.pecas || []).forEach((p) => addPartRow(p));
}

function limpar() {
  els.partsBody.innerHTML = '';
  addPartRow({ id: 'P1', nome: 'Lateral', largura: 450, altura: 300, quantidade: 14, comprimentoCorteMm: 1500, perfuracoes: 1, rotacaoPermitida: true });
  addPartRow({ id: 'P2', nome: 'Base', largura: 700, altura: 400, quantidade: 2, comprimentoCorteMm: 2200, perfuracoes: 1, rotacaoPermitida: true });
  els.summary.className = 'summary empty';
  els.summary.textContent = 'Nenhum cálculo executado.';
  els.pieceReport.className = 'summary empty';
  els.pieceReport.textContent = 'Nenhum cálculo executado.';
  els.results.className = 'results empty';
  els.results.innerHTML = 'Informe os dados e clique em <strong>Calcular</strong>.';
  lastPlan = null;
  lastSvgExports = [];
}

function bind() {
  els.addPartBtn.addEventListener('click', () => addPartRow());
  els.calculateBtn.addEventListener('click', () => { try { calcular(false); } catch (e) { alert(e.message); } });
  els.aggressiveBtn.addEventListener('click', () => { try { calcular(true); } catch (e) { alert(e.message); } });
  els.clearBtn.addEventListener('click', limpar);

  els.saveBtn.addEventListener('click', () => {
    try { salvarProjetoJson(coletarProjeto()); } catch (e) { alert(e.message); }
  });

  els.loadBtn.addEventListener('click', () => els.fileLoader.click());
  els.fileLoader.addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const projeto = await carregarProjetoJson(file);
      carregarProjetoNaTela(projeto);
      alert('Projeto carregado com sucesso.');
    } catch {
      alert('JSON inválido.');
    }
    ev.target.value = '';
  });

  els.exportSvgBtn.addEventListener('click', () => {
    try { exportarArteSvg(lastSvgExports); } catch (e) { alert(e.message); }
  });
  els.exportPngBtn.addEventListener('click', async () => {
    try { await exportarArtePng(lastSvgExports); } catch (e) { alert(e.message); }
  });
  els.pdfBtn.addEventListener('click', () => {
    if (!lastPlan) return alert('Calcule o layout antes de exportar PDF.');
    exportarPdf();
  });
}

bind();
limpar();
