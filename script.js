const els = {
  sheetWidth: document.getElementById('sheetWidth'),
  sheetHeight: document.getElementById('sheetHeight'),
  sheetThickness: document.getElementById('sheetThickness'),
  sheetMaterial: document.getElementById('sheetMaterial'),
  sheetQty: document.getElementById('sheetQty'),
  kerf: document.getElementById('kerf'),
  margin: document.getElementById('margin'),
  partsBody: document.getElementById('partsBody'),
  partRowTemplate: document.getElementById('partRowTemplate'),
  addPartBtn: document.getElementById('addPartBtn'),
  calculateBtn: document.getElementById('calculateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  fileLoader: document.getElementById('fileLoader'),
  pdfBtn: document.getElementById('pdfBtn'),
  summary: document.getElementById('summary'),
  results: document.getElementById('results')
};

let lastResult = null;

function addPartRow(data = {}) {
  const row = els.partRowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.part-desc').value = data.description ?? '';
  row.querySelector('.part-width').value = data.width ?? 500;
  row.querySelector('.part-height').value = data.height ?? 300;
  row.querySelector('.part-qty').value = data.quantity ?? 1;
  const rotationValue = typeof data.rotation === 'boolean' ? data.rotation : true;
  row.querySelector('.part-rot').value = String(rotationValue);
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
  els.partsBody.appendChild(row);
}

function getInputNumber(input, label) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valor inválido em: ${label}`);
  return value;
}

function collectProject() {
  const sheet = {
    width: getInputNumber(els.sheetWidth, 'Largura da chapa'),
    height: getInputNumber(els.sheetHeight, 'Altura da chapa'),
    thickness: getInputNumber(els.sheetThickness, 'Espessura'),
    material: els.sheetMaterial.value.trim() || 'Não informado',
    quantity: Math.max(1, Math.floor(getInputNumber(els.sheetQty, 'Quantidade de chapas')))
  };

  const config = {
    kerf: getInputNumber(els.kerf, 'Kerf'),
    margin: getInputNumber(els.margin, 'Margem')
  };

  const rows = [...els.partsBody.querySelectorAll('tr')];
  const parts = rows.map((row, idx) => ({
    id: idx + 1,
    description: row.querySelector('.part-desc').value.trim() || `Peça ${idx + 1}`,
    width: Number(row.querySelector('.part-width').value),
    height: Number(row.querySelector('.part-height').value),
    quantity: Math.max(1, Math.floor(Number(row.querySelector('.part-qty').value))),
    rotation: row.querySelector('.part-rot').value === 'true'
  }));

  parts.forEach((part) => {
    if (!(part.width > 0 && part.height > 0)) {
      throw new Error(`Dimensão inválida na peça: ${part.description}`);
    }
  });

  return { sheet, config, parts };
}

function explodeParts(parts) {
  const items = [];
  parts.forEach((part) => {
    for (let i = 0; i < part.quantity; i += 1) {
      items.push({ ...part, unitIndex: i + 1, area: part.width * part.height });
    }
  });

  // Estratégia da heurística:
  // 1) Expandir quantidades em itens unitários.
  // 2) Ordenar por maior área (e maior lado) para posicionar primeiro peças grandes.
  // 3) Inserir em retângulos livres usando "Best Area Fit" (variante do MaxRects simplificado).
  // 4) Dividir os retângulos livres em até 4 regiões após cada corte (estilo MaxRects), considerando o kerf.
  return items.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area;
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });
}

function createSheet(index, sheet, margin) {
  return {
    index,
    width: sheet.width,
    height: sheet.height,
    innerWidth: sheet.width - margin * 2,
    innerHeight: sheet.height - margin * 2,
    margin,
    placements: [],
    freeRects: [{ x: margin, y: margin, w: sheet.width - margin * 2, h: sheet.height - margin * 2 }]
  };
}

function tryPlaceOnSheet(sheet, item, kerf) {
  let best = null;

  sheet.freeRects.forEach((rect, rectIndex) => {
    const candidates = [{ w: item.width, h: item.height, rotated: false }];
    if (item.rotation && item.width !== item.height) {
      candidates.push({ w: item.height, h: item.width, rotated: true });
    }

    candidates.forEach((candidate) => {
      const consumedW = candidate.w + (rect.w - candidate.w > 0 ? kerf : 0);
      const consumedH = candidate.h + (rect.h - candidate.h > 0 ? kerf : 0);

      if (consumedW <= rect.w && consumedH <= rect.h) {
        const score = rect.w * rect.h - consumedW * consumedH;
        const shortSide = Math.min(rect.w - consumedW, rect.h - consumedH);
        if (!best || score < best.score) {
          best = {
            rectIndex,
            rect,
            candidate,
            score,
            shortSide,
            consumedW,
            consumedH
          };
        } else if (best && score === best.score && shortSide < best.shortSide) {
          best = {
            rectIndex,
            rect,
            candidate,
            score,
            shortSide,
            consumedW,
            consumedH
          };
        }
      }
    });
  });

  if (!best) return null;

  const { rectIndex, rect, candidate } = best;
  const placement = {
    ...item,
    x: rect.x,
    y: rect.y,
    width: candidate.w,
    height: candidate.h,
    rotated: candidate.rotated
  };

  sheet.placements.push(placement);
  sheet.freeRects.splice(rectIndex, 1);

  const usedRect = { x: rect.x, y: rect.y, w: best.consumedW, h: best.consumedH };
  splitFreeRectsByUsedRect(sheet.freeRects, usedRect);
  pruneFreeRects(sheet.freeRects);

  return placement;
}

function intersects(a, b) {
  return !(
    b.x >= a.x + a.w
    || b.x + b.w <= a.x
    || b.y >= a.y + a.h
    || b.y + b.h <= a.y
  );
}

function splitFreeRectsByUsedRect(freeRects, usedRect) {
  for (let i = freeRects.length - 1; i >= 0; i -= 1) {
    const free = freeRects[i];
    if (!intersects(free, usedRect)) continue;

    freeRects.splice(i, 1);

    // Acima
    if (usedRect.y > free.y) {
      freeRects.push({
        x: free.x,
        y: free.y,
        w: free.w,
        h: usedRect.y - free.y
      });
    }

    // Abaixo
    if (usedRect.y + usedRect.h < free.y + free.h) {
      freeRects.push({
        x: free.x,
        y: usedRect.y + usedRect.h,
        w: free.w,
        h: free.y + free.h - (usedRect.y + usedRect.h)
      });
    }

    // Esquerda
    if (usedRect.x > free.x) {
      freeRects.push({
        x: free.x,
        y: free.y,
        w: usedRect.x - free.x,
        h: free.h
      });
    }

    // Direita
    if (usedRect.x + usedRect.w < free.x + free.w) {
      freeRects.push({
        x: usedRect.x + usedRect.w,
        y: free.y,
        w: free.x + free.w - (usedRect.x + usedRect.w),
        h: free.h
      });
    }
  }
}

function pruneFreeRects(freeRects) {
  for (let i = freeRects.length - 1; i >= 0; i -= 1) {
    const a = freeRects[i];
    if (a.w <= 0 || a.h <= 0) {
      freeRects.splice(i, 1);
      continue;
    }

    for (let j = 0; j < freeRects.length; j += 1) {
      if (i === j) continue;
      const b = freeRects[j];
      const aInsideB = a.x >= b.x
        && a.y >= b.y
        && a.x + a.w <= b.x + b.w
        && a.y + a.h <= b.y + b.h;
      if (aInsideB) {
        freeRects.splice(i, 1);
        break;
      }
    }
  }
}

function optimize(project) {
  const { sheet, config, parts } = project;
  const kerf = config.kerf;
  const margin = config.margin;

  if (sheet.width - margin * 2 <= 0 || sheet.height - margin * 2 <= 0) {
    throw new Error('Margem inválida: não sobra área útil na chapa.');
  }

  const items = explodeParts(parts);
  const sheets = [];
  const unallocated = [];

  items.forEach((item) => {
    let placed = false;

    for (const currentSheet of sheets) {
      if (tryPlaceOnSheet(currentSheet, item, kerf)) {
        placed = true;
        break;
      }
    }

    if (!placed && sheets.length < sheet.quantity) {
      const newSheet = createSheet(sheets.length + 1, sheet, margin);
      sheets.push(newSheet);
      if (tryPlaceOnSheet(newSheet, item, kerf)) {
        placed = true;
      }
    }

    if (!placed) {
      unallocated.push(item);
    }
  });

  const sheetArea = sheet.width * sheet.height;
  const totalAreaUsed = sheets.reduce(
    (sum, s) => sum + s.placements.reduce((acc, p) => acc + p.width * p.height, 0),
    0
  );
  const totalAreaAvailable = sheets.length * sheetArea;
  const utilization = totalAreaAvailable > 0 ? (totalAreaUsed / totalAreaAvailable) * 100 : 0;

  return {
    project,
    sheets,
    unallocated,
    stats: {
      usedSheets: sheets.length,
      totalSheets: sheet.quantity,
      totalPieces: items.length,
      allocatedPieces: items.length - unallocated.length,
      unallocatedPieces: unallocated.length,
      sheetArea,
      totalAreaUsed,
      totalAreaAvailable,
      utilization,
      wasteArea: Math.max(0, totalAreaAvailable - totalAreaUsed)
    }
  };
}

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 78%)`;
}

