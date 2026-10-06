// Registro simples de telas com alterações ainda não salvas. Quem edita um rascunho chama setUnsavedChanges(origem, true)
// enquanto ele está sujo; o atualizador consulta antes de reiniciar o aplicativo para não perder edição em andamento.
const sources = new Set<string>();

export function setUnsavedChanges(source: string, dirty: boolean): void {
  if (dirty) sources.add(source);
  else sources.delete(source);
}

export const hasUnsavedChanges = (): boolean => sources.size > 0;
