import * as cheerio from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const baseUrl = 'https://tiphereth.zasz.su';
const includeScriptMetadata = process.argv.includes('--script-metadata');
const outputPaths = {
  cards: fileURLToPath(new URL('../combat/cards/catalog.js', import.meta.url)),
  passives: fileURLToPath(new URL('../combat/passives/catalog.js', import.meta.url)),
  effects: fileURLToPath(new URL('../combat/effects/catalog.js', import.meta.url)),
  abnormalityPages: fileURLToPath(new URL('../combat/abnormality-pages/catalog.js', import.meta.url)),
  stages: fileURLToPath(new URL('../combat/stages/catalog.js', import.meta.url)),
};

function readDice($, card) {
  const dice = [];
  $(card).find('lor-card-desc tr[data-type]').each((_, row) => {
    const rangeText = $(row).find('.range').first().text().trim();
    const range = rangeText.match(/^(\d+)\s*-\s*(\d+)$/);
    const die = {
      kind: $(row).attr('data-type') || '',
      damageType: $(row).attr('data-detail') || '',
      min: range ? Number(range[1]) : null,
      max: range ? Number(range[2]) : null,
      description: $(row).find('.desc').first().text().trim(),
    };
    const signature = JSON.stringify(die);
    if (!dice.some((existing) => JSON.stringify(existing) === signature)) dice.push(die);
  });
  return dice;
}

function parseEntry($, element, kind) {
  if (kind === 'cards') {
    const id = $(element).attr('data-id');
    return {
      id,
      name: $(element).find('lor-card-name').first().text().trim(),
      rarity: $(element).attr('data-rarity') || '',
      availability: $(element).attr('data-availability') || '',
      dice: readDice($, element),
      source: `${baseUrl}/cards/${id}/`,
    };
  }
  if (kind === 'passives') {
    const id = $(element).attr('data-id');
    return {
      id,
      name: $(element).find('lor-passive-name').first().text().trim(),
      cost: Number($(element).find('lor-passive-cost').first().text().trim()) || 0,
      rarity: $(element).attr('data-rarity') || '',
      usage: $(element).attr('data-usage') || '',
      description: $(element).find('lor-passive-desc').first().text().trim(),
      source: `${baseUrl}/passives/${id}/`,
    };
  }
  const id = $(element).attr('id');
  return {
    id,
    name: $(element).find('lor-gen-name').first().text().trim(),
    description: $(element).find('lor-gen-desc').first().text().trim(),
    source: `${baseUrl}/effects/${id}/`,
  };
}

async function readCatalog(kind, route, selector) {
  const entries = [];
  const visited = new Set();
  let pageUrl = new URL(route, baseUrl);

  while (pageUrl && !visited.has(pageUrl.href)) {
    visited.add(pageUrl.href);
    const response = await fetch(pageUrl);
    if (!response.ok) throw new Error(`Could not fetch ${pageUrl}: ${response.status}`);
    const $ = cheerio.load(await response.text());
    $(selector).each((_, element) => entries.push(parseEntry($, element, kind)));
    const nextPath = $('link[rel="next"]').attr('href');
    pageUrl = nextPath ? new URL(nextPath, pageUrl) : null;
  }

  const uniqueEntries = new Map(entries.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  return [...uniqueEntries.values()];
}

async function enrichScriptMetadata(entries, kind) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (nextIndex < entries.length) {
      const index = nextIndex;
      nextIndex += 1;
      const entry = entries[index];
      let response;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(entry.source, { headers: { 'User-Agent': 'LocalGameCatalogSync/1.0' } });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
      if (!response?.ok) {
        entry.scriptReferenceStatus = `unavailable:${response?.status || 'network'}`;
        continue;
      }

      const $ = cheerio.load(await response.text());
      const scriptRow = $('tr').filter((_, row) => $(row).children('td').first().text().trim().toLowerCase() === 'script').first();
      const sourceLink = scriptRow.find('a[href^="/src/cs/"]').first();
      if (sourceLink.length) {
        entry.scriptClass = sourceLink.text().trim().replace(/^::/, '');
        entry.scriptSource = new URL(sourceLink.attr('href'), baseUrl).href;
      }

      if (kind === 'cards') {
        const xml = $('.simple-code-block').text();
        const scriptTag = xml.match(/<Script\b[^>]*>([^<]*)<\/Script>|<Script\s+([^/>]+)\/>/i);
        const scriptAttribute = scriptTag?.[2]?.match(/(?:^|\s)Script="([^"]+)"/i)?.[1];
        const scriptValue = (scriptTag?.[1] || scriptAttribute || '').trim();
        if (scriptValue) entry.cardScriptId = scriptValue;
        entry.behaviourScriptIds = [...new Set([...xml.matchAll(/\bScript="([^"]+)"/g)].map((match) => match[1]).filter(Boolean))];
      }
      entry.scriptReferenceStatus = entry.scriptClass || entry.cardScriptId || entry.behaviourScriptIds?.length ? 'linked' : 'not-found';
    }
  }));
  return entries;
}

