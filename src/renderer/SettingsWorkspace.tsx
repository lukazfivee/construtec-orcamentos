import { useEffect, useState, type FormEvent } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import type { AppSettings, AuthUser } from '../shared/contracts';
import { DiscardedProposalsPanel } from './DiscardedProposalsPanel';
import { authApi, settingsApi, systemApi } from './api';
import { CompanyDefaultsPanel } from './CompanyDefaultsPanel';
import { AppearancePanel } from './AppearancePanel';
import { AppUpdatePanel } from './AppUpdatePanel';
import { CompanyDataCard, EnvironmentCard, NewProposalParamsCard } from './SettingsSections';
import { UsersAdminPanel } from './UsersAdminPanel';

type SettingsWorkspaceProps = {
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const SETTINGS_TABS = [
  ['geral', 'Geral'],
  ['empresa', 'Empresa e propostas'],
  ['usuarios', 'Usuários'],
  ['sistema', 'Sistema'],
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number][0];

const initialSettings: AppSettings = {
  companyName: 'LAC CONSTRUTEC CONSTRUTORA EIRELI',
  tradeName: 'CONSTRUTEC',
  document: '32.992.946/0001-78',
  phone: '(71) 99294-1099',
  email: 'supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br',
  address: 'Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450',
  defaultResponsible: 'Marcos Ribeiro',
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
  defaultTaxPercentage: 0,
  pdfShowLogo: true,
  pdfShowSignature: true,
};


export function SettingsWorkspace({ onNotice, onError }: SettingsWorkspaceProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupPending, setBackupPending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [settingsResult, meResult] = await Promise.all([settingsApi.get(), authApi.me()]);
        if (!active) return;
        setSettings(settingsResult.settings);
        setCurrentUser(meResult.user);
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
    if (saving || !isAdmin) return;

    setSaving(true);
    try {
      // BDI, impostos, validade e PDF salvam em "Padroes da empresa" (painel proprio).
      const { defaultBdi, defaultValidityDays, defaultTaxPercentage, pdfShowLogo, pdfShowSignature, ...company } = settings;
      void defaultBdi; void defaultValidityDays; void defaultTaxPercentage; void pdfShowLogo; void pdfShowSignature;
      const result = await settingsApi.update(company);
      setSettings(result.settings);
      onNotice('Configurações salvas com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const createBackup = async () => {
    if (backupPending || restorePending || !isAdmin) return;
    if (!window.construtec?.saveBackup) {
      onError('O recurso de backup só está disponível no aplicativo desktop.');
      return;
    }
    setBackupPending(true);
    try {
      const bytes = await systemApi.createBackup();
      if (bytes.byteLength === 0) throw new Error('O backup gerado está vazio.');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const result = await window.construtec.saveBackup(bytes, `Construtec-Orcamentos-backup-${stamp}.tar.gz`);
      if (!result.canceled) onNotice('Backup do banco local salvo com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível gerar o backup local.');
    } finally {
      setBackupPending(false);
    }
  };

  const restoreBackup = async () => {
    if (restorePending || backupPending || !isAdmin) return;
    setRestorePending(true);
    try {
      const result = await systemApi.restoreBackup();
      if (!result.canceled && !result.restarting) onNotice('Backup validado.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível restaurar o backup local.');
    } finally {
      setRestorePending(false);
    }
  };

  const settingDisabled = loading || !isAdmin;
  const [tab, setTab] = useState<SettingsTab>('geral');
  const visibleTabs = SETTINGS_TABS.filter(([key]) => key !== 'usuarios' || (isAdmin && currentUser));

  return (
    <main className="management-workspace settings-workspace">
      <header className="management-header cab">
        <div className="tit">
          <span className="eyebrow">Administração</span>
          <h1>Configurações</h1>
          <p className="sub">Parâmetros da empresa, padrões de propostas, usuários e estado do sistema.</p>
        </div>
        <div className="acoes management-header-actions">
          <button type="submit" form="settings-form" className="primary" disabled={saving || settingDisabled} title={!isAdmin ? 'Somente administradores podem alterar configurações.' : undefined}>
            <Save size={16} /> {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </header>

      <div className="st-tabs" role="tablist" aria-label="Seções das configurações">
        {visibleTabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" id={`st-tab-${key}`} aria-selected={tab === key} aria-controls={`st-pane-${key}`} className="tab" onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="settings-body">
        <div className="st-stack">
          {!loading && !isAdmin && (
            <div className="od-note warn">
              <ShieldCheck size={15} /> Configurações abertas em modo de consulta. Apenas administradores podem alterar estes dados.
            </div>
          )}

          <div className="st-pane" id="st-pane-geral" role="tabpanel" aria-labelledby="st-tab-geral" hidden={tab !== 'geral'}>
            <AppearancePanel />

            <AppUpdatePanel />

            <CompanyDefaultsPanel settings={settings} loading={loading} isAdmin={isAdmin} onSaved={setSettings} onNotice={onNotice} onError={onError} />
          </div>

          <form id="settings-form" className="st-form" onSubmit={(e) => void saveSettings(e)}>
            <div className="st-pane" id="st-pane-empresa" role="tabpanel" aria-labelledby="st-tab-empresa" hidden={tab !== 'empresa'}>
              <CompanyDataCard settings={settings} disabled={settingDisabled} onChange={setSettings} />
              <NewProposalParamsCard settings={settings} disabled={settingDisabled} onChange={setSettings} />
            </div>
            <div className="st-pane" id="st-pane-sistema-ambiente" hidden={tab !== 'sistema'}>
              <EnvironmentCard isAdmin={isAdmin} backupPending={backupPending} restorePending={restorePending} onBackup={() => void createBackup()} onRestore={() => void restoreBackup()} />
            </div>
          </form>

          {isAdmin && currentUser && (
            <div className="st-pane" id="st-pane-usuarios" role="tabpanel" aria-labelledby="st-tab-usuarios" hidden={tab !== 'usuarios'}>
              <UsersAdminPanel currentUser={currentUser} onNotice={onNotice} onError={onError} />
            </div>
          )}
          {isAdmin && (
            <div className="st-pane" id="st-pane-sistema" role="tabpanel" aria-labelledby="st-tab-sistema" hidden={tab !== 'sistema'}>
              <DiscardedProposalsPanel onNotice={onNotice} onError={onError} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
