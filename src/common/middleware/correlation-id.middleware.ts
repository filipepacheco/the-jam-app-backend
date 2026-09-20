import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const CORRELATION_ID_HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing correlation ID from header or generate a new one
    const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    // Set correlation ID on request for use in services
    req.headers[CORRELATION_ID_HEADER] = correlationId;

    // Include correlation ID in response headers
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
