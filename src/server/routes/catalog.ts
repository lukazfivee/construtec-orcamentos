import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { searchCatalog } from '../services/proposals';
import { createCatalogProduct, importCatalogProducts, listCatalogProducts, previewCatalogImport, previewExsatProducts, updateCatalogProduct } from '../services/catalog';

const searchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
const idSchema = z.string().uuid();
const productSchema = z.object({
  code: z.string().trim().min(2).max(60),
  manufacturer: z.string().trim().max(120).nullable().default(null),
  model: z.string().trim().max(120).nullable().default(null),
  description: z.string().trim().min(3).max(400),
  category: z.string().trim().min(2).max(120),
  unit: z.string().trim().min(1).max(20),
  currentCost: z.number().min(0).max(1_000_000_000),
  source: z.string().trim().min(2).max(120).default('CONSTRUTEC'),
  active: z.boolean().default(true),
});
const importSchema = z.object({ items: z.array(productSchema).min(1).max(500) });
const exsatSchema = z.object({ url: z.url().max(2000) });

export const createCatalogRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const input = searchSchema.parse(request.query);
      response.json({ products: await searchCatalog(database, input.q, input.limit) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/manage', async (request, response, next) => {
    try {
      const query = z.string().trim().max(120).catch('').parse(request.query.q);
      response.json({ products: await listCatalogProducts(database, query) });
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const productId = await createCatalogProduct(database, productSchema.parse(request.body));
      response.status(201).json({ productId, products: await listCatalogProducts(database) });
    } catch (error) { next(error); }
  });

  router.patch('/:productId', async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.productId);
      await updateCatalogProduct(database, productId, productSchema.parse(request.body));
      response.json({ products: await listCatalogProducts(database) });
    } catch (error) { next(error); }
  });

  router.post('/import/preview', async (request, response, next) => {
    try {
      const input = importSchema.parse(request.body);
      response.json(await previewCatalogImport(database, input.items));
    } catch (error) { next(error); }
  });

  router.post('/import/bulk', async (request, response, next) => {
    try {
      const input = importSchema.parse(request.body);
      const result = await importCatalogProducts(database, input.items);
      response.status(201).json({ ...result, products: await listCatalogProducts(database) });
    } catch (error) { next(error); }
  });

  router.post('/import/exsat', async (request, response, next) => {
    try {
      const input = exsatSchema.parse(request.body);
      response.json({ items: await previewExsatProducts(input.url) });
    } catch (error) { next(error); }
  });

  return router;
};
