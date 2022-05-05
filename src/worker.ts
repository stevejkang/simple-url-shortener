import { Router } from 'worktop';
import * as Cache from 'worktop/cache';
import * as CORS from 'worktop/cors';
import type { KV } from 'worktop/kv';

declare var INDEX: KV.Namespace;

const API = new Router();

API.prepare = CORS.preflight();

API.add('GET', '/', async (request, response) => {
  return response.send(400, { message: 'Method not implemented.' });
});

Cache.listen(API.run);
