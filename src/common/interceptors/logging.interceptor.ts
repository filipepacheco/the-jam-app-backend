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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const now = Date.now();

    // Mask sensitive data for logging
    const maskedBody = this.maskSensitiveData(body);
    const userAgent = request.headers['user-agent'] || 'Unknown';

    this.logger.log(
      `[REQUEST] ${method} ${url} | IP: ${ip} | Handler: ${className}.${handlerName} | Body: ${JSON.stringify(maskedBody)}`,
    );

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - now;
        const maskedResponse = this.maskSensitiveData(response);
        this.logger.log(
          `[SUCCESS] ${method} ${url} | Duration: ${duration}ms | IP: ${ip} | Response: ${JSON.stringify(maskedResponse)}`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        this.logger.warn(
          `[FAILURE] ${method} ${url} | Duration: ${duration}ms | IP: ${ip} | Error: ${error.message} | Status: ${error.status || 500}`,
        );
        throw error;
      }),
    );
  }

  private maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const masked = { ...data };

    // Mask email addresses
    if (masked.email) {
      const [name, domain] = masked.email.split('@');
      if (name && domain) {
        masked.email = `${name.substring(0, 2)}***@${domain}`;
      }
    }

    // Mask phone numbers
    if (masked.phone) {
      masked.phone = `***${masked.phone.slice(-4)}`;
    }

    // Mask tokens
    if (masked.token) {
      masked.token = `${masked.token.substring(0, 10)}...`;
    }

    // Mask password if ever present
    if (masked.password) {
      masked.password = '***';
    }

    return masked;
  }
}

