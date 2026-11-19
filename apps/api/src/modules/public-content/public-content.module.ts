import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicContentController } from './public-content.controller.js';

@Module({ controllers: [PublicContentController], providers: [SsrInternalGuard] })
export class PublicContentModule {}