async function readAbnormalityPages() {
  const response = await fetch(new URL('/abno_pages/', baseUrl));
  if (!response.ok) throw new Error(`Could not fetch abnormality pages: ${response.status}`);
  const $ = cheerio.load(await response.text());
  const tierNumbers = { 'Ⅰ': 1, 'Ⅱ': 2, 'Ⅲ': 3 };
  const pages = [];

  $('section.tab[data-sephirah]').each((_, section) => {
    const floorId = $(section).attr('data-sephirah');
    $(section).find('.group-abno').each((_, group) => {
      const abnormalityName = $(group).find('.abno-heading').first().text().trim();
      $(group).find('lor-card.abno-page').each((_, element) => {
        const card = $(element);
        const sourcePath = card.closest('article').find('a.hover-area').attr('href');
        const pageNumber = sourcePath?.split('/').filter(Boolean).at(-1);
        if (!pageNumber) return;
        const headingIcons = card.find('lor-card-heading lor-card-icon');
        const tierNumber = tierNumbers[headingIcons.first().text().trim()];
        if (!tierNumber) return;
        pages.push({
          id: `${floorId}:${pageNumber}`,
          floorId,
          abnormalityName,
          name: card.find('lor-card-name').first().text().trim(),
          tier: tierNumber,
          emotionState: card.attr('data-ec-state') || '',
          emotionCost: headingIcons.eq(1).text().trim(),
          spriteId: card.find('lor-card-image [data-img]').first().attr('data-img') || '',
          source: new URL(sourcePath, baseUrl).href,
        });
      });
    });
  });
  return enrichAbnormalityPages([...new Map(pages.map((page) => [page.id, page])).values()]);
}

async function enrichAbnormalityPages(pages) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (nextIndex < pages.length) {
      const index = nextIndex;
      nextIndex += 1;
      const page = pages[index];
      let response;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(page.source, { headers: { 'User-Agent': 'LocalGameCatalogSync/1.0' } });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
      if (!response?.ok) {
        page.scriptReferenceStatus = `unavailable:${response?.status || 'network'}`;
        continue;
      }

      const $ = cheerio.load(await response.text());
      const description = $('#ec-desc').text().trim();
      const targeting = $('.ent-info-table tr').filter((_, row) => $(row).children('td').first().text().trim() === 'Targeting')
        .first().children('td').eq(1).text().trim();
      const scriptRow = $('.ent-info-table tr').filter((_, row) => $(row).children('td').first().text().trim() === 'Script').first();
      const sourceLink = scriptRow.find('a[href^="/src/cs/"]').first();
      const xml = $('.simple-code-block').text();
      const scriptId = xml.match(/<Script>([^<]*)<\/Script>/i)?.[1]?.trim() || '';
      page.description = description;
      page.targeting = targeting;
      if (scriptId) page.scriptId = scriptId;
      if (sourceLink.length) {
        page.scriptClass = sourceLink.text().trim().replace(/^::/, '');
        page.scriptSource = new URL(sourceLink.attr('href'), baseUrl).href;
      }
      page.scriptReferenceStatus = page.scriptClass || page.scriptId ? 'linked' : 'not-found';
    }
  }));
  return pages;
}

