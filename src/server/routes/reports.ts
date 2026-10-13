import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../shared/contracts';

// Reportar problema: o servidor repassa ao Worker de reports do Centro (o mesmo que manda o e-mail ao suporte).
// Nome e e-mail vem da sessao, nunca do corpo. Nada fica guardado aqui.
const DEFAULT_REPORT_API = 'https://centro-custos-reports.construtec-reports.workers.dev';
const SUPPORT = 'pcm@rcconstrutec.com.br';

const reportSchema = z.object({
  type: z.enum(['bug', 'melhoria', 'sugestao']),
  severity: z.enum(['baixa', 'media', 'alta', 'critica']),
  title: z.string().trim().min(3).max(170),
  description: z.string().trim().min(5).max(10000),
  platform: z.enum(['desktop', 'celular', 'navegador']).default('navegador'),
  appVersion: z.string().trim().max(40).default(''),
  clientReportId: z.string().uuid().optional(),
});

const reportApiUrl = () => {
  const configured = process.env.REPORT_API_URL;
  // Variavel definida e vazia desliga o envio externo (mesmo contrato do Centro).
  return (configured === undefined ? DEFAULT_REPORT_API : configured).trim().replace(/\/$/, '');
};

export const createReportsRouter = () => {
  const router = Router();

  router.post('/', async (request, response, next) => {
    try {
      const input = reportSchema.parse(request.body);
      const user = response.locals.authUser as AuthUser;
      const base = reportApiUrl();
      if (!base) {
        response.status(503).json({ error: `O envio de reports não está ativo. Escreva para ${SUPPORT}.` });
        return;
      }
      const cloud = Boolean(process.env.DATABASE_URL);
      const payload = {
        clientReportId: input.clientReportId ?? randomUUID(),
        title: `[Orçamentos] ${input.title}`,
        description: input.description,
        type: input.type,
        severity: input.severity,
        user: { name: user.name, email: user.email },
        installation: { id: cloud ? 'orcamentos-nuvem' : 'orcamentos-local', name: `Construtec Orçamentos (${cloud ? 'nuvem' : 'computador'})` },
        app: { version: input.appVersion, platform: `orcamentos-${input.platform}` },
        createdAt: new Date().toISOString(),
      };
      let delivered: { ok?: boolean; reportId?: string; error?: string } = {};
      let status = 0;
      try {
        const result = await fetch(`${base}/v1/reports`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        status = result.status;
        delivered = await result.json().catch(() => ({}));
      } catch {
        status = 0;
      }
      if (status < 200 || status >= 300 || !delivered.ok) {
        response.status(502).json({ error: status === 429 ? 'Muitos reports em pouco tempo. Tente de novo mais tarde.' : `Não foi possível entregar o report agora. Tente de novo ou escreva para ${SUPPORT}.` });
        return;
      }
      response.status(201).json({ reportId: delivered.reportId ?? '' });
    } catch (error) { next(error); }
  });

  return router;
};
