import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';

async function generateSwagger() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Karaoke Jam API')
    .setDescription('Backend API para organização de Jam Sessions presenciais em tempo real')
    .setVersion('0.0.1')
    .addTag('jam-sessions')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  fs.writeFileSync('./swagger.yaml', require('js-yaml').dump(document));

  console.log('Swagger files generated: swagger.json and swagger.yaml');
  await app.close();
}

generateSwagger();