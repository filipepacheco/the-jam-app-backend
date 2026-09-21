import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService, HealthCheckResult, ReadinessCheckResult } from './app.service';

@ApiTags('Health Check')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({
    status: 200,
    description: 'Health check result',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Server uptime in seconds' },
      },
    },
  })
  getHealth(): HealthCheckResult {
    return this.appService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database-backed readiness probe for load balancers' })
  @ApiResponse({
    status: 200,
    description: 'Server is ready to accept requests',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready' },
        timestamp: { type: 'string', format: 'date-time' },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['connected'] },
            latency: { type: 'number', description: 'Database query latency in ms' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Database is unavailable' })
  getReady(): Promise<ReadinessCheckResult> {
    return this.appService.getReady();
  }
}
