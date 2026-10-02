import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as cheerio from 'cheerio';

const wikiApi = 'https://libraryofruina.wiki.gg/api.php';
const workspace = fileURLToPath(new URL('../', import.meta.url));
const assetRoot = path.join(workspace, 'assets', 'lor');
const manifestPath = path.join(assetRoot, 'manifest.js');
const dryRun = process.argv.includes('--dry-run');
const galleryOnly = process.argv.includes('--dialogue-gallery-only');
const groups = [
  { key: 'librarian', category: 'Librarian combat sprites', folder: 'librarian-combat', recursive: false },
  { key: 'enemy', category: 'Enemy sprites', folder: 'enemy-combat', recursive: false },
  { key: 'combat', category: 'Combat sprites', folder: 'combat-sprites', recursive: true },
  { key: 'dialogue', category: 'Dialogue profile sprites', folder: 'dialogue-profiles', recursive: false },
  { key: 'abnormality', category: 'Abnormality Sprites', folder: 'abnormality-sprites', recursive: false },
  { key: 'story', category: 'Story backgrounds', folder: 'story-backgrounds', recursive: false },
  { key: 'battle', category: 'Battle backgrounds', folder: 'battle-backgrounds', recursive: false },
  { key: 'abnormalityBackgrounds', category: 'Abnormality background images', folder: 'abnormality-backgrounds', recursive: false },
  { key: 'ui', category: 'UI images', folder: 'ui', recursive: false },
];

function normalizeTitle(title) {
  return title.replace(/^File:/i, '').replaceAll('_', ' ').trim().toLowerCase();
}

function safeFilename(title) {
  return title.replace(/^File:/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.\.+/g, '.').trim();
}

async function getJson(parameters) {
  const query = new URLSearchParams({ ...parameters, format: 'json' });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${wikiApi}?${query}`, {
      headers: { 'User-Agent': 'LocalGameAssetIndexer/1.0' },
    });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Wiki API returned ${response.status}`);
    }
    if (attempt === 5) throw new Error(`Wiki API kept rate-limiting requests (${response.status})`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const backoff = retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
  throw new Error('Wiki API request failed');
}

async function readExistingGroups() {
  try {
    const source = await readFile(manifestPath, 'utf8');
    const existingContext = { window: {} };
    vm.runInNewContext(source, existingContext, { filename: manifestPath });
    return existingContext.window.LOCAL_ASSET_GROUPS || {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function profilePageName(title) {
  let name = title.replace(/\.png$/i, '').replace(/\s+Dia$/i, '').trim();
  if (/^Roland\s+\d+$/i.test(name)) return 'Roland';
  return name.replace(/\s+D$/i, '').replace(/\s+\d+$/, '').trim();
}

async function discoverGalleryPages(profiles) {
  const candidates = [...new Set(profiles.map((profile) => profilePageName(profile.title)).filter(Boolean))];
  const pages = new Map();
  for (let index = 0; index < candidates.length; index += 40) {
    const batch = candidates.slice(index, index + 40);
    const data = await getJson({
      action: 'query',
      prop: 'info',
      redirects: '1',
      titles: batch.join('|'),
    });
    for (const page of Object.values(data.query?.pages || {})) {
      if (page.missing) continue;
      const speakerId = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (speakerId) pages.set(speakerId, { speakerId, page: page.title });
    }
  }
  return [...pages.values()];
}

async function fetchCategoryFiles(categoryName, recursive) {
  const queue = [{ name: categoryName, depth: 0 }];
  const visited = new Set();
  const files = new Map();
  while (queue.length) {
    const { name, depth } = queue.shift();
    const category = `Category:${name}`;
    if (visited.has(category)) continue;
    visited.add(category);
    let continuation = {};
    do {
      const data = await getJson({
        action: 'query',
        list: 'categorymembers',
        cmtitle: category,
        cmtype: recursive && depth < 3 ? 'file|subcat' : 'file',
        cmlimit: '500',
        ...continuation,
      });
      for (const member of data.query?.categorymembers || []) {
        if (member.ns === 6) files.set(normalizeTitle(member.title), member.title);
        if (recursive && depth < 3 && member.ns === 14) {
          queue.push({ name: member.title.replace(/^Category:/, ''), depth: depth + 1 });
        }
      }
      continuation = data.continue || null;
    } while (continuation);
  }
  return [...files.values()];
}

async function fetchImageInfo(titles) {
  const result = new Map();
  for (let index = 0; index < titles.length; index += 50) {
    const data = await getJson({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|size',
      titles: titles.slice(index, index + 50).join('|'),
    });
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      result.set(normalizeTitle(page.title), { title: page.title, pageid: page.pageid, url: info.url, size: info.size || 0 });
    }
  }
  return result;
}

async function fetchDialogueGalleryFiles({ speakerId, page }) {
  const url = `https://libraryofruina.wiki.gg/wiki/${encodeURIComponent(page.replaceAll(' ', '_'))}`;
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch(url, { headers: { 'User-Agent': 'LocalGameAssetIndexer/1.0' } });
    if (response.ok || (response.status !== 429 && response.status < 500)) break;
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
  }
  if (!response?.ok) return [];
  const $ = cheerio.load(await response.text());
  const galleryHeading = $('#Gallery').closest('h2');
  if (!galleryHeading.length) return [];
  const section = galleryHeading.nextUntil('h2');
  const files = [];
  section.find('img').each((_, element) => {
    const image = $(element);
    const href = image.closest('a').attr('href') || '';
    const match = href.match(/\/wiki\/File:(.+)$/);
    if (!match) return;
    const title = decodeURIComponent(match[1]).replaceAll('_', ' ');
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dialoguePrefix = normalizedTitle.startsWith(speakerId) || normalizedTitle.startsWith(`tbs${speakerId}`);
    const hasExpressionAsset = /dialogue|nervous|surprise|fullbody/i.test(title);
    const knownRolandPose = speakerId === 'roland' && /^Roland(FullBody|Nervous|Surprise)\.png$/i.test(title);
    if ((!dialoguePrefix || !hasExpressionAsset) && !knownRolandPose) return;
    const alt = image.attr('alt') || '';
    const expression = alt === title
      ? title.replace(/\.png$/i, '').replace(/^TBS/i, '').replace(new RegExp(`^${page.replace(/[^a-z0-9]/gi, '')}`, 'i'), '')
      : alt;
    files.push({ title: `File:${title}`, speakerId, expression, source: new URL(href, 'https://libraryofruina.wiki.gg').href });
  });
  return [...new Map(files.map((file) => [normalizeTitle(file.title), file])).values()];
}

async function mapConcurrent(items, limit, callback) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await callback(items[index], index);
    }
  }));
}

