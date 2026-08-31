import { Router } from 'express';
import { z } from 'zod';
import type { LocalDatabase } from '../services/database';
import { getAppSettings, updateAppSettings } from '../services/settings';

const settingsUpdateSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  tradeName: z.string().trim().max(200).optional(),
  document: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  defaultResponsible: z.string().trim().min(1).max(120).optional(),
  defaultBdi: z.number().min(1).max(10).optional(),
  defaultStandardHours: z.number().min(1).max(720).optional(),
  defaultValidityDays: z.number().min(1).max(365).optional(),
});

export const createSettingsRouter = (database: LocalDatabase) => {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const settings = await getAppSettings(database);
      response.json({ settings });
    } catch (error) { next(error); }
  });

  router.patch('/', async (request, response, next) => {
    try {
      const input = settingsUpdateSchema.parse(request.body);
      const settings = await updateAppSettings(database, input);
      response.json({ settings });
    } catch (error) { next(error); }
  });

  return router;
};
