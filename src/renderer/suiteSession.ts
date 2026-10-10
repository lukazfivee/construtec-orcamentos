// Sessao corporativa entregue pelo app Suite Construtec do Windows em #sessao=<token>. O Centro de Custos
// so troca codigos de uso unico (#handoff=) com a chave de servico, que e segredo do servidor e nao existe
// no instalador; dentro da Suite o app entrega a propria sessao da conta, que o servidor local valida no Centro.
// So vale com `runtime.suite === true`: no navegador um link com #sessao= nao pode trocar a conta de quem abre.
const SESSION_TOKEN = /^[A-Za-z0-9+/_=-]{20,200}$/;

export const suiteSessionFromHash = (hash: string) => {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('sessao');
  return token && SESSION_TOKEN.test(token) ? token : null;
};
