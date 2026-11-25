import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { expect, it } from 'vitest';
import type { PublicBracket, PublicBracketMatch, PublicBracketRound, PublicEventDetail } from '@kamito/shared';
import { BracketBoard } from '../../src/components/bracket/bracket-board';
import { EventShell } from '../../src/components/events/event-shell';
import { SubEventChooser } from '../../src/components/events/sub-event-chooser';
import { PillNav } from '../../src/components/common/pill-nav';
import bracketClasses from '../../src/components/bracket/bracket.module.css';
import scrollClasses from '../../src/components/common/scroll-region.module.css';
import playerClasses from '../../src/components/players/players.module.css';
import badgeClasses from '../../src/components/common/live-badge.module.css';
import heroClasses from '../../src/components/events/event-hero.module.css';
import navClasses from '../../src/components/common/pill-nav.module.css';
import { getDictionary } from '../../src/i18n/get-dictionary';
import { pickLocalized } from '../../src/i18n/pick-localized';

const clientRoot = path.resolve(import.meta.dirname, '../..');
const output = path.join(clientRoot, 'test-results/bracket-print');

/** CSS-module class names are supplied by Vite, while declarations come from the actual source. */
async function moduleCss(relative: string, names: Record<string, string>): Promise<string> {
  const css = await readFile(path.join(clientRoot, relative), 'utf8');
  return css.replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/\.([_a-z][\w-]*)/gi, (whole, name: string) => `.${names[name] ?? whole.slice(1)}`);
}

async function productionFonts(): Promise<string> {
  const chunks = path.join(clientRoot, '.next/static/chunks');
  const faces: string[] = [];
  for (const file of await readdir(chunks)) {
    if (!file.endsWith('.css')) continue;
    const css = await readFile(path.join(chunks, file), 'utf8');
    for (const [face] of css.matchAll(/@font-face\{[^}]+\}/g)) {
      if (!face.includes('font-family:Archivo;')) continue;
      let result = face;
      for (const [reference, filename] of face.matchAll(/url\(\.\.\/media\/([^)]*)\)/g)) {
        const bytes = await readFile(path.join(clientRoot, '.next/static/media', filename!));
        result = result.replace(reference, `url(data:font/woff2;base64,${bytes.toString('base64')})`);
      }
      faces.push(result);
    }
  }
  if (!faces.length) throw new Error('Build the Next client first: the offline print check uses its real Archivo font.');
  return faces.join('\n');
}

function fixture(size: number, doubles: boolean): PublicBracket {
  const rounds: PublicBracketRound[] = [];
  let matchNo = 0;
  let previous: PublicBracketMatch[] = [];
  for (let slots = size; slots >= 2; slots /= 2) {
    const matches: PublicBracketMatch[] = Array.from({ length: slots / 2 }, (_, index) => {
      const number = ++matchNo;
      const side = (offset: number) => ({
        seed: index === 0 ? offset + 1 : null,
        quota: null,
        players: Array.from({ length: doubles ? 2 : 1 }, (_, player) => ({
          name: `Nguyễn Phương Hoàng Minh Châu ${index * 2 + offset + 1}${player ? 'B' : 'A'}`,
          nameEn: `Nguyen Phuong Hoang Minh Chau ${index * 2 + offset + 1}${player ? 'B' : 'A'}`,
          club: 'Câu lạc bộ bóng bàn thử nghiệm', slug: null,
        })),
      });
      return {
        matchNo: number, orderInRound: index + 1, status: 'SCHEDULED', resultType: null,
        winnerSide: null, games1: null, games2: null, scheduledAt: null, table: null, games: [],
        side1: slots === size ? side(0) : null, side2: slots === size ? side(1) : null,
        side1Source: slots === size ? null : { type: 'WINNER_OF', matchNo: previous[index * 2]!.matchNo },
        side2Source: slots === size ? null : { type: 'WINNER_OF', matchNo: previous[index * 2 + 1]!.matchNo },
      };
    });
    rounds.push({ code: slots === 2 ? 'F' : slots === 4 ? 'SF' : slots === 8 ? 'QF' : `R${slots}`, number: rounds.length + 1, matches });
    previous = matches;
  }
  return {
    event: { slug: 'offline-print', name: 'Giải kiểm tra bản in', nameEn: 'Print verification tournament', timezone: 'Asia/Ho_Chi_Minh' },
    subEvent: { code: doubles ? 'MD' : 'MS', name: doubles ? 'Đôi nam' : 'Đơn nam', nameEn: doubles ? "Men's doubles" : "Men's singles" },
    draw: { kind: 'MAIN', size, publishedAt: null }, availableKinds: ['MAIN'], sections: [{ section: 1, rounds }],
  };
}

