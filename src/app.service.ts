import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthCheckResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

export interface ReadinessCheckResult {
  status: 'ready';
  timestamp: string;
  database: {
    status: 'connected';
    latency: number;
  };
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private prisma: PrismaService) {}

  getHealth(): HealthCheckResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReady(): Promise<ReadinessCheckResult> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          latency: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.warn('Readiness check: DB connection failed', error);
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