function renderSummary(result) {
  const { project, stats } = result;
  els.summary.classList.remove('empty');
  els.summary.innerHTML = `
    <div class="summary-grid">
      <div class="kpi"><div class="label">Material</div><div class="value">${project.sheet.material}</div></div>
      <div class="kpi"><div class="label">Espessura</div><div class="value">${project.sheet.thickness} mm</div></div>
      <div class="kpi"><div class="label">Chapas usadas</div><div class="value">${stats.usedSheets} / ${stats.totalSheets}</div></div>
      <div class="kpi"><div class="label">Peças alocadas</div><div class="value">${stats.allocatedPieces} / ${stats.totalPieces}</div></div>
      <div class="kpi"><div class="label">Aproveitamento</div><div class="value">${stats.utilization.toFixed(2)}%</div></div>
      <div class="kpi"><div class="label">Desperdício estimado</div><div class="value">${Math.round(stats.wasteArea)} mm²</div></div>
    </div>
  `;
}

function renderResults(result) {
  const { sheets, unallocated, project } = result;
  els.results.classList.remove('empty');

  if (!sheets.length) {
    els.results.innerHTML = '<p>Nenhuma peça foi alocada. Revise dimensões e quantidade de chapas.</p>';
    return;
  }

  const maxCanvasW = 920;

  els.results.innerHTML = '';
  sheets.forEach((sheet) => {
    const scale = Math.min(1, maxCanvasW / sheet.width);
    const displayW = Math.round(sheet.width * scale);
    const displayH = Math.round(sheet.height * scale);
    const usedArea = sheet.placements.reduce((acc, p) => acc + p.width * p.height, 0);
    const sheetArea = sheet.width * sheet.height;
    const usage = sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0;

    const block = document.createElement('article');
    block.className = 'sheet-block';
    block.innerHTML = `
      <div class="sheet-title">
        <strong>Chapa ${sheet.index}</strong>
        <span class="sheet-meta">${sheet.width}x${sheet.height} mm | aproveitamento ${usage.toFixed(2)}%</span>
      </div>
      <div class="sheet-canvas-wrap">
        <div class="sheet-canvas" style="width:${displayW}px; height:${displayH}px"></div>
      </div>
    `;

    const canvas = block.querySelector('.sheet-canvas');
    sheet.placements.forEach((piece) => {
      const pieceEl = document.createElement('div');
      pieceEl.className = 'piece';
      pieceEl.style.left = `${piece.x * scale}px`;
      pieceEl.style.top = `${piece.y * scale}px`;
      pieceEl.style.width = `${piece.width * scale}px`;
      pieceEl.style.height = `${piece.height * scale}px`;
      pieceEl.style.background = colorForName(piece.description);
      pieceEl.title = `${piece.description} (${piece.width}x${piece.height} mm${piece.rotated ? ', rotacionada' : ''})`;
      pieceEl.innerHTML = `<span>${piece.description}<br>${piece.width}x${piece.height}</span>`;
      canvas.appendChild(pieceEl);
    });

    els.results.appendChild(block);
  });

  if (unallocated.length) {
    const grouped = unallocated.reduce((map, item) => {
      const key = `${item.description}|${item.width}|${item.height}`;
      map[key] = map[key] || { ...item, count: 0 };
      map[key].count += 1;
      return map;
    }, {});

    const unallocEl = document.createElement('div');
    unallocEl.className = 'unallocated';
    unallocEl.innerHTML = '<h3>Peças não alocadas</h3>';

    Object.values(grouped).forEach((item) => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `${item.description} (${item.width}x${item.height}) x${item.count}`;
      unallocEl.appendChild(badge);
    });

    els.results.appendChild(unallocEl);
  }

  const cfg = document.createElement('p');
  cfg.className = 'note';
  cfg.textContent = `Configuração utilizada: kerf ${project.config.kerf} mm, margem ${project.config.margin} mm.`;
  els.results.appendChild(cfg);
}