function fullEvent(bracket: PublicBracket): PublicEventDetail {
  const sub = (code: string, name: string, nameEn: string) => ({ code, name, nameEn, format: 'KNOCKOUT' as const, competitorKind: 'SINGLES' as const, drawKinds: ['MAIN', 'QUALIFYING'] as const, hasGroups: false, entryCount: 64 });
  return {
    ...bracket.event, shortName: null, startDate: '2026-11-20', endDate: '2026-11-22', lifecycle: 'ONGOING',
    city: 'Thành phố Hồ Chí Minh', venue: { name: 'Nhà thi đấu thể thao đa năng', nameEn: 'Indoor sports arena', address: null, mapUrl: null },
    tier: { code: 'OPEN', name: 'Giải mở rộng', nameEn: 'Open tournament', colorHex: '#EC1E24' },
    eventType: { code: 'OPEN', name: 'Mở rộng', nameEn: 'Open', colorHex: null }, banner: null,
    summary: 'Giải đấu quy tụ các vận động viên trên toàn quốc, thi đấu nội dung đơn và đôi trong ba ngày. Thông tin lịch thi đấu, nhánh đấu và kết quả được cập nhật để khán giả theo dõi xuyên suốt giải.',
    summaryEn: 'Players from across the country compete in singles and doubles over three days. The tournament provides schedules, draws and results so spectators can follow every stage of the competition.',
    presentedBy: 'Đơn vị đồng hành cùng giải đấu bóng bàn', ticketUrl: 'https://example.test/tickets',
    subEvents: [sub('MS', 'Đơn nam', "Men's singles"), sub('MD', 'Đôi nam', "Men's doubles")].map((value) => ({ ...value, drawKinds: [...value.drawKinds] })),
    days: [],
    hasPublicMatches: true,
    tabs: { draws: true, matches: true, groups: true, players: true, info: true },
    stats: { players: 128, playedMatches: 0 }, champions: [],
  };
}

