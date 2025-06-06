import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MainController } from './main/main.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseService } from './services/database.service';
import { SoftlandGatewayService } from './services/softland-gateway.service';
import { TaskService } from './services/task.service';
import { ScheduleModule } from '@nestjs/schedule';
import * as https from 'https';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, 
      }),
    }),

    ConfigModule.forRoot({
      envFilePath: `env/${process.env.NODE_ENV || 'local'}.env`,
    }),

    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],

  providers: [DatabaseService, SoftlandGatewayService, TaskService],

  controllers: [MainController],
})
export class AppModule {}
