import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Database,
  Percent,
  Save,
  Settings,
} from 'lucide-react';
import type { AppSettings } from '../shared/contracts';
import { settingsApi } from './api';

type SettingsWorkspaceProps = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const initialSettings: AppSettings = {
  companyName: 'Construtec Engenharia Ltda.',
  tradeName: 'Construtec Engenharia',
  document: '',
  phone: '',
  email: 'comercial@construtec.local',
  address: '',
  defaultResponsible: 'Marcos Ribeiro',
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
};

export function SettingsWorkspace({ onNotice, onError }: SettingsWorkspaceProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const result = await settingsApi.get();
        if (active) setSettings(result.settings);
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Não foi possível carregar as configurações.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const result = await settingsApi.update(settings);
      setSettings(result.settings);
      onNotice('Configurações salvas com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="management-workspace settings-workspace">
      <header className="management-header">
        <div>
          <Settings size={25} />
          <span>
            <h1>Configurações</h1>
            <p>Parâmetros da empresa, padrões de propostas e estado do sistema.</p>
          </span>
        </div>
        <span className="management-header-actions">
          <button type="submit" form="settings-form" className="primary" disabled={saving || loading}>
            <Save size={16} /> {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </span>
      </header>

      <div className="settings-body" style={{ padding: '24px', overflowY: 'auto' }}>
        <form id="settings-form" onSubmit={(e) => void saveSettings(e)} style={{ maxWidth: '880px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Company Identification */}
          <div className="settings-card" style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
              <Building2 size={19} color="#085ce5" />
              <div>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Dados da Construtec para Exportação</h2>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Identificação oficial que estampa cabeçalhos e rodapés de documentos PDF e Word.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="wide">
                <span>Razão Social</span>
                <input
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="Construtec Engenharia e Soluções Ltda."
                />
              </label>

              <label>
                <span>Nome Fantasia / Marca</span>
                <input
                  value={settings.tradeName}
                  onChange={(e) => setSettings({ ...settings, tradeName: e.target.value })}
                  placeholder="Construtec Engenharia"
                />
              </label>

              <label>
                <span>CNPJ / Inscrição</span>
                <input
                  value={settings.document}
                  onChange={(e) => setSettings({ ...settings, document: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </label>

              <label>
                <span>E-mail comercial</span>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="comercial@construtec.com.br"
                />
              </label>

              <label>
                <span>Telefone de contato</span>
                <input
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </label>

              <label className="wide">
                <span>Endereço / Cidade</span>
                <input
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="São Paulo - SP"
                />
              </label>
            </div>
          </div>

          {/* Proposal Default Parameters */}
          <div className="settings-card" style={{ background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
              <Percent size={19} color="#085ce5" />
              <div>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Parâmetros Padrão de Novas Propostas</h2>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Valores iniciais aplicados automaticamente ao criar orçamentos.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                <span>Responsável Técnico Padrão</span>
                <input
                  value={settings.defaultResponsible}
                  onChange={(e) => setSettings({ ...settings, defaultResponsible: e.target.value })}
                  placeholder="Marcos Ribeiro"
                />
              </label>

              <label>
                <span>Multiplicador BDI Padrão (ex: 1.45 para 45%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="10"
                  value={settings.defaultBdi}
                  onChange={(e) => setSettings({ ...settings, defaultBdi: Number(e.target.value) })}
                />
              </label>

              <label>
                <span>Horas Mensais Padrão (Mão de Obra)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="720"
                  value={settings.defaultStandardHours}
                  onChange={(e) => setSettings({ ...settings, defaultStandardHours: Number(e.target.value) })}
                />
              </label>

              <label>
                <span>Validade Padrão da Proposta (em dias)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="365"
                  value={settings.defaultValidityDays}
                  onChange={(e) => setSettings({ ...settings, defaultValidityDays: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          {/* System & Architecture Info */}
          <div className="settings-card" style={{ background: '#f8fafc', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Database size={19} color="#178442" />
              <div>
                <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Ambiente e Armazenamento Local</h2>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#697386' }}>Arquitetura Local-First Construtec Orçamentos.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', fontSize: '11px' }}>
              <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}>
                <span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Versão do App</span>
                <b style={{ color: '#172033', fontSize: '13px' }}>v1.0.5</b>
              </div>
              <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}>
                <span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Banco Local</span>
                <b style={{ color: '#178442', fontSize: '13px' }}>PGlite / PostgreSQL</b>
              </div>
              <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e4e6ea' }}>
                <span style={{ color: '#697386', display: 'block', fontSize: '10px' }}>Modo de Operação</span>
                <b style={{ color: '#085ce5', fontSize: '13px' }}>Offline Local-First</b>
              </div>
            </div>
          </div>

        </form>
      </div>
    </main>
  );
}
