import { Router } from 'express';
import {
  getCostByDepartment,
  getInsightsOverview,
  getPayByCountry,
  getPayByJobTitle,
} from '../services/insights.js';
import type { AppDependencies } from './dependencies.js';

export function insightsRouter(dependencies: AppDependencies): Router {
  const router = Router();

  router.get('/overview', async (_request, response) => {
    response.json(await getInsightsOverview(dependencies));
  });

  router.get('/countries', async (_request, response) => {
    response.json({ items: await getPayByCountry(dependencies) });
  });

  router.get('/countries/:code/job-titles', async (request, response) => {
    response.json(await getPayByJobTitle(dependencies, request.params.code.toUpperCase()));
  });

  router.get('/departments', async (_request, response) => {
    response.json({ items: await getCostByDepartment(dependencies) });
  });

  return router;
}
