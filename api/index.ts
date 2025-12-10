import { bootstrap } from '../src/main';

let cachedApp;

export default async (req, res) => {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }

  const httpAdapter = cachedApp.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  return instance(req, res);
};

