export const EXPORT_LINE_SCALE = 2;

export const DEFAULT_CUT_CONFIG = {
  velocidadeEfetivaMmMin: 1350,
  tempoPorPerfuracaoMin: 0.03,
  tempoMovimentosMin: 0,
  valorMinutoMaquina: 13.13
};

export function normalizarDimensoesPeca(peca) {
  const largura = Number(peca.largura);
  const altura = Number(peca.altura);
  if (!(largura > 0 && altura > 0)) throw new Error(`Dimensão inválida na peça ${peca.nome || peca.id}`);
  return { ...peca, largura, altura };
}
