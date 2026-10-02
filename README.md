# Library of Ruina Prototype

Open `index.html` in a browser to run the Canvas prototype. The combat catalog bundle is local, so gameplay does not need to fetch the Tiphereth database at runtime.

## Combat catalog

Run `npm install` once, then `npm run sync:combat-data` to refresh generated catalogs under `combat/cards/`, `combat/passives/`, `combat/effects/`, `combat/abnormality-pages/`, and `combat/stages/` from the Tiphereth lists.

Run `npm run sync:assets` to download the wiki.gg sprite/background/UI collections into `assets/lor/`. Run `npm run sync:assets -- --dialogue-gallery-only` to refresh main-wiki dialogue-gallery portraits discovered from the local character profile list. The current sync finds 188 portraits across 53 character galleries. The importer merges existing manifest entries so manual additions are retained.

Executable rules live in individual ID-based files under `combat/cards/`, `combat/passives/`, and `combat/effects/`. Every synced card can resolve its imported dice, but only explicitly scripted IDs have custom card/passive/page behavior. The stage importer records wave membership, enemy units, keypage IDs, HP, passive IDs, and deck card IDs. The stage selector loads the first unit of a selected encounter's first wave. Most of the 1,005 passive records and 150 abnormality-page records remain metadata-only; this is not full rules coverage.

`combat/progression.js` tracks emotion coins at scene end, floor realization caps, team emotion tiers, page selection, and reception resets. Run `npm run test:combat` for the combat and progression tests. The story panel reads trigger-based scenes from `story/scenes.js`; other game systems can dispatch `story:trigger` with `{ stageId, trigger, flags }`. Scene records support an optional `backgroundUrl`. The opening scene data is in `story/dialogue-local.js`.

Abnormality-page scripts dispatch by imported `scriptId` and can use `onEquip`, `onBeforeDie`, `onAfterDie`, `onDamaged`, `onHit`, `onSceneStart`, and `onSceneEnd`. Scripted statuses currently include Burn, Bleed, Strength, Endurance, Weak, Disarm, Protection, Fragile, Paralysis, Bind, and Haste. Ten Malkuth pages have behavior scripts; Malkuth pages 3–6 and 11, plus the other floors' pages, still need behavior ports. The decompiled C# URLs are recorded, but the source endpoint currently returns HTTP 403 in this environment.

`CombatVfx.setSprite(image, { columns, rows, frameDuration })` configures a spritesheet for hit effects. `CombatVfx.registerAnimation(id, { frames, frameDuration, loop })` registers individual image-frame sequences; combat scripts can play one with `CombatVfx.emit({ animationId: id, x, y })`. The art index can assign a wiki image as the default VFX sheet.

Assistant librarians have per-character appearance data in `combat/assistant-customization.js`: body projection, rear/front hair, skin, eyes, eyebrows, mouth, and idle/attack/hit/block/evade sprites. Use the Art Index's `Assistant:` apply slots to assign parts and colors; selections persist in local storage. Combat changes expressions on attack, hit, block, and evade. The downloaded collections do not currently contain separate hair/face cutout layers, so add those PNGs to `LOCAL_ASSET_GROUPS` in `assets/lor/manifest.js` to use layered customization. Patron librarians do not receive assistant customization state.

The opening scene data is in `story/dialogue-local.js`. Speaker IDs map to locally synced dialogue-gallery variants, and line `expression` fields select a variant. Other scenes can use the same `{ speaker, text }` structure plus `speakerId`/`expression`, `title`, optional `backgroundUrl`, and `requiredFlags`. `npm run test:combat` includes story portrait and local override checks.