async function readStage(stageLink) {
  const stageUrl = new URL(`/stages/${stageLink.id}/embed/`, baseUrl);
  const response = await fetch(stageUrl);
  if (!response.ok) {
    return { ...stageLink, name: stageLink.name || stageLink.id, source: stageUrl.href, loadError: response.status, waves: [], units: [] };
  }
  const $ = cheerio.load(await response.text());
  const wavesById = new Map();
  $('.wave-radio[data-wave]').each((_, element) => {
    const waveId = $(element).attr('data-wave');
    wavesById.set(waveId, { id: waveId, unitIds: [] });
  });
  $('.unit-radio[data-wave][data-unit]').each((_, element) => {
    const waveId = $(element).attr('data-wave');
    const unitId = $(element).attr('data-unit');
    if (wavesById.has(waveId)) wavesById.get(waveId).unitIds.push(unitId);
  });

  const units = new Map();
  $('.unit[data-unit]').each((_, element) => {
    const unit = $(element);
    const id = unit.attr('data-unit');
    const keypagePath = unit.find('h3 a[href^="/keypages/"]').attr('href');
    const keypageId = keypagePath?.split('/').filter(Boolean).at(-1) || '';
    const bookImagePath = unit.find('.unit-data > img').attr('src') || '';
    const stat = (selector) => unit.find(selector).first().text().trim();
    units.set(id, {
      id,
      name: unit.find('h3').first().text().trim(),
      keypageId,
      hp: Number(stat('.kp-hp')) || 0,
      staggerHp: Number(stat('.kp-sr')) || 0,
      speed: stat('.kp-spd'),
      bookImageUrl: bookImagePath ? new URL(bookImagePath, baseUrl).href : '',
      passiveIds: unit.find('.unit-passives lor-passive[data-id]').map((_, passive) => $(passive).attr('data-id')).get(),
      cardIds: unit.find('.unit-deck lor-card[data-id]').map((_, card) => $(card).attr('data-id')).get(),
    });
  });

  return {
    ...stageLink,
    name: $('main h1').first().text().trim() || stageLink.name || stageLink.id,
    source: new URL(`/stages/${stageLink.id}/`, baseUrl).href,
    waves: [...wavesById.values()],
    units: [...units.values()],
  };
}

async function readStages() {
  const response = await fetch(new URL('/stages/', baseUrl));
  if (!response.ok) throw new Error(`Could not fetch stages: ${response.status}`);
  const $ = cheerio.load(await response.text());
  const links = new Map();
  $('a.rec-link[data-rec-id]').each((_, element) => {
    const id = $(element).attr('data-rec-id');
    if (!id || links.has(id)) return;
    links.set(id, {
      id,
      name: $(element).text().trim(),
      type: $(element).attr('data-rec-type') || 'Story',
    });
  });

  const stageLinks = [...links.values()];
  const stages = [];
  for (let index = 0; index < stageLinks.length; index += 5) {
    const batch = stageLinks.slice(index, index + 5);
    stages.push(...await Promise.all(batch.map(readStage)));
  }
  return stages;
}

const catalog = {
  source: baseUrl,
  syncedAt: new Date().toISOString(),
  cards: await readCatalog('cards', '/cards/', 'lor-card[data-id]'),
  passives: await readCatalog('passives', '/passives/', 'lor-passive[data-id]'),
  effects: await readCatalog('effects', '/effects/', 'lor-gen-entity.lor-effect[id]'),
  abnormalityPages: await readAbnormalityPages(),
  stages: await readStages(),
};

if (includeScriptMetadata) {
  for (const kind of ['cards', 'passives', 'effects']) {
    console.log(`Reading script references for ${catalog[kind].length} ${kind}...`);
    catalog[kind] = await enrichScriptMetadata(catalog[kind], kind);
  }
}

for (const [kind, outputPath] of Object.entries(outputPaths)) {
  const globalNames = { abnormalityPages: 'ABNORMALITY_PAGE_CATALOG', stages: 'STAGE_CATALOG' };
  const globalName = globalNames[kind] || `TIPHERETH_CATALOG.${kind}`;
  const output = globalNames[kind]
    ? `/* Generated by npm run sync:combat-data. */\nwindow.${globalName} = ${JSON.stringify(catalog[kind], null, 2)};\n`
    : [
      '/* Generated by npm run sync:combat-data. */',
      'window.TIPHERETH_CATALOG = window.TIPHERETH_CATALOG || {};',
      `window.TIPHERETH_CATALOG.source = ${JSON.stringify(catalog.source)};`,
      `window.TIPHERETH_CATALOG.syncedAt = ${JSON.stringify(catalog.syncedAt)};`,
      `window.${globalName} = ${JSON.stringify(catalog[kind], null, 2)};`,
      '',
    ].join('\n');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, 'utf8');
}
console.log(`Saved ${catalog.cards.length} cards, ${catalog.passives.length} passives, ${catalog.effects.length} effects, ${catalog.abnormalityPages.length} floor abnormality pages, and ${catalog.stages.length} stage rosters into combat folders.`);