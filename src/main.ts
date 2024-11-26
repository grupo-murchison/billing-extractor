import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, LogLevel, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

const logLevel: LogLevel[] = ['debug', 'error', 'log', 'verbose', 'warn'];
const apiTitle: string = 'Billing Extractor';
const apiDescription: string = 'REST API para consumir Visma Services.';
const apiVersion: string = '1.0';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: logLevel });
  const configService = app.get(ConfigService);
  const appPort = configService.get('APP_PORT');

  app.enableCors();
  app.enableVersioning({ type: VersioningType.URI });

  app.setGlobalPrefix('billing-extractor/api');

  const config = new DocumentBuilder()
    .setTitle(apiTitle)
    .setDescription(apiDescription)
    .setVersion(apiVersion)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(appPort);

  const logger = new Logger(apiTitle);
  logger.verbose(`API started!`);
  logger.verbose(`HTTP - Web Server: ${await app.getUrl()}`);
}
bootstrap();
