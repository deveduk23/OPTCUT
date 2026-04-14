export function salvarProjetoJson(projeto) {
  const blob = new Blob([JSON.stringify(projeto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `optcut-projeto-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function carregarProjetoJson(file) {
  const raw = await file.text();
  return JSON.parse(raw);
}
