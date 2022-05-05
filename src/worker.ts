import { Router } from 'worktop';
import * as Cache from 'worktop/cache';
import * as CORS from 'worktop/cors';
import type { KV } from 'worktop/kv';
import * as base62 from 'base62-ts';
import { InvalidArgumentsError } from './error';
import { URLRequest } from './request';

declare var INDEX: KV.Namespace;

const API = new Router();

API.prepare = CORS.preflight();

API.add('GET', '/', async (request, response) => {
  return response.send(400, { message: 'Method not implemented.' });
});

API.add('POST', '/url', async (request, response) => {
  try {
    const { url } = await request.body.json<URLRequest>();

    if (!url) {
      throw new InvalidArgumentsError('Invalid url.');
    }

    const existingValues = await INDEX.list();
    const latestSerial = getLatestSerial(existingValues.keys);

    const serial = latestSerial + 1;
    const cacheKey = `url:serial:${addZeroFill(serial, 20)}:result`;

    const encodedSerial = base62.encode(serial);
    const key = addZeroFill(encodedSerial);

    await INDEX.put(cacheKey, url);

    response.send(201, { url: `https://${request.hostname}/u/${key}` });
  } catch (error) {
    if (error instanceof InvalidArgumentsError) {
      return response.send(400, { message: error.message });
    } else {
      console.error(error);
      return response.send(500, { message: 'Internal Server Error' });
    }
  }
});

API.add('GET', '/u/:identifier', async (request, response) => {
  try {
    const identifier = request.params.identifier ?? '';
    const leadingZeroRemovedIdentifier = identifier.replace(/^0+/, '');

    if (leadingZeroRemovedIdentifier.length <= 0) {
      throw new InvalidArgumentsError('Invalid identifier.');
    }

    const serial = base62.decode(leadingZeroRemovedIdentifier);

    const cacheKey = `url:serial:${addZeroFill(serial, 20)}:result`;
    const url = await INDEX.get<string>(cacheKey);

    if (!url) {
      response.send(404, { message: 'URL not found.' });
    }

    response.send(301, null, { Location: url ?? location.origin });
  } catch (error) {
    if (error instanceof InvalidArgumentsError) {
      return response.send(400, { message: error.message });
    } else {
      console.error(error);
      return response.send(500, { message: 'Internal Server Error' });
    }
  }
});

Cache.listen(API.run);

function getLatestSerial(keys: KV.KeyInfo<KV.Metadata>[]) {
  return parseInt(keys.map(key => key.name).sort((one, two) => (one > two ? -1 : 1))[0].split(':')[2]);
}

function addZeroFill(key: string | number, length = 7) {
  const keyString = key.toString();
  return keyString.length < length ? `${'0'.repeat(length - keyString.length)}${key}` : key;
}
