import { Module } from '@nestjs/common';
import { AdminVenueTablesController } from './admin-venue-tables.controller.js';
import { AdminVenuesController } from './admin-venues.controller.js';
import { VenueTablesService } from './venue-tables.service.js';
import { VenuesService } from './venues.service.js';

@Module({
  controllers: [AdminVenuesController, AdminVenueTablesController],
  providers: [VenuesService, VenueTablesService],
})
export class VenuesModule {}
