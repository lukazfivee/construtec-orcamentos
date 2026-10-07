import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LETTER_PLACE } from '../shared/proposalBody';
import type { CompanyBodyModel } from '../shared/proposalBodyModels';
import { proposalApi, settingsApi } from './api';

// Modelos de proposta salvos pela empresa e o local padrao da carta (Configuracoes), para os seletores de modelo.
export function useCompanyBodyModels() {
  const [models, setModels] = useState<CompanyBodyModel[]>([]);
  const [place, setPlace] = useState(DEFAULT_LETTER_PLACE);
  useEffect(() => {
    let alive = true;
    proposalApi.bodyModels().then((result) => { if (alive) setModels(result.models); }).catch(() => undefined);
    settingsApi.get().then((result) => { if (alive && result.settings.letterPlace) setPlace(result.settings.letterPlace); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const reload = useCallback(() => { void proposalApi.bodyModels().then((result) => setModels(result.models)).catch(() => undefined); }, []);
  return { models, setModels, place, reload };
}
