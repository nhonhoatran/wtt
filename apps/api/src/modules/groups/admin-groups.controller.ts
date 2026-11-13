import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { manualRanksBody } from '../draws/draw-dtos.js';
import { GroupAdminService } from './group-admin.service.js';

@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly groups: GroupAdminService) {}

  @Patch(':id/manual-ranks')
  @RequirePermission('tournaments', 'update')
  manualRanks(@Param('id') id: string, @Body() body: unknown) {
    return this.groups.setManualRanks(id, parseBody(manualRanksBody, body));
  }

  @Post(':id/recompute')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  recompute(@Param('id') id: string) {
    return this.groups.recompute(id);
  }
}
