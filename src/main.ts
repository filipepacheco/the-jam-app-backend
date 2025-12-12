import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS
  app.enableCors({
    origin: function (origin, callback) {
      // Development: Allow all origins
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        callback(null, true);
        return;
      }

      // Production: Allow specific origins
      const allowedOrigins = [
        // localhost variants
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:5174',
        'https://localhost:5174',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000',
        'http://127.0.0.1:5174',
        'https://127.0.0.1:5174',
        // Vercel frontend
        'https://lets-jam-web.vercel.app',
      ];

      // No origin (direct API calls, mobile apps, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is allowed or is a *.vercel.app domain
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        console.warn(`CORS rejected origin: ${origin}`);
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  });

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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Karaoke Jam API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();


