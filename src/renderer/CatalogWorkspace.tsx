import { useEffect, useState } from 'react';
import { catalogApi } from './api';
import { CatalogEditor } from './CatalogEditor';
import { CatalogHome } from './CatalogHome';
import { CatalogImportPage } from './CatalogImportPage';
import { ExsatPage } from './ExsatPage';
import { useCanEdit, useSuitePermission } from './SuitePermissions';
import { useCatalogOverview } from './useCatalogOverview';
import { useExsatSync } from './useExsatSync';

type Props = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onOpenProposal?: (proposalId: string) => void;
};
type View = 'catalogo' | 'importar' | 'exsat' | 'editar';

// Catalogo no computador (Rodada 24): catalogo com o cartao do EXSAT, importar lista, integracao EXSAT.
// O cadastro item a item (formulario) continua em "Cadastrar itens".
export function CatalogWorkspace({ onNotice, onError, onOpenProposal }: Props) {
  const [view, setView] = useState<View>('catalogo');
  const [hints, setHints] = useState<string[]>([]);
  const data = useCatalogOverview();
  const sync = useExsatSync(data.reload);
  const seesCost = useSuitePermission('p10');
  const canEdit = useCanEdit();
  const canWrite = seesCost && canEdit;

  useEffect(() => {
    if (view !== 'importar' || !canWrite) return;
    let active = true;
    void catalogApi.list('').then((result) => {
      if (!active) return;
      const count = new Map<string, number>();
      for (const product of result.products) {
        const source = product.source.trim();
        if (source && !['CONSTRUTEC', 'IMPORTAÇÃO', 'MANUAL', 'IMAGEM'].includes(source.toUpperCase())) count.set(source, (count.get(source) ?? 0) + 1);
      }
      setHints([...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [view, canWrite]);

  const back = () => setView('catalogo');
  if (view === 'editar') return <CatalogEditor key="editor" onNotice={onNotice} onError={onError} onBack={() => { back(); void data.reload(); }} />;
  if (view === 'importar') return <CatalogImportPage key="import" canWrite={canWrite} catalogCount={data.overview?.productCount ?? 0} supplierHints={hints} usedIn={(code) => data.overview?.items.find((item) => item.code === code)?.usedIn ?? []}
    onImported={() => void data.reload()} onBack={back} onNotice={onNotice} />;
  if (view === 'exsat') return <ExsatPage key="exsat" data={data} sync={sync} seesCost={seesCost} canWrite={canWrite} canEdit={canEdit} onBack={back}
    onOpenProposal={(id) => onOpenProposal?.(id)} onNotice={onNotice} onError={onError} />;
  return <CatalogHome key="home" data={data} sync={sync} seesCost={seesCost} canWrite={canWrite}
    onImport={() => setView('importar')} onExsat={() => setView('exsat')} onEdit={() => setView('editar')} />;
}
