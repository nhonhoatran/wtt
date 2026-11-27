import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { allocatePlayerIdentity, Prisma, refreshCompetitorNames, type Player } from '@kamito/db';
import { cleanPersonName, normalizePersonName, playerSettings, stripDiacritics, type PaginationQueryShape, type UserRoleName } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { assertReadyMedia } from '../../common/crud/ready-media.js';
import { booleanFilter, enumFilter, invalidQuery, prismaListQuery, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { loadPlayerTagContext } from '../revalidation/public-tag-context.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { CreatePlayerBody, LookupQuery, UpdatePlayerBody } from './player-dtos.js';
import { resolveBirth } from './player-birth.js';
import { auditFields, countEntriesByPlayer, diffFields, PLAYER_LOOKUP_SELECT, toPlayerDetail, toPlayerListItem } from './player-views.js';

/** Player fields that bracket, groups, entries, schedule and match pages print next to a competitor. */
const PUBLIC_SIDE_FIELDS = ['fullName', 'fullNameEn', 'publicDisplayName', 'club'] as const;

export const PLAYER_LIST_SPEC = {
  sortable: ['code', 'fullName', 'createdAt', 'birthYear'],
  defaultSort: { field: 'createdAt', direction: 'desc' },
  filters: {
    gender: enumFilter('gender', ['MALE', 'FEMALE']),
    club: (value: string) => ({ club: { equals: value, mode: 'insensitive' } }),
    isActive: booleanFilter('isActive'),
    merged: (value: string) => {
      if (value !== 'true' && value !== 'false') throw invalidQuery('merged must be true or false');
      return { mergedIntoId: value === 'true' ? { not: null } : null };
    },
  },
} satisfies ListSpec;

type PlayerWhere = Prisma.PlayerWhereInput;

function searchWhere(q: string | undefined): PlayerWhere {
  if (!q) return {};
  return { OR: [{ normalizedName: { contains: normalizePersonName(q) } }, { code: { contains: q.trim(), mode: 'insensitive' } }] };
}

@Injectable()
export class PlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  async list(query: PaginationQueryShape, role: UserRoleName) {
    const unmergedByDefault: PlayerWhere = query.filter.merged === undefined ? { mergedIntoId: null } : {};
    const page = await prismaListQuery<Player>(
      this.prisma,
      this.prisma.player,
      { ...query, q: undefined },
      PLAYER_LIST_SPEC,
      { baseWhere: { AND: [unmergedByDefault, searchWhere(query.q)] } },
    );
    const counts = await countEntriesByPlayer(this.prisma, page.data.map((player) => player.id));
    return { ...page, data: page.data.map((player) => toPlayerListItem(player, counts.get(player.id) ?? 0, role)) };
  }

  async get(id: string, role: UserRoleName) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { mergedInto: { select: { id: true, code: true, fullName: true } }, _count: { select: { pairsAsA: true, pairsAsB: true } } },
    });
    if (!player) throw notFound();
    const counts = await countEntriesByPlayer(this.prisma, [id]);
    return toPlayerDetail(
      player,
      { entryCount: counts.get(id) ?? 0, pairCount: player._count.pairsAsA + player._count.pairsAsB, mergedInto: player.mergedInto },
      role,
    );
  }

  async lookup(query: LookupQuery) {
    const base: PlayerWhere = { isActive: true, mergedIntoId: null, ...(query.gender && { gender: query.gender }) };
    const select = PLAYER_LOOKUP_SELECT;
    const q = query.q?.trim();
    if (!q) {
      return { data: await this.prisma.player.findMany({ where: base, select, orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }], take: query.limit }) };
    }
    const exact = await this.prisma.player.findMany({ where: { ...base, code: { equals: q, mode: 'insensitive' } }, select, take: query.limit });
    const rest = await this.prisma.player.findMany({
      where: { AND: [base, searchWhere(q), { id: { notIn: exact.map((player) => player.id) } }] },
      select,
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: query.limit - exact.length,
    });
    return { data: [...exact, ...rest] };
  }

  async create(body: CreatePlayerBody, role: UserRoleName) {
    await assertReadyMedia(this.prisma, { photoMediaId: body.photoMediaId });
    const [prefix, digits, defaultCountry] = await Promise.all([
      this.settings.get(playerSettings.codePrefix),
      this.settings.get(playerSettings.codeDigits),
      this.settings.get(playerSettings.defaultCountryCode),
    ]);
    const birth = resolveBirth(null, body);
    const created = await this.transact(() =>
      this.prisma.$transaction(async (tx) => {
        const identity = await allocatePlayerIdentity(tx, { fullName: body.fullName, fullNameEn: body.fullNameEn }, { prefix, digits });
        const row = await tx.player.create({
          data: {
            ...identity,
            gender: body.gender,
            countryCode: body.countryCode ?? defaultCountry,
            publicDisplayName: body.publicDisplayName,
            ...birth,
            club: body.club,
            city: body.city,
            handedness: body.handedness,
            gripStyle: body.gripStyle,
            playStyle: body.playStyle,
            photoMediaId: body.photoMediaId,
            bio: body.bio,
            bioEn: body.bioEn,
            phone: body.phone,
            email: body.email,
            // BTC keeps consent evidence externally; omitted flags never opt a new player in.
            isPublicProfile: body.isPublicProfile ?? false,
            noindex: body.noindex,
            isActive: body.isActive,
          },
        });
        await this.audit.record({ action: 'player.create', entity: 'Player', entityId: row.id, after: { code: row.code, slug: row.slug, ...auditFields(row) } }, tx);
        return { id: row.id, slug: row.slug };
      }),
    );
    const warnings = await this.revalidation.enqueue(() => CACHE_TAGS['player.create']({ playerSlugs: [created.slug], events: [] }));
    return { data: await this.get(created.id, role), ...(warnings.length > 0 && { warnings }) };
  }

  async update(id: string, body: UpdatePlayerBody, role: UserRoleName) {
    const current = await this.prisma.player.findUnique({ where: { id } });
    if (!current) throw notFound();
    if (current.mergedIntoId) throw merged();
    if (body.photoMediaId && body.photoMediaId !== current.photoMediaId) await assertReadyMedia(this.prisma, { photoMediaId: body.photoMediaId });
    const data = this.buildUpdate(current, body);

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.player.findUniqueOrThrow({ where: { id } });
      if (fresh.mergedIntoId) throw merged();
      const row = await tx.player.update({ where: { id }, data });
      const renamed = data.fullName !== undefined && data.fullName !== current.fullName;
      if (renamed) await refreshCompetitorNames(tx, id);
      const { before, after, changed } = diffFields(auditFields(fresh), auditFields(row));
      if (changed) await this.audit.record({ action: 'player.update', entity: 'Player', entityId: id, before, after }, tx);
    });
    const showsOnEventPages = PUBLIC_SIDE_FIELDS.some((key) => data[key] !== undefined && data[key] !== current[key]);
    const warnings = await this.revalidation.enqueue(async () => {
      const context = showsOnEventPages ? await loadPlayerTagContext(this.prisma, [id]) : { playerSlugs: [current.slug], events: [] };
      return CACHE_TAGS['player.update'](context);
    });
    return { data: await this.get(id, role), ...(warnings.length > 0 && { warnings }) };
  }

  private buildUpdate(current: Player, body: UpdatePlayerBody): Prisma.PlayerUncheckedUpdateInput {
    const { fullName, ...rest } = body;
    const plain = Object.fromEntries(Object.entries(rest).filter(([key]) => key !== 'birthDate' && key !== 'birthYear'));
    const data: Prisma.PlayerUncheckedUpdateInput = { ...plain, ...resolveBirth(current, body) };
    if (fullName !== undefined) {
      const cleaned = cleanPersonName(fullName);
      data.fullName = cleaned;
      data.normalizedName = normalizePersonName(cleaned);
      const wasDerived = !current.fullNameEn || current.fullNameEn === stripDiacritics(current.fullName);
      if (body.fullNameEn === undefined && wasDerived) data.fullNameEn = stripDiacritics(cleaned);
    }
    if (body.fullNameEn === null) data.fullNameEn = stripDiacritics(cleanPersonName(fullName ?? current.fullName));
    return data;
  }

  /** A concurrent creator of the same name can take the slug between lookup and insert. */
  private async transact<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'PLAYER_CONFLICT', message: 'Hồ sơ vừa được tạo bởi người khác, hãy thử lại' });
      }
      throw error;
    }
  }
}

const notFound = () => new NotFoundException({ code: 'PLAYER_NOT_FOUND', message: 'Không tìm thấy VĐV' });
const merged = () => new ConflictException({ code: 'PLAYER_MERGED', message: 'Hồ sơ này đã được gộp vào hồ sơ khác, không sửa được' });
