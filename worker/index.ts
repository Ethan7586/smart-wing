import handler from 'vinext/server/app-router-entry';
import { routeApi } from './api/router';
import type { WorkerEnv } from './api/types';

const worker = {
  async fetch(request: Request, env: Parameters<typeof handler.fetch>[1] & WorkerEnv, ctx: Parameters<typeof handler.fetch>[2]): Promise<Response> {
    const apiResponse = await routeApi(request, env);
    if (apiResponse) {
      return apiResponse;
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
