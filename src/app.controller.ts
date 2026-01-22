import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService, HealthCheckResult } from './app.service';

@ApiTags('Health Check')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint - includes database connectivity' })
  @ApiResponse({
    status: 200,
    description: 'Health check result',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Server uptime in seconds' },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['connected', 'disconnected'] },
            latency: { type: 'number', description: 'Database query latency in ms' },
          },
        },
      },
    },
  })
  async getHealth(): Promise<HealthCheckResult> {
    return this.appService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint - lightweight check for load balancers' })
  @ApiResponse({
    status: 200,
    description: 'Server is ready to accept requests',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getReady(): { status: 'ready'; timestamp: string } {
    return this.appService.getReady();
  }
}
