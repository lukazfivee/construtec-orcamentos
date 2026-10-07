import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import type { CompanyBodyModel } from '../shared/proposalBodyModels';
import { settingsApi } from './api';

type Props = { models: CompanyBodyModel[]; disabled: boolean; onChange: (models: CompanyBodyModel[]) => void; onNotice: (message: string) => void; onError: (message: string) => void };

// Modelos de proposta da empresa (corpo inteiro): renomear e excluir. Para trocar o conteudo, salve de novo com o mesmo nome na aba Corpo e condições.
export function CompanyBodyModelsList({ models, disabled, onChange, onNotice, onError }: Props) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<CompanyBodyModel[]>, done: string) => {
    setBusy(true);
    try { onChange(await action()); onNotice(done); }
    catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <span className="od-lbl plain">Modelos de proposta da empresa</span>
      <ul className="body-templates">
        {models.map((model) => {
          const value = names[model.id] ?? model.name;
          const changed = value.trim() !== model.name && value.trim().length > 0;
          return (
            <li key={model.id} className="body-model-row">
              <input aria-label={`Nome do modelo ${model.name}`} maxLength={80} value={value} disabled={disabled || busy} onChange={(event) => setNames((current) => ({ ...current, [model.id]: event.target.value }))} />
              <small>{model.blocks.length} blocos</small>
              {changed && <button type="button" className="body-icon" aria-label={`Salvar o novo nome de ${model.name}`} disabled={disabled || busy} onClick={() => void run(() => settingsApi.renameBodyModel(model.id, value.trim()).then((result) => { setNames((current) => ({ ...current, [model.id]: '' })); return result.models; }), 'Modelo renomeado.')}><Check size={16} /></button>}
              <button type="button" className="body-icon danger" aria-label={`Excluir o modelo ${model.name}`} disabled={disabled || busy} onClick={() => void run(() => settingsApi.deleteBodyModel(model.id).then((result) => result.models), 'Modelo excluído.')}><Trash2 size={16} /></button>
            </li>
          );
        })}
        {models.length === 0 && <li className="body-note">Nenhum modelo da empresa. Na aba Corpo e condições de uma proposta, use Salvar como modelo.</li>}
      </ul>
    </>
  );
}
