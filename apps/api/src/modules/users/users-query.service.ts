import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { isUserRole, type PaginationQueryShape } from '@kamito/shared';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_VIEW_SELECT } from './user-dtos.js';

export const USER_LIST_RULES = {
  sortable: ['createdAt', 'name', 'email', 'role', 'lastLoginAt'],
  filterable: ['role', 'isActive'],
} as const;

@Injectable()
export class UsersQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryShape) {
    const where = this.buildWhere(query);
    const orderBy = query.sort ? { [query.sort.field]: query.sort.direction } : { createdAt: 'desc' as const };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: USER_VIEW_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPaginatedResult(data, total, query);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_VIEW_SELECT });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return user;
  }

  private buildWhere({ q, filter }: PaginationQueryShape): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (filter.role) {
      const roles = filter.role.split(',');
      if (!roles.every(isUserRole)) throw new BadRequestException({ code: 'INVALID_QUERY', message: 'Unknown role' });
      where.role = { in: roles };
    }
    if (filter.isActive) {
      if (!['true', 'false'].includes(filter.isActive)) {
        throw new BadRequestException({ code: 'INVALID_QUERY', message: 'isActive must be true or false' });
      }
      where.isActive = filter.isActive === 'true';
    }
    return where;
  }
}
