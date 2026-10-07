import type { ClientContact } from '../shared/contracts';

export const emptyContact: ClientContact = { name: '', role: '', department: '', email: '', phone: '' };

type Props = { value: ClientContact; onChange: (next: ClientContact) => void };

// Quem recebe a proposta no cliente: preenche a linha A/C da carta (variaveis {{contato}} e {{setor_contato}}).
export function ClientContactFields({ value, onChange }: Props) {
  const field = (key: keyof ClientContact, label: string, max: number, type = 'text') => (
    <label><span>{label}</span><input type={type} maxLength={max} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></label>
  );
  return (
    <fieldset className="client-contact">
      <legend>Contato na carta da proposta</legend>
      <p>Quem recebe a proposta neste cliente. Entra sozinho na linha A/C da carta.</p>
      <div className="form-grid">
        {field('name', 'Nome', 120)}
        {field('role', 'Cargo', 120)}
        {field('department', 'Setor', 120)}
        {field('email', 'E-mail', 160, 'email')}
        {field('phone', 'Telefone', 40, 'tel')}
      </div>
    </fieldset>
  );
}
