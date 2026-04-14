export function calcularTempoPeca({ comprimentoCorteMm, perfuracoes, quantidade }, corteCfg) {
  const tempoPorPecaMin =
    (comprimentoCorteMm / corteCfg.velocidadeEfetivaMmMin)
    + (perfuracoes * corteCfg.tempoPorPerfuracaoMin)
    + (corteCfg.tempoMovimentosMin || 0);

  return {
    tempoPorPecaMin,
    tempoTotalLoteMin: tempoPorPecaMin * quantidade,
    comprimentoTotalMm: comprimentoCorteMm * quantidade,
    perfuracoesTotais: perfuracoes * quantidade
  };
}

export function calcularCustoPeca(tempoPorPecaMin, quantidade, corteCfg) {
  const custoPorPeca = tempoPorPecaMin * corteCfg.valorMinutoMaquina;
  return { custoPorPeca, custoTotal: custoPorPeca * quantidade };
}

export function calcularIndicadoresPeca(peca, corteCfg) {
  const areaMm2 = peca.largura * peca.altura;
  const tempo = calcularTempoPeca(peca, corteCfg);
  const custo = calcularCustoPeca(tempo.tempoPorPecaMin, peca.quantidade, corteCfg);
  return { ...peca, areaMm2, ...tempo, ...custo };
}
