import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from './theme';

const OPTIONS: Array<{ mode: ThemeMode; label: string; hint: string; icon: typeof Sun }> = [
  { mode: 'auto', label: 'Automático', hint: 'Segue o sistema', icon: Monitor },
  { mode: 'claro', label: 'Claro', hint: 'Fundo branco', icon: Sun },
  { mode: 'escuro', label: 'Escuro', hint: 'Fundo azul-marinho', icon: Moon },
];

// Preferência por aparelho (localStorage): vale já ao escolher, sem precisar salvar. O PDF e o Word seguem sempre claros.
export function AppearancePanel() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <section className="settings-card appearance-card" aria-labelledby="appearance-title">
      <div className="appearance-head">
        <Palette size={19} aria-hidden="true" />
        <div>
          <h2 id="appearance-title">Aparência</h2>
          <p>Tema deste computador. Agora: {resolved === 'escuro' ? 'escuro' : 'claro'}. O PDF e o Word da proposta continuam claros.</p>
        </div>
      </div>
      <div className="appearance-options" role="radiogroup" aria-label="Tema da interface">
        {OPTIONS.map(({ mode: value, label, hint, icon: Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} className={`appearance-option${mode === value ? ' active' : ''}`} onClick={() => setMode(value)}>
            <Icon size={18} aria-hidden="true" />
            <b>{label}</b>
            <span>{hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
