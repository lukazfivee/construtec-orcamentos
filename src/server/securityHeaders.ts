import type { NextFunction, Request, Response } from 'express';

// As respostas da API carregam dados de proposta e cliente: nada de cache em disco ou em proxy, e o tipo declarado vale.
export const securityHeaders = (request: Request, response: Response, next: NextFunction) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.path.startsWith('/api/') || request.path === '/health') response.setHeader('Cache-Control', 'no-store');
  next();
};