import type { AuthTestKit } from './auth-test-kit.js';
import { createPlayer, type Fixtures } from './entries-fixtures.js';

/** Players are created through the API in small batches; competitors are shared across sub-events. */
export class DrawFixtureKit {
  private readonly competitors = new Map<string, string>();
  readonly players: { id: string; fullName: string }[] = [];

  constructor(
    private readonly kit: AuthTestKit,
    private readonly cookie: string,
    private readonly fx: Fixtures,
  ) {}

  async ensurePlayers(count: number): Promise<void> {
    while (this.players.length < count) {
      const batch = Math.min(10, count - this.players.length);
      const base = this.players.length;
      const created = await Promise.all(
        Array.from({ length: batch }, (_, i) =>
          createPlayer(this.kit, this.cookie, this.fx, { fullName: `Draw ${base + i + 1} ${this.fx.tag}`, gender: 'MALE' }),
        ),
      );
      this.players.push(...created);
    }
  }

  private async competitorOf(index: number): Promise<string> {
    const player = this.players[index]!;
    let id = this.competitors.get(player.id);
    if (!id) {
      const row = await this.kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
      id = row.id;
      this.competitors.set(player.id, id);
    }
    return id;
  }

  /** Confirmed entries for players [from, from + count); `seeds` assigns seed i+1 to the first entries. */
  async addEntries(subEventId: string, from: number, count: number, opts: { stage?: 'MAIN' | 'QUALIFYING'; seeds?: number } = {}) {
    await this.ensurePlayers(from + count);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const entry = await this.kit.prisma.entry.create({
        data: {
          subEventId,
          competitorId: await this.competitorOf(from + i),
          stage: opts.stage ?? 'MAIN',
          seed: i < (opts.seeds ?? 0) ? i + 1 : null,
        },
      });
      ids.push(entry.id);
    }
    return ids;
  }
}
