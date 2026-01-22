import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isDevelopment = nodeEnv === 'development';

  // Handle preflight OPTIONS requests BEFORE everything else
  // This ensures CORS headers are sent immediately without redirects
  app.use((req, res, next) => {
    const origin = req.get('origin');

    // Log for debugging
    if (req.method === 'OPTIONS') {
      logger.debug(`[CORS Preflight] OPTIONS ${req.path} from origin: ${origin}`);
    }

    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://localhost:5174',
      'http://localhost:5173',
      'https://localhost:5174',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
      'http://127.0.0.1:5174',
      'https://127.0.0.1:5174',
      // Vercel frontends
      'https://karaoke-jam-frontend.vercel.app',
      'https://lets-jam-web.vercel.app',
      // Custom domains
      'https://jamapp.com.br',
      'https://www.jamapp.com.br',
    ];

    const isAllowed =
      isDevelopment || !origin || allowedOrigins.includes(origin) || origin?.endsWith('.vercel.app');

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
    }

    // Set security headers
    res.header('Referrer-Policy', 'no-referrer-when-downgrade');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');

    // Handle preflight OPTIONS requests immediately - MUST return 204, not 200
    if (req.method === 'OPTIONS') {
      logger.debug('[CORS] Preflight request allowed - responding with 204');
      return res.sendStatus(204);
    }

    next();
  });

  // Enable CORS as a secondary layer for all actual requests
  app.enableCors({
    origin: function (origin: string, callback: (arg0: Error | null, arg1: boolean) => void) {
      if (isDevelopment) {
        callback(null, true);
        return;
      }

      const allowedOrigins = [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:5174',
        'https://localhost:5174',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000',
        'http://127.0.0.1:5174',
        'https://127.0.0.1:5174',
        // Vercel frontends
        'https://karaoke-jam-frontend.vercel.app',
        'https://lets-jam-web.vercel.app',
        // Custom domains
        'https://jamapp.com.br',
        'https://www.jamapp.com.br',
      ];

      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        logger.warn(`[CORS] Origin rejected: ${origin}`);
        callback(new Error('CORS not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Karaoke Jam API')
    .setDescription('API for organizing in-person Jam Sessions in real-time')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`Karaoke Jam API running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
