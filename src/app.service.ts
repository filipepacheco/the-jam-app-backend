import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  database?: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
}

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'connected',
          latency,
        },
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'disconnected',
        },
      };
    }
  }

  getReady(): { status: 'ready'; timestamp: string } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
