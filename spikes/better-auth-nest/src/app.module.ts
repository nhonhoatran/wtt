import { Module } from '@nestjs/common';
import { AppController } from './app.controllers.js';
import { AuthModule } from './auth/auth.module.js';
import { WrappedSessionController } from './wrapped-session.controller.js';

@Module({ imports: [AuthModule], controllers: [AppController, WrappedSessionController] })
export class AppModule {}
