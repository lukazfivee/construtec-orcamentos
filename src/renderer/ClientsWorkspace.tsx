import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, MapPin, Pencil, Plus, Save, Search, Users } from 'lucide-react';
import type { ClientRecord, WorkRecord } from '../shared/contracts';
import { clientsApi } from './api';

type ClientsWorkspaceProps = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

type ClientDraft = {
  legalName: string;
  tradeName: string;
  document: string;
};

type WorkDraft = {
  id: string | null;
  name: string;
  address: string;
  active: boolean;
};

const emptyClient: ClientDraft = { legalName: '', tradeName: '', document: '' };
const emptyWork: WorkDraft = { id: null, name: '', address: '', active: true };

const displayName = (client: ClientRecord) => client.tradeName?.trim() || client.legalName;

export function ClientsWorkspace({ onNotice, onError }: ClientsWorkspaceProps) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(emptyClient);
  const [workDraft, setWorkDraft] = useState<WorkDraft>(emptyWork);
  const [creatingClient, setCreatingClient] = useState(false);
  const [editingWork, setEditingWork] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const applyClients = (nextClients: ClientRecord[], preferredClientId?: string | null) => {
    setClients(nextClients);
    const nextSelectedId = preferredClientId ?? selectedClientId ?? nextClients[0]?.id ?? null;
    setSelectedClientId(nextClients.some((client) => client.id === nextSelectedId) ? nextSelectedId : nextClients[0]?.id ?? null);
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await clientsApi.list(query);
        if (active) applyClients(result.clients);
      } catch (loadError) {
        if (active) onError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os clientes.');
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!selectedClient || creatingClient) return;
    setClientDraft({
      legalName: selectedClient.legalName,
      tradeName: selectedClient.tradeName ?? '',
      document: selectedClient.document ?? '',
    });
    setEditingWork(false);
    setWorkDraft(emptyWork);
  }, [creatingClient, selectedClient]);

  const selectClient = (clientId: string) => {
    setCreatingClient(false);
    setSelectedClientId(clientId);
  };

  const beginClient = () => {
    setCreatingClient(true);
    setSelectedClientId(null);
    setClientDraft(emptyClient);
    setEditingWork(false);
    setWorkDraft(emptyWork);
  };

  const saveClient = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientDraft.legalName.trim() || saving) return;
    setSaving(true);
    try {
      const input = {
        legalName: clientDraft.legalName.trim(),
        tradeName: clientDraft.tradeName.trim() || null,
        document: clientDraft.document.trim() || null,
      };
      if (creatingClient) {
        const result = await clientsApi.create(input);
        applyClients(result.clients, result.clientId);
        setCreatingClient(false);
        onNotice('Cliente cadastrado e salvo localmente.');
      } else if (selectedClient) {
        const result = await clientsApi.update(selectedClient.id, input);
        applyClients(result.clients, selectedClient.id);
        onNotice('Dados do cliente atualizados.');
      }
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  const beginWork = (work?: WorkRecord) => {
    setEditingWork(true);
    setWorkDraft(work ? { id: work.id, name: work.name, address: work.address ?? '', active: work.active } : emptyWork);
  };

  const saveWork = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClient || !workDraft.name.trim() || saving) return;
    setSaving(true);
    try {
      if (workDraft.id) {
        const result = await clientsApi.updateWork(selectedClient.id, workDraft.id, {
          name: workDraft.name.trim(),
          address: workDraft.address.trim() || null,
          active: workDraft.active,
        });
        applyClients(result.clients, selectedClient.id);
        onNotice('Obra atualizada.');
      } else {
        const result = await clientsApi.createWork(selectedClient.id, {
          name: workDraft.name.trim(),
          address: workDraft.address.trim() || null,
        });
        applyClients(result.clients, selectedClient.id);
        onNotice('Obra cadastrada e vinculada ao cliente.');
      }
      setEditingWork(false);
      setWorkDraft(emptyWork);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a obra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="management-workspace">
      <header className="management-header">
        <div><Users size={20} /><span><h1>Clientes e obras</h1><p>Cadastros locais usados na criação dos orçamentos.</p></span></div>
        <button className="primary" type="button" onClick={beginClient}><Plus size={17} /> Novo cliente</button>
      </header>

      <div className="management-body">
        <aside className="client-list-pane" aria-label="Lista de clientes">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou documento" aria-label="Buscar clientes" /></label>
          <div className="client-list" aria-busy={loading}>
            {loading && <p className="management-empty">Carregando clientes locais…</p>}
            {!loading && clients.map((client) => (
              <button key={client.id} type="button" className={client.id === selectedClientId && !creatingClient ? 'selected' : ''} onClick={() => selectClient(client.id)}>
                <Building2 size={17} />
                <span><b>{displayName(client)}</b><small>{client.document || client.legalName}</small></span>
                <em>{client.works.length} {client.works.length === 1 ? 'obra' : 'obras'}</em>
              </button>
            ))}
            {!loading && clients.length === 0 && <p className="management-empty">Nenhum cliente encontrado.</p>}
          </div>
        </aside>

        <section className="client-editor" aria-label={creatingClient ? 'Cadastrar cliente' : 'Editar cliente'}>
          {(creatingClient || selectedClient) ? (
            <>
              <form className="client-form" onSubmit={(event) => void saveClient(event)}>
                <div className="editor-heading">
                  <span><h2>{creatingClient ? 'Novo cliente' : selectedClient ? displayName(selectedClient) : 'Cliente'}</h2><p>{creatingClient ? 'Preencha os dados essenciais para começar.' : 'Dados gerais do cliente'}</p></span>
                  <button className="primary" type="submit" disabled={saving || !clientDraft.legalName.trim()}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar cliente'}</button>
                </div>
                <div className="form-grid">
                  <label className="wide"><span>Razão social <b aria-hidden="true">*</b></span><input required maxLength={180} value={clientDraft.legalName} onChange={(event) => setClientDraft((current) => ({ ...current, legalName: event.target.value }))} /></label>
                  <label><span>Nome fantasia</span><input maxLength={180} value={clientDraft.tradeName} onChange={(event) => setClientDraft((current) => ({ ...current, tradeName: event.target.value }))} /></label>
                  <label><span>CPF ou CNPJ</span><input maxLength={30} value={clientDraft.document} onChange={(event) => setClientDraft((current) => ({ ...current, document: event.target.value }))} /></label>
                </div>
              </form>

              {!creatingClient && selectedClient && (
                <section className="works-section">
                  <div className="works-heading"><span><h2>Obras</h2><p>Locais e projetos vinculados a este cliente.</p></span><button type="button" onClick={() => beginWork()}><Plus size={16} /> Nova obra</button></div>
                  {editingWork && (
                    <form className="work-form" onSubmit={(event) => void saveWork(event)}>
                      <label><span>Nome da obra <b aria-hidden="true">*</b></span><input autoFocus required maxLength={180} value={workDraft.name} onChange={(event) => setWorkDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                      <label className="wide"><span>Endereço ou referência</span><input maxLength={300} value={workDraft.address} onChange={(event) => setWorkDraft((current) => ({ ...current, address: event.target.value }))} /></label>
                      {workDraft.id && <label className="work-active"><input type="checkbox" checked={workDraft.active} onChange={(event) => setWorkDraft((current) => ({ ...current, active: event.target.checked }))} /> Obra ativa</label>}
                      <div><button type="button" onClick={() => setEditingWork(false)}>Cancelar</button><button className="primary" type="submit" disabled={saving || !workDraft.name.trim()}><Save size={15} /> Salvar obra</button></div>
                    </form>
                  )}
                  <div className="works-list">
                    {selectedClient.works.map((work) => (
                      <div key={work.id} className={!work.active ? 'inactive' : ''}>
                        <MapPin size={17} />
                        <span><b>{work.name}</b><small>{work.address || 'Endereço não informado'}</small></span>
                        {!work.active && <em>Inativa</em>}
                        <button type="button" aria-label={`Editar ${work.name}`} onClick={() => beginWork(work)}><Pencil size={15} /> Editar</button>
                      </div>
                    ))}
                    {selectedClient.works.length === 0 && <p className="management-empty">Nenhuma obra cadastrada para este cliente.</p>}
                  </div>
                </section>
              )}
            </>
          ) : <div className="editor-empty"><Building2 size={32} /><h2>Selecione um cliente</h2><p>Escolha um cadastro à esquerda ou crie um novo cliente.</p></div>}
        </section>
      </div>
    </main>
  );
}