it('keeps 64-slot singles and doubles readable on screen and A4/A3 print sheets', async () => {
  await mkdir(output, { recursive: true });
  const css = (await Promise.all([
    productionFonts(),
    readFile(path.join(clientRoot, '../../packages/ui-tokens/dist/tokens.css'), 'utf8'),
    readFile(path.join(clientRoot, 'src/app/[locale]/global.css'), 'utf8'),
    moduleCss('src/components/bracket/bracket.module.css', bracketClasses),
    moduleCss('src/components/common/scroll-region.module.css', scrollClasses),
    moduleCss('src/components/players/players.module.css', playerClasses),
    moduleCss('src/components/common/live-badge.module.css', badgeClasses),
    moduleCss('src/components/events/event-hero.module.css', heroClasses),
    moduleCss('src/components/common/pill-nav.module.css', navClasses),
  ])).join('\n');
  const browser = await chromium.launch();
  const metrics: object[] = [];
  try {
    for (const doubles of [false, true]) {
      for (const locale of ['vi', 'en'] as const) {
        const bracket = fixture(64, doubles);
        const event = fullEvent(bracket);
        const t = getDictionary(locale);
        const html = renderToStaticMarkup(createElement(EventShell, { event, locale, t, active: 'draws', children: createElement(Fragment, null,
          createElement(SubEventChooser, { subEvents: event.subEvents, current: bracket.subEvent.code, hrefFor: (code: string) => `/draws/${code}`, locale, t }),
          createElement('h2', { className: 'section-title', 'data-bracket-title': true }, `${t.bracket.title} · ${pickLocalized(locale, bracket.subEvent.name, bracket.subEvent.nameEn)}`),
          createElement(PillNav, { label: t.bracket.title, items: [{ href: '?draw=main', label: t.bracket.kind.MAIN, current: true }, { href: '?draw=qualifying', label: t.bracket.kind.QUALIFYING, current: false }] }),
          createElement(BracketBoard, { bracket, locale, t: t.bracket }),
        ) }));
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><html lang="${locale}"><head><style>${css}\nhtml{font-family:Archivo,sans-serif}</style></head><body><header>Site header</header>${html}<footer>Site footer</footer></body></html>`);
        await page.evaluate(() => document.fonts.ready);
        const id = `${doubles ? 'doubles' : 'singles'}-${locale}`;
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ media: 'screen' });
          const screen = await page.evaluate(() => ({
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            ids: Array.from(document.querySelectorAll<HTMLElement>('[data-screen-bracket] [data-match-number]'), (match) => Number(match.dataset.matchNumber)),
            printHidden: Array.from(document.querySelectorAll<HTMLElement>('[data-print-bracket]'), (element) => getComputedStyle(element).display === 'none').every(Boolean),
          }));
          metrics.push({ id, screen });
          expect(screen.scrollWidth).toBeLessThanOrEqual(width);
          expect(screen.ids.toSorted((a, b) => a - b)).toEqual(Array.from({ length: 63 }, (_, i) => i + 1));
          expect(screen.printHidden).toBe(true);
          expect(await page.locator('[data-event-hero]').isVisible()).toBe(true);
          expect(await page.locator('[data-bracket-title]').isVisible()).toBe(true);
          await page.screenshot({ path: path.join(output, `${id}-${width}.png`), fullPage: true });
        }
        for (const [paper, width, height] of [['A4', 1047, 718], ['A3', 1511, 1047]] as const) {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ media: 'print' });
          const print = await page.evaluate(({ className }) => {
            const clipped = Array.from(document.querySelectorAll<HTMLElement>(`.${className}`)).filter((name) => name.getBoundingClientRect().width > 0 && name.scrollWidth > name.clientWidth + 1);
            return {
              clipped: clipped.length, scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
              ids: Array.from(document.querySelectorAll<HTMLElement>('[data-print-bracket] [data-match-number]'), (match) => Number(match.dataset.matchNumber)),
              sheetHeights: Array.from(document.querySelectorAll('[data-print-sheet]'), (sheet) => Math.ceil(sheet.getBoundingClientRect().height)),
              screenHidden: getComputedStyle(document.querySelector<HTMLElement>('[data-screen-bracket]')!).display === 'none',
              chromeHidden: ['header', 'footer'].every((selector) => getComputedStyle(document.querySelector(selector)!).display === 'none'),
            };
          }, { className: bracketClasses.name });
          const pdf = await page.pdf({ path: path.join(output, `${id}-${paper}.pdf`), format: paper, landscape: true, printBackground: true, preferCSSPageSize: true });
          // Chromium emits one plain Page dictionary per sheet; pypdf is also used for the manual PDF audit.
          const pdfPages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
          metrics.push({ id, paper, print, pdfPages, availableHeight: height });
          expect(await page.locator('[data-event-hero]').isVisible()).toBe(false);
          expect(await page.locator('[data-bracket-title]').isVisible()).toBe(false);
          await page.screenshot({ path: path.join(output, `${id}-${paper}-print.png`), fullPage: true });
        }
        // Small draws keep the ordinary event hero/title on paper; only split prints suppress them.
        const small = renderToStaticMarkup(createElement(EventShell, { event, locale, t, active: 'draws', children: createElement(Fragment, null,
          createElement('h2', { className: 'section-title', 'data-bracket-title': true }, t.bracket.title),
          createElement(BracketBoard, { bracket: fixture(8, doubles), locale, t: t.bracket }),
        ) }));
        await page.setContent(`<!doctype html><html lang="${locale}"><head><style>${css}\nhtml{font-family:Archivo,sans-serif}</style></head><body>${small}</body></html>`);
        expect(await page.locator('[data-event-hero]').isVisible()).toBe(true);
        expect(await page.locator('[data-bracket-title]').isVisible()).toBe(true);
        expect(await page.locator('[data-print-bracket]').count()).toBe(0);
        expect(await page.locator('[data-screen-bracket] [data-match-number]').count()).toBe(7);
        await page.close();
      }
    }
    await writeFile(path.join(output, 'metrics.json'), JSON.stringify(metrics, null, 2));
    for (const result of metrics as { print?: { clipped: number; ids: number[]; scrollWidth: number; width: number; sheetHeights: number[]; screenHidden: boolean; chromeHidden: boolean }; pdfPages?: number; availableHeight?: number }[]) {
      if (!result.print) continue;
      expect(result.print.clipped).toBe(0);
      expect(result.print.scrollWidth).toBeLessThanOrEqual(result.print.width);
      expect(result.print.ids.toSorted((a, b) => a - b)).toEqual(Array.from({ length: 63 }, (_, i) => i + 1));
      expect(result.print.sheetHeights).toHaveLength(5);
      expect(Math.max(...result.print.sheetHeights)).toBeLessThanOrEqual(result.availableHeight!);
      expect(result.print.screenHidden && result.print.chromeHidden).toBe(true);
      expect(result.pdfPages).toBe(5);
    }
  } finally {
    await browser.close();
  }
});
