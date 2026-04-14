import { otimizarDistribuicao, calcularAproveitamentoChapa } from '../algorithms/nesting.js';
import { calcularIndicadoresPeca } from './cutting-calculator.js';

export function executarPlanejamento(projeto, agressivo = false) {
  const { chapa, configuracaoCorte, pecas } = projeto;

  const indicadoresPecas = pecas.map((p) => calcularIndicadoresPeca(p, configuracaoCorte));
  const layout = otimizarDistribuicao(pecas, chapa, {
    agressivo,
    maxTentativas: projeto.maxTentativasOtimizacao,
    gapPadrao: chapa.margemEntrePecas
  });

  const mapa = new Map(indicadoresPecas.map((p) => [p.id, p]));

  const sheetsComMetricas = layout.sheets.map((sheet) => {
    const usage = calcularAproveitamentoChapa(sheet);
    const tempoChapaMin = sheet.placements.reduce((acc, pl) => acc + (mapa.get(pl.id)?.tempoPorPecaMin || 0), 0);
    const custoChapa = sheet.placements.reduce((acc, pl) => acc + (mapa.get(pl.id)?.custoPorPeca || 0), 0);
    return { ...sheet, ...usage, tempoChapaMin, custoChapa };
  });

  const tempoTotalGeralMin = sheetsComMetricas.reduce((a, s) => a + s.tempoChapaMin, 0);
  const custoTotalGeral = sheetsComMetricas.reduce((a, s) => a + s.custoChapa, 0);
  const areaOcupadaTotal = sheetsComMetricas.reduce((a, s) => a + s.areaOcupada, 0);
  const areaSobraTotal = sheetsComMetricas.reduce((a, s) => a + s.areaSobra, 0);
  const totalPecasAlocadas = sheetsComMetricas.reduce((a, s) => a + s.placements.length, 0);
  const aproveitamentoMedio = sheetsComMetricas.length
    ? sheetsComMetricas.reduce((a, s) => a + s.aproveitamento, 0) / sheetsComMetricas.length
    : 0;

  return {
    projeto,
    indicadoresPecas,
    sheets: sheetsComMetricas,
    unallocated: layout.unallocated,
    resumoGeral: {
      totalChapasUsadas: sheetsComMetricas.length,
      aproveitamentoMedio,
      tempoTotalGeralMin,
      custoTotalGeral,
      quantidadeTotalPecas: pecas.reduce((a, p) => a + p.quantidade, 0),
      totalPecasAlocadas,
      areaOcupadaTotal,
      areaSobraTotal,
      tentativaSelecionada: layout.tentativa
    }
  };
}