const activeGroups = galleryOnly ? [] : groups;
const groupTitles = new Map();
const existingGroups = await readExistingGroups();
for (const group of activeGroups) {
  groupTitles.set(group.key, await fetchCategoryFiles(group.category, group.recursive));
  console.log(`${group.key}: ${groupTitles.get(group.key).length} files indexed`);
}

const dialogueGalleryFiles = [];
const galleryPages = await discoverGalleryPages(existingGroups.dialogue || []);
await mapConcurrent(galleryPages, 3, async (speaker) => {
  try {
    const files = await fetchDialogueGalleryFiles(speaker);
    dialogueGalleryFiles.push(...files);
  } catch (error) {
    console.warn(`Skipped ${speaker.page} gallery: ${error.message}`);
  }
});
console.log(`Found ${dialogueGalleryFiles.length} dialogue portraits across ${galleryPages.length} character galleries.`);
groupTitles.set('dialogueGallery', dialogueGalleryFiles.map((file) => file.title));
const dialogueGalleryByTitle = new Map(dialogueGalleryFiles.map((file) => [normalizeTitle(file.title), file]));

const uniqueTitles = new Map();
for (const group of activeGroups) {
  for (const title of groupTitles.get(group.key)) uniqueTitles.set(normalizeTitle(title), title);
}
for (const file of dialogueGalleryFiles) uniqueTitles.set(normalizeTitle(file.title), file.title);
const imageInfo = await fetchImageInfo([...uniqueTitles.values()]);
const destinations = new Map();
const manifestGroups = {};
const outputGroups = [...activeGroups, { key: 'dialogueGallery', folder: 'dialogue-gallery' }];
for (const group of outputGroups) {
  manifestGroups[group.key] = [];
  for (const title of groupTitles.get(group.key)) {
    const image = imageInfo.get(normalizeTitle(title));
    if (!image) continue;
    let relativePath = destinations.get(normalizeTitle(title));
    if (!relativePath) {
      relativePath = path.posix.join('assets/lor', group.folder, `${image.pageid}-${safeFilename(image.title)}`);
      destinations.set(normalizeTitle(title), relativePath);
    }
    const galleryFile = dialogueGalleryByTitle.get(normalizeTitle(title));
    manifestGroups[group.key].push({
      title: image.title.replace(/^File:/, ''),
      url: relativePath,
      ...(galleryFile ? { speakerId: galleryFile.speakerId, expression: galleryFile.expression, source: galleryFile.source } : {}),
    });
  }
}

const downloads = [...destinations.entries()].map(([title, relativePath]) => ({
  image: imageInfo.get(title),
  relativePath,
}));
const totalBytes = downloads.reduce((total, item) => total + item.image.size, 0);
if (!dryRun) {
  await mapConcurrent(downloads, 3, async ({ image, relativePath }, index) => {
    const destination = path.join(workspace, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await access(destination);
      return;
    } catch {}
    let response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await fetch(image.url, { headers: { 'User-Agent': 'LocalGameAssetIndexer/1.0' } });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) break;
      if (attempt === 5) break;
      const retryAfter = Number(response.headers.get('retry-after'));
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error(`Could not download ${image.title}: ${response?.status || 'network error'}`);
    await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
    if ((index + 1) % 100 === 0) console.log(`Downloaded ${index + 1} / ${downloads.length}`);
  });
  await mkdir(assetRoot, { recursive: true });
  const mergedGroups = { ...existingGroups, ...manifestGroups };
  for (const [key, generatedItems] of Object.entries(manifestGroups)) {
    const byUrl = new Map(generatedItems.map((item) => [item.url, item]));
    for (const item of existingGroups[key] || []) byUrl.set(item.url, item);
    mergedGroups[key] = [...byUrl.values()];
  }
  const manifest = `window.LOCAL_ASSET_GROUPS = ${JSON.stringify(mergedGroups, null, 2)};\n`;
  await writeFile(manifestPath, manifest, 'utf8');
}

console.log(`${dryRun ? 'Would download' : 'Downloaded'} ${downloads.length} unique images (~${(totalBytes / (1024 * 1024)).toFixed(1)} MB) into assets/lor/.`);