function clearAll() {
  els.partsBody.innerHTML = '';
  addPartRow({ description: 'Lateral', width: 450, height: 300, quantity: 4, rotation: true });
  addPartRow({ description: 'Base', width: 700, height: 400, quantity: 2, rotation: false });
  els.summary.className = 'summary empty';
  els.summary.textContent = 'Nenhum cálculo executado.';
  els.results.className = 'results empty';
  els.results.innerHTML = 'Informe os dados e clique em <strong>Calcular</strong>.';
  lastResult = null;
}

function saveProject() {
  const project = collectProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `optcut-projeto-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadProject(project) {
  els.sheetWidth.value = project.sheet.width;
  els.sheetHeight.value = project.sheet.height;
  els.sheetThickness.value = project.sheet.thickness;
  els.sheetMaterial.value = project.sheet.material;
  els.sheetQty.value = project.sheet.quantity;
  els.kerf.value = project.config.kerf;
  els.margin.value = project.config.margin;
  els.partsBody.innerHTML = '';
  project.parts.forEach(addPartRow);
}

function boot() {
  els.addPartBtn.addEventListener('click', () => addPartRow());

  els.calculateBtn.addEventListener('click', () => {
    try {
      const project = collectProject();
      const result = optimize(project);
      lastResult = result;
      renderSummary(result);
      renderResults(result);
    } catch (error) {
      alert(error.message);
    }
  });

  els.clearBtn.addEventListener('click', clearAll);

  els.saveBtn.addEventListener('click', () => {
    try {
      saveProject();
    } catch (error) {
      alert(error.message);
    }
  });

  els.loadBtn.addEventListener('click', () => els.fileLoader.click());
  els.fileLoader.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = JSON.parse(text);
      loadProject(project);
      alert('Projeto carregado com sucesso.');
    } catch {
      alert('Arquivo JSON inválido.');
    } finally {
      event.target.value = '';
    }
  });

  els.pdfBtn.addEventListener('click', () => {
    if (!lastResult) {
      alert('Execute o cálculo antes de exportar.');
      return;
    }
    window.print();
  });

  clearAll();
}

boot();
