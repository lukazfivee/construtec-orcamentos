import { useEffect, useRef, useState } from 'react';

// Barra de titulo propria do app no Windows: mesma cor do menu lateral, com o nome do app, uma luz que acompanha o mouse e um
// brilho que corre pela borda de baixo. Os botoes de minimizar, maximizar e fechar continuam sendo os do Windows (titleBarOverlay),
// pintados na cor da barra. Arrastar a barra move a janela; clique duplo maximiza.
const toHex = (rgb: string) => {
  const parts = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3).map((value) => Math.round(Number(value)));
  return parts?.length === 3 ? `#${parts.map((value) => value.toString(16).padStart(2, '0')).join('')}` : null;
};

export function WindowTitleBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  // Os botoes do Windows acompanham a cor da barra (que muda com o tema claro/escuro).
  useEffect(() => {
    const paint = () => {
      const bar = barRef.current;
      const color = bar ? toHex(getComputedStyle(bar).backgroundColor) : null;
      if (color) void window.construtec?.setTitleBarColors?.(color, '#b9d4dd');
    };
    paint();
    window.addEventListener('orc-theme-change', paint);
    return () => window.removeEventListener('orc-theme-change', paint);
  }, []);

  useEffect(() => {
    const on = () => setActive(true);
    const off = () => setActive(false);
    window.addEventListener('focus', on);
    window.addEventListener('blur', off);
    return () => { window.removeEventListener('focus', on); window.removeEventListener('blur', off); };
  }, []);

  const follow = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  };

  return (
    <div ref={barRef} className={`titlebar${active ? '' : ' inativa'}`} onMouseMove={follow} role="presentation">
      <span className="titlebar-title">Construtec Orçamentos</span>
      <i className="titlebar-shine" aria-hidden="true" />
    </div>
  );
}
