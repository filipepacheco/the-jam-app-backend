import { INestApplication } from '@nestjs/common';
import { isIP } from 'node:net';

export function configureTrustedProxy(app: INestApplication, hops: number): void {
  app.getHttpAdapter().getInstance().set('trust proxy', hops);
}

export function normalizeClientIp(value: string): string {
  const ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) {
    const ipv4 = ip.slice('::ffff:'.length);
    if (isIP(ipv4) === 4) return ipv4;
  }
  return ip;
}
