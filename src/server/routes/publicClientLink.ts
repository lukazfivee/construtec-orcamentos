import { Router, type Request, type Response } from 'express';
import type { LocalDatabase } from '../services/database';
import { adjustPublicLink, approvePublicLink, openPublicLink, publicDocumentHtml, type PublicContext } from '../services/clientLinksPublic';
import { sendClientLinkError } from './proposalClientLink';

// Pagina publica do cliente (sem login). Tudo aqui e aberto na internet: limite por IP, token assinado e so preco de venda.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Janela fixa por IP e por tipo de uso (leitura x resposta); simples e suficiente para um Container so.
const limited = (key: string, max: number, windowMs: number) => {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
};

const clientIp = (request: Request) => String(request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'] || request.socket.remoteAddress || '').split(',')[0].trim();

export const createPublicClientLinkRouter = (database: LocalDatabase, secret: string) => {
  const router = Router();
  const context = (request: Request): PublicContext => ({ secret, ip: clientIp(request), userAgent: String(request.headers['user-agent'] || '') });
  const tooMany = (request: Request, response: Response, kind: 'read' | 'write') => {
    const blocked = kind === 'read' ? limited(`r:${clientIp(request)}`, 120, 60_000) : limited(`w:${clientIp(request)}`, 12, 10 * 60_000);
    if (blocked) response.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.', code: 'RATE_LIMITED' });
    return blocked;
  };

  router.get('/:token', async (request, response, next) => {
    try {
      if (tooMany(request, response, 'read')) return;
      response.setHeader('Cache-Control', 'no-store');
      response.json(await openPublicLink(database, request.params.token, context(request)));
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  router.get('/:token/document', async (request, response, next) => {
    try {
      if (tooMany(request, response, 'read')) return;
      const html = await publicDocumentHtml(database, request.params.token, secret);
      response.setHeader('Cache-Control', 'no-store');
      response.type('html').send(html);
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  router.post('/:token/approve', async (request, response, next) => {
    try {
      if (tooMany(request, response, 'write')) return;
      response.status(201).json(await approvePublicLink(database, request.params.token, request.body ?? {}, context(request)));
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  router.post('/:token/adjust', async (request, response, next) => {
    try {
      if (tooMany(request, response, 'write')) return;
      await adjustPublicLink(database, request.params.token, request.body ?? {}, context(request));
      response.status(201).json({ ok: true });
    } catch (error) { sendClientLinkError(error, response, next); }
  });

  return router;
};
