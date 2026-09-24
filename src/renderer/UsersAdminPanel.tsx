import { useEffect, useState, type FormEvent } from 'react';
import { MailCheck, Save, Trash2, UserPlus, Users } from 'lucide-react';
import type { AuthRole, AuthUser, AuthorizedEmailRecord, UserRecord } from '../shared/contracts';
import { usersApi } from './api';

// Contas sao do Centro de Custos (identidade compartilhada). Aqui o admin do
// Orcamentos cria, desativa e exclui logins pelo diretorio central e escolhe o
// papel da conta dentro do Orcamentos. Nome, e-mail e senha sao da conta.

type NewUserDraft = { name: string; email: string; password: string; role: AuthRole };

const emptyUser: NewUserDraft = { name: '', email: '', password: '', role: 'commercial' };
const roleLabels: Record<AuthRole, string> = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };
const card = { background: '#fff', border: '1px solid #e4e6ea', borderRadius: '8px', padding: '20px' } as const;
const field = { display: 'grid', gap: '5px', fontSize: '10px' } as const;
const secondaryButton = { height: '34px', padding: '0 10px', background: '#fff', border: '1px solid #cfd5de', borderRadius: '6px', cursor: 'pointer' } as const;

type Props = {
  currentUser: AuthUser;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

export function UsersAdminPanel({ currentUser, onNotice, onError }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [emails, setEmails] = useState<AuthorizedEmailRecord[]>([]);
  const [newUser, setNewUser] = useState<NewUserDraft>(emptyUser);
  const [newEmail, setNewEmail] = useState({ email: '', note: '' });
  const [pending, setPending] = useState(false);

  const fail = (error: unknown, fallback: string) => onError(error instanceof Error ? error.message : fallback);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [usersResult, emailsResult] = await Promise.all([usersApi.list(), usersApi.authorizedEmails()]);
        if (!active) return;
        setUsers(usersResult.users);
        setEmails(emailsResult.emails);
      } catch (error) {
        if (active) fail(error, 'Não foi possível carregar os usuários.');
      }
    })();
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>, fallback: string) => {
    if (pending) return;
    setPending(true);
    try { await action(); } catch (error) { fail(error, fallback); } finally { setPending(false); }
  };

  const createUser = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await usersApi.create(newUser);
      setUsers(result.users);
      setNewUser(emptyUser);
      onNotice('Conta criada. A mesma conta vale no Centro de Custos.');
    }, 'Não foi possível criar a conta.');
  };

  const updateDraft = (userId: string, changes: Partial<UserRecord>) => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...changes } : user));
  };

  const saveUser = (user: UserRecord) => void run(async () => {
    try {
      const result = await usersApi.update(user.id, { role: user.role, active: user.active });
      setUsers(result.users);
      onNotice('Usuário atualizado.');
    } catch (error) {
      setUsers((await usersApi.list().catch(() => ({ users }))).users);
      throw error;
    }
  }, 'Não foi possível atualizar o usuário.');

  const removeUser = (user: UserRecord) => {
    const confirmed = window.confirm(`Excluir o login de ${user.name}? A pessoa perde o acesso ao Orçamentos e ao Centro de Custos, e o e-mail fica livre para uma conta nova. O histórico não é apagado. Não é possível desfazer.`);
    if (!confirmed) return;
    void run(async () => {
      setUsers((await usersApi.remove(user.id)).users);
      onNotice('Login excluído.');
    }, 'Não foi possível excluir o login.');
  };

  const authorizeEmail = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      setEmails((await usersApi.authorizeEmail(newEmail.email.trim(), newEmail.note.trim())).emails);
      setNewEmail({ email: '', note: '' });
      onNotice('E-mail externo autorizado.');
    }, 'Não foi possível autorizar o e-mail.');
  };

  const revokeEmail = (email: string) => {
    if (!window.confirm(`Revogar a autorização de ${email}? Uma conta já criada continua ativa; para remover o acesso, use Excluir login.`)) return;
    void run(async () => {
      setEmails((await usersApi.revokeEmail(email)).emails);
      onNotice('Autorização revogada.');
    }, 'Não foi possível revogar a autorização.');
  };

  return (
    <section className="settings-card" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '12px' }}>
        <Users size={19} color="#12a9d1" />
        <div><h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Usuários e Permissões</h2><p style={{ margin: '2px 0 0', fontSize: '10px', color: '#5d7480' }}>As contas são as mesmas do Centro de Custos. O perfil abaixo vale só no Orçamentos; a senha é trocada pela própria pessoa no Centro de Custos.</p></div>
      </div>

      <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.25fr .9fr .85fr auto', gap: '8px', alignItems: 'end', padding: '12px', background: '#f8fafc', border: '1px solid #e4e6ea', borderRadius: '6px', marginBottom: '14px' }}>
        <label style={field}><span>Nome</span><input required minLength={2} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></label>
        <label style={field}><span>E-mail</span><input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
        <label style={field}><span>Senha inicial</span><input required type="password" minLength={10} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
        <label style={field}><span>Perfil no Orçamentos</span><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AuthRole })}><option value="commercial">Comercial</option><option value="viewer">Consulta</option><option value="admin">Administrador</option></select></label>
        <button type="submit" className="primary" disabled={pending} style={{ height: '36px', border: '1px solid #12a9d1', borderRadius: '6px', padding: '0 12px' }}><UserPlus size={15} /> Criar</button>
      </form>

      <div style={{ display: 'grid', gap: '10px' }}>
        {users.map((user) => (
          <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.25fr .82fr auto', gap: '8px 10px', alignItems: 'end', padding: '12px', border: '1px solid #e4e6ea', borderRadius: '6px', background: user.active ? '#fff' : '#fafafa', opacity: user.active ? 1 : .72 }}>
            <div style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#5d7480' }}><span>Nome {user.id === currentUser.id ? '• Você' : ''}</span><strong style={{ fontSize: '12px', color: '#1f2a33' }}>{user.name}</strong></div>
            <div style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#5d7480' }}><span>E-mail</span><span style={{ fontSize: '12px', color: '#1f2a33' }}>{user.email}</span></div>
            <label style={{ display: 'grid', gap: '4px', fontSize: '9px', color: '#5d7480' }}><span>Perfil</span><select value={user.role} onChange={(e) => updateDraft(user.id, { role: e.target.value as AuthRole })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div style={{ display: 'flex', alignItems: 'end', gap: '7px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '36px', fontSize: '10px' }}><input type="checkbox" checked={user.active} onChange={(e) => updateDraft(user.id, { active: e.target.checked })} /> Ativo</label>
              <button type="button" onClick={() => saveUser(user)} disabled={pending} style={secondaryButton}><Save size={14} /> Salvar</button>
              {user.id !== currentUser.id && <button type="button" onClick={() => removeUser(user)} disabled={pending} style={{ ...secondaryButton, color: '#b42318' }} aria-label={`Excluir login de ${user.name}`}><Trash2 size={14} /> Excluir login</button>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f0f2f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <MailCheck size={16} color="#12a9d1" />
          <div><h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>E-mails externos autorizados</h3><p style={{ margin: '2px 0 0', fontSize: '10px', color: '#5d7480' }}>Contas fora do domínio @rcconstrutec.com.br só podem ser criadas para e-mails desta lista.</p></div>
        </div>
        <form onSubmit={authorizeEmail} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr auto', gap: '8px', alignItems: 'end', marginBottom: '10px' }}>
          <label style={field}><span>E-mail</span><input required type="email" maxLength={254} value={newEmail.email} onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })} /></label>
          <label style={field}><span>Observação</span><input maxLength={200} value={newEmail.note} placeholder="Ex.: vendedor terceirizado" onChange={(e) => setNewEmail({ ...newEmail, note: e.target.value })} /></label>
          <button type="submit" disabled={pending} style={secondaryButton}>Autorizar</button>
        </form>
        {emails.length === 0
          ? <p style={{ fontSize: '10px', color: '#5d7480', margin: 0 }}>Nenhum e-mail externo autorizado.</p>
          : emails.map((row) => (
            <div key={row.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid #f0f2f5', fontSize: '11px' }}>
              <span><strong>{row.email}</strong>{row.note ? <span style={{ color: '#5d7480' }}> · {row.note}</span> : null}</span>
              <button type="button" onClick={() => revokeEmail(row.email)} disabled={pending} style={{ ...secondaryButton, height: '28px' }}>Revogar</button>
            </div>
          ))}
      </div>
    </section>
  );
}
