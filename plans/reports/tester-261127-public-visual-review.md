# Fresh public visual review — 2026-11-27

## Result and evidence

Opened all 80 fresh accessibility captures from the production browser run `test-results/261127-debt-verification/public-r02/`: 20 routes × Vietnamese/English × desktop 1440/mobile 390. Prepared and opened 20 route mosaics containing all four variants, preserving the complete page in each. Also opened four raw Vietnamese captures of the global players list and event info/schedule at 1440/390. Compared the seven canonical desktop Figma frames and three canonical mobile frames directly. No blocking visual defect found in the captured scope.

The run's JSON confirms **126 passed, 16 skipped, zero unexpected failures, zero flaky tests**, duration 197.809 seconds. Four attached accessibility summaries contain 20 routes each and zero violations (80 scans). These are checks against the production API/client stack seeded by the lead, not mocked page captures. This reviewer only read generated evidence and did not access or change the database.

Images and manifest: `test-results/261127-debt-verification/public-r02/visual-review/{00-home.png,…,19-contact.png,capture-manifest.json}`. The manifest maps every original PNG to its mosaic. Raw screenshots remain under `public-r02/artifacts/`. Generated evidence stays ignored.

## Route review

| Capture indices | Routes opened in all four variants | Observation |
|---|---|---|
| 0 | Home | Dark hero, responsive CTAs, event/news/video sections, navy ranking section and footer remain coherent. Missing banner/ticker/sponsors reflect fixture/configuration; no placeholder content was added to imitate Figma |
| 1, 4, 5 | Events, filtered events, calendar | Navy date blocks, month grouping and filters match the established shell. Mobile rows stack without page overflow; status chips use their own horizontal navigation |
| 2, 3 | Empty search and results | Instructions, labeled form, independent event/player sections and full-list links remain legible in both languages. Wide player columns stay in their table scroll region |
| 6, 7 | Event overview and matches | Full/slim dark hero, underlined tabs, desktop table/mobile match cards, sub-event cards and quick-info sections remain readable |
| 8, 9 | Draw and chosen second round | Desktop navy round columns/progression lines and mobile round chips/next-round card match the approved structure. BYEs and unresolved winners are labeled explicitly |
| 10 | Groups | Navy headers, compact mobile standings and match cards have no visible overlap or lost names |
| 11, 12 | Knockout and group match | Navy score hero, per-game table where applicable, summary and contextual links remain usable; the game table scrolls within its own region on mobile |
| 13, 14 | Rankings overview and full list | Full list changes to stacked disclosure rows at 390. Names wrap, movement retains text/arrow, points and pagination remain visible |
| 15 | Player profile | Dark profile hero, statistics, match results and current-ranking cards stack in order. Only fixture public fields appear; omitted sporting details were not invented |
| 16–19 | Article, video, static page, contact | Long UUID fixture headings wrap without overlapping; video stays behind its play action; form fields and footer fit the viewport |
| Extra Vietnamese captures | Global players list, event info/schedule | Filters fit; names and schedule context remain readable. Wide rank/status columns stay within their own table scroll regions |

## Figma comparison

Canonical frames opened: desktop `1-3` (rankings), `1-8` (event), `1-11` (match), `1-14` (events), `1-19` (profile), `1-24` (draw), `1-28` (home); mobile `1-31`, `1-34`, `1-37`. This follows the existing gap analysis that chooses the last frame in each section.

The observed deviations remain the approved implementation choices: configurable site-name wordmark/navigation, accessible darker small-text colors and persistent footer links; dedicated groups tab; no invented registration deadlines, prize money, referee identity or private playing-style data; ranking disclosure built from semantic HTML; no decorative statistics manufactured from sample Figma numbers. Search is now enabled as authorized. Content/image density varies with the tagged fixture and settings.

The 80 accessibility captures cover the routes listed above; the four extra raw images add the event info/schedule and global players list in Vietnamese. Fresh English shots for those two routes, the event entry list, news list, video list and an expanded ranking disclosure are outside this evidence. The public suite tests several of those behaviors separately. Their visual acceptance should be based on their own captures, rather than relabeling these 84 as every canonical public page.

## Print and remaining gates

C7 print evidence is separate: all eight A4/A3 singles/doubles PDFs in vi/en were audited, all 40 pages rendered and opened. See [client/print report](tester-261127-debt-closure-client.md).

This review closes the 80-image comparison itself. Final integrated scheduling/color interaction, any additional capture scope, repository-wide review and staging acceptance retain their own evidence/status; a local browser result does not substitute for staging or identify the earlier native Windows crash.
