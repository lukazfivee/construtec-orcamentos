// Uso dos itens nas propostas, mudancas de preco e itens novos (catalogo e EXSAT no computador, Rodada 24).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogOverview, PriceDriftProposal } from '../shared/contracts';
import { catalogApi, priceDriftApi } from './api';

export type DriftRow = { code: string; description: string; unit: string; pct: number; from?: number; to?: number; used: string[] };

// Uma linha por codigo, juntando as propostas em edicao que usam o item (mesma ideia do celular).
export const driftRowsByCode = (proposals: PriceDriftProposal[]): DriftRow[] => {
  const map = new Map<string, DriftRow>();
  for (const proposal of proposals) for (const item of proposal.items) {
    const row = map.get(item.code) ?? { code: item.code, description: item.description, unit: item.unit, pct: item.changePercent, from: item.fromUnit, to: item.toUnit, used: [] };
    if (!row.used.includes(proposal.number)) row.used.push(proposal.number);
    map.set(item.code, row);
  }
  return [...map.values()];
};

export function useCatalogOverview() {
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [drift, setDrift] = useState<PriceDriftProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ offline: boolean; message: string } | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError(null);
    try {
      const [ov, dr] = await Promise.all([catalogApi.overview(), priceDriftApi.list()]);
      if (mine !== seq.current) return;
      setOverview(ov.overview); setDrift(dr.proposals);
    } catch (loadError) {
      if (mine !== seq.current) return;
      const message = loadError instanceof Error ? loadError.message : 'O servidor não respondeu.';
      setError({ offline: typeof navigator !== 'undefined' && navigator.onLine === false, message });
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); return () => { seq.current += 1; }; }, [reload]);

  return { overview, drift, rows: driftRowsByCode(drift), loading, error, reload };
}

export type CatalogOverviewData = ReturnType<typeof useCatalogOverview>;
