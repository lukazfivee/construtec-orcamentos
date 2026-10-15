import { WEBMAIL_URL } from './suiteMenu';

/* Webmail Pro: no app do Windows abre a janela propria; no celular e no navegador abre o site
   (no app Android da Suite o sistema entrega o link ao app do Webmail Pro, se estiver instalado). */
export const openWebmail = () => {
  if (window.construtec?.openWebmail) void window.construtec.openWebmail();
  else window.open(WEBMAIL_URL, '_blank', 'noopener');
};
