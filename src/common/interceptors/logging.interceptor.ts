import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuthAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const requestId = request.headers['x-request-id'] || '-';
    const now = Date.now();

    // Mask sensitive data for logging
    const maskedBody = this.maskSensitiveData(body);

    this.logger.log(
      `[REQUEST] ${method} ${url} | ReqID: ${requestId} | IP: ${ip} | Handler: ${className}.${handlerName} | Body: ${JSON.stringify(maskedBody)}`,
    );

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - now;
        const maskedResponse = this.maskSensitiveData(response);
        this.logger.log(
          `[SUCCESS] ${method} ${url} | ReqID: ${requestId} | Duration: ${duration}ms | IP: ${ip} | Response: ${JSON.stringify(maskedResponse)}`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        this.logger.warn(
          `[FAILURE] ${method} ${url} | ReqID: ${requestId} | Duration: ${duration}ms | IP: ${ip} | Error: ${error.message} | Status: ${error.status || 500}`,
        );
        throw error;
      }),
    );
  }

  private maskSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const masked = { ...(data as Record<string, unknown>) };

    // Mask email addresses
    if (masked.email && typeof masked.email === 'string') {
      const [name, domain] = masked.email.split('@');
      if (name && domain) {
        masked.email = `${name.substring(0, 2)}***@${domain}`;
      }
    }

    // Mask phone numbers
    if (masked.phone && typeof masked.phone === 'string') {
      masked.phone = `***${masked.phone.slice(-4)}`;
    }

    // Mask tokens
    if (masked.token && typeof masked.token === 'string') {
      masked.token = `${masked.token.substring(0, 10)}...`;
    }

    // Mask password if ever present
    if (masked.password) {
      masked.password = '***';
    }

    return masked;
  }
}

