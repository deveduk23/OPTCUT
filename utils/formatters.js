export function formatarNumero(valor, casas = 2) {
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarMoedaBRL(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarTempo(minutosDecimais) {
  const totalSeg = Math.max(0, Math.round(Number(minutosDecimais) * 60));
  const mm = String(Math.floor(totalSeg / 60)).padStart(2, '0');
  const ss = String(totalSeg % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function mmParaMetros(mm) {
  return Number(mm) / 1000;
}
