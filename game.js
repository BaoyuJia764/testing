const canvas = document.querySelector('#battle-canvas');
const context = canvas.getContext('2d');
const cards = [...document.querySelectorAll('.action-card')];
const resolveButton = document.querySelector('#resolve-turn');
const selectionStatus = document.querySelector('#selection-status');
const roundNumber = document.querySelector('#round-number');
const storyToggle = document.querySelector('#story-toggle');
const storyPanel = document.querySelector('#story-panel');
const storyClose = document.querySelector('#story-close');
const storyTitle = document.querySelector('#story-title');
const storyLines = document.querySelector('#story-lines');
const storyPortrait = document.querySelector('#story-portrait');
const storySource = document.querySelector('#story-source');
const storyPrevious = document.querySelector('#story-previous');
const storyNext = document.querySelector('#story-next');
const storyProgress = document.querySelector('#story-progress');
const assetDialog = document.querySelector('#asset-dialog');
const assetOpen = document.querySelector('#asset-open');
const assetClose = document.querySelector('#asset-close');
const assetCategory = document.querySelector('#asset-category');
const assetSlot = document.querySelector('#asset-slot');
const assetSearch = document.querySelector('#asset-search');
const assetStatus = document.querySelector('#asset-status');
const assetGrid = document.querySelector('#asset-grid');
const assistantCustomControls = document.querySelector('#assistant-custom-controls');
const assistantCustomTarget = document.querySelector('#assistant-custom-target');
const assistantHairColor = document.querySelector('#assistant-hair-color');
const assistantEyeColor = document.querySelector('#assistant-eye-color');
const assistantSkinColor = document.querySelector('#assistant-skin-color');
const vfxSettings = document.querySelector('#vfx-settings');
const vfxColumns = document.querySelector('#vfx-columns');
const vfxRows = document.querySelector('#vfx-rows');
const vfxFrameDuration = document.querySelector('#vfx-frame-duration');
const catalogDialog = document.querySelector('#catalog-dialog');
const catalogOpen = document.querySelector('#catalog-open');
const catalogClose = document.querySelector('#catalog-close');
const catalogKind = document.querySelector('#catalog-kind');
const catalogSearch = document.querySelector('#catalog-search');
const catalogStatus = document.querySelector('#catalog-status');
const catalogList = document.querySelector('#catalog-list');
const catalogPrevious = document.querySelector('#catalog-previous');
const catalogNext = document.querySelector('#catalog-next');
const catalogPageLabel = document.querySelector('#catalog-page-label');
const teamEmotionLevel = document.querySelector('#team-emotion-level');
const memberEmotionProgress = document.querySelector('#member-emotion-progress');
const emotionCaption = document.querySelector('#emotion-caption');
const pageChoiceDialog = document.querySelector('#page-choice-dialog');
const pageChoiceClose = document.querySelector('#page-choice-close');
const pageChoiceMeta = document.querySelector('#page-choice-meta');
const pageAssignee = document.querySelector('#page-assignee');
const pageChoiceOptions = document.querySelector('#page-choice-options');
const stageSelect = document.querySelector('#stage-select');
const enemyCaption = document.querySelector('#enemy-caption');
const combat = window.CombatRegistry;
const stageCatalog = window.STAGE_CATALOG || [];

function createStageEnemy(stage) {
  const firstWave = stage?.waves?.[0];
  const firstUnitId = firstWave?.unitIds?.[0];
  const unit = stage?.units?.find((entry) => entry.id === firstUnitId);
  if (!unit) return combat.createEnemy(window.COMBAT_ENEMIES['guest-example']);
  return combat.createEnemy({
    id: `${stage.id}:${unit.id}`,
    name: unit.name,
    maxHp: unit.hp || 30,
    keyPageIds: unit.keypageId ? [unit.keypageId] : [],
    passiveIds: unit.passiveIds,
    cardIds: unit.cardIds,
  });
}

let selectedStage = stageCatalog.find((stage) => stage.id === '100001') || stageCatalog[0] || null;
let activeEnemy = createStageEnemy(selectedStage);
const progression = window.AbnormalityProgression;
const playerFloor = progression.createFloor({
  id: 'Malkuth',
  realizationLevel: 5,
  librarians: [
    { id: 'mira', name: 'Mira Vale' },
    { id: 'orin', name: 'Orin Reed' },
    { id: 'sable', name: 'Sable Yoon' },
  ],
  pageCatalog: window.ABNORMALITY_PAGE_CATALOG || [],
});
for (const librarian of playerFloor.librarians) {
  Object.assign(librarian, { side: 'player', role: 'assistant', hp: 50, maxHp: 50, effects: new Map(), passiveIds: [], keyPageIds: [] });
  window.AssistantCustomization.attach(librarian);
}

const wikiApi = 'https://libraryofruina.wiki.gg/api.php';
const assetCategories = {
  story: 'Story backgrounds',
  battle: 'Battle backgrounds',
  abnormalityBackgrounds: 'Abnormality background images',
  ui: 'UI images',
  dialogue: 'Dialogue profile sprites',
  dialogueGallery: 'Dialogue profile sprites',
  librarian: 'Librarian combat sprites',
  enemy: 'Enemy sprites',
  abnormality: 'Abnormality Sprites',
  combat: 'Combat sprites',
};
const categoryCache = new Map();
const imageInfoCache = new Map();

const state = {
  selectedCard: null,
  round: 1,
  actingLibrarianIndex: 0,
  stageId: selectedStage?.id || '',
  startTime: performance.now(),
  assets: { scene: null, player: null, enemy: null, crew: null },
  assetItems: [],
  catalogPage: 0,
  storyScene: null,
  storyLineIndex: 0,
  displayLibrarianIndex: 0,
};

function populateAssistantTargets() {
  assistantCustomTarget.replaceChildren(...playerFloor.librarians.map((librarian) => {
    const option = document.createElement('option');
    option.value = librarian.id;
    option.textContent = librarian.name;
    return option;
  }));
  updateAssistantColorControls();
}

function updateAssistantColorControls() {
  const librarian = playerFloor.librarians.find((member) => member.id === assistantCustomTarget.value);
  if (!librarian?.appearance) return;
  assistantHairColor.value = librarian.appearance.colors.hair;
  assistantEyeColor.value = librarian.appearance.colors.eyes;
  assistantSkinColor.value = librarian.appearance.colors.skin;
}

function populateStageSelector() {
  const fragment = document.createDocumentFragment();
  for (const stage of stageCatalog) {
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = `${stage.name} · ${stage.id}`;
    fragment.append(option);
  }
  stageSelect.replaceChildren(fragment);
  if (selectedStage) {
    stageSelect.value = selectedStage.id;
    enemyCaption.textContent = selectedStage.name.toUpperCase();
  }
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function drawPlaceholder(x, y, width, height, fill, label, sublabel, time) {
  const bob = Math.sin(time / 600 + x) * 3;
  const top = y + bob;

  context.fillStyle = '#10191b55';
  context.fillRect(x - 12, y + height + 7, width + 24, 9);
  context.fillStyle = fill;
  context.fillRect(x, top, width, height);
  context.fillStyle = '#f0efdc';
  context.font = '600 11px Manrope, sans-serif';
  context.textAlign = 'center';
  context.fillText(label, x + width / 2, top - 12);
  context.fillStyle = '#c6d1c3';
  context.font = '9px "DM Mono", monospace';
  context.fillText(sublabel, x + width / 2, top + height + 24);
}

function drawImageCover(image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCombatant(slot, x, y, width, height, fill, label, sublabel, time) {
  const appearance = slot === 'player' ? playerFloor.librarians[state.displayLibrarianIndex]?.appearance : null;
  const image = appearance?.parts[appearance.expression] || appearance?.parts.body || state.assets[slot];
  if (!image || !image.complete || !image.naturalWidth) {
    drawPlaceholder(x, y, width, height, fill, label, sublabel, time);
    return;
  }

  const maxWidth = Math.min(132, canvas.clientWidth * 0.19);
  const maxHeight = canvas.clientHeight * 0.54;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + height - drawHeight;
  context.fillStyle = '#10191b55';
  context.fillRect(drawX - 12, y + height + 7, drawWidth + 24, 9);
  const drawLayer = (part, colorPart) => {
    const layer = appearance?.parts[part];
    if (!layer?.complete || !layer.naturalWidth) return;
    context.drawImage(window.AssistantCustomization.tintedImage(layer, appearance.colors[colorPart]), drawX, drawY, drawWidth, drawHeight);
  };
  drawLayer('hairRear', 'hair');
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  drawLayer('skin', 'skin');
  drawLayer('eyes', 'eyes');
  drawLayer('eyebrows', 'hair');
  drawLayer('mouth', null);
  drawLayer('hairFront', 'hair');
  context.fillStyle = '#f0efdc';
  context.font = '600 11px Manrope, sans-serif';
  context.textAlign = 'center';
  context.fillText(label, x + width / 2, y - 12 + Math.sin(time / 600 + x) * 3);
  context.fillStyle = '#c6d1c3';
  context.font = '9px "DM Mono", monospace';
  context.fillText(sublabel, x + width / 2, y + height + 24);
}

function drawScene(time) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#314345');
  sky.addColorStop(0.62, '#41534d');
  sky.addColorStop(0.63, '#25383a');
  sky.addColorStop(1, '#1a292b');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const background = state.assets.scene;
  if (background?.complete && background.naturalWidth) {
    context.save();
    context.globalAlpha = 0.78;
    drawImageCover(background, width, height);
    context.restore();
    context.fillStyle = '#18242655';
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = '#e2d28a18';
  context.fillRect(width * 0.68, 0, 2, height * 0.61);
  context.fillRect(width * 0.8, 0, 2, height * 0.61);
  context.fillRect(width * 0.63, height * 0.29, width * 0.25, 2);

  context.fillStyle = '#d8e4cb12';
  for (let index = 0; index < 11; index += 1) {
    const x = ((index * 83 + time / 45) % (width + 20)) - 10;
    const y = height * 0.7 + Math.sin(index * 2 + time / 900) * 16;
    context.fillRect(x, y, 24, 1);
  }

  context.fillStyle = '#d5ef8620';
  context.fillRect(0, height * 0.62, width, 2);
  drawCombatant('player', width * 0.22, height * 0.35, 43, 82, '#e38b70', 'MIRA VALE', 'PLAYER', time);
  drawCombatant('enemy', width * 0.69, height * 0.31, 52, 96, '#8da69d', activeEnemy.name.toUpperCase(), 'OPPONENT', time + 90);
  window.CombatVfx.render(context, performance.now(), width, height);
}

function frame(time) {
  drawScene(time - state.startTime);
  requestAnimationFrame(frame);
}

function setStoryVisibility(visible) {
  storyPanel.hidden = !visible;
  storyToggle.setAttribute('aria-expanded', String(visible));
}

function showStoryScene(stageId, trigger, flags = {}) {
  const scene = window.StoryScenes.find(stageId, trigger, flags);
  if (!scene) return false;
  state.storyScene = scene;
  state.storyLineIndex = 0;
  storyTitle.textContent = scene.title;
  renderStoryLine();
  storySource.hidden = !scene.sourceUrl;
  if (scene.sourceUrl) storySource.href = scene.sourceUrl;
  if (scene.backgroundUrl) {
    const image = new Image();
    image.onload = () => { state.assets.scene = image; };
    image.src = scene.backgroundUrl;
  }
  setStoryVisibility(true);
  return true;
}

function renderStoryLine() {
  const lines = state.storyScene?.dialogue || [];
  const line = lines[state.storyLineIndex];
  if (!line) {
    storyLines.replaceChildren();
    storyProgress.textContent = '0 / 0';
    storyPrevious.disabled = true;
    storyNext.disabled = true;
    return;
  }
  const paragraph = document.createElement('p');
  paragraph.className = 'story-line';
  const speaker = document.createElement('strong');
  speaker.textContent = line.speaker;
  const text = document.createTextNode(line.text);
  paragraph.append(speaker, text);
  storyLines.replaceChildren(paragraph);
  const speakerId = line.speakerId || state.storyScene.speakerIds?.[line.speaker];
  const portrait = window.DialoguePortraits.resolve(speakerId, line.expression || 'default');
  storyPortrait.hidden = !portrait;
  if (portrait) {
    storyPortrait.src = portrait.url;
    storyPortrait.alt = `${line.speaker} portrait`;
  } else {
    storyPortrait.removeAttribute('src');
    storyPortrait.alt = '';
  }
  storyProgress.textContent = `${state.storyLineIndex + 1} / ${lines.length}`;
  storyPrevious.disabled = state.storyLineIndex === 0;
  storyNext.disabled = false;
  storyNext.textContent = state.storyLineIndex === lines.length - 1 ? 'CLOSE' : 'NEXT';
}

function changeStoryLine(direction) {
  const lines = state.storyScene?.dialogue || [];
  const nextIndex = state.storyLineIndex + direction;
  if (nextIndex < 0 || nextIndex >= lines.length) return;
  state.storyLineIndex = nextIndex;
  renderStoryLine();
}

function updateEmotionDisplay() {
  const activeLibrarian = playerFloor.librarians[state.actingLibrarianIndex];
  const threshold = progression.coinsRequiredByLevel[activeLibrarian.emotionLevel] || 0;
  teamEmotionLevel.textContent = String(playerFloor.teamEmotionLevel);
  memberEmotionProgress.style.width = threshold ? `${(activeLibrarian.emotionCoins / threshold) * 100}%` : '100%';
  emotionCaption.textContent = threshold
    ? `${activeLibrarian.name} · ${activeLibrarian.emotionCoins} / ${threshold} coins`
    : `${activeLibrarian.name} · emotion cap reached`;
  document.querySelectorAll('.crew-member[data-member]').forEach((row) => {
    row.classList.toggle('is-active', row.dataset.member === activeLibrarian.id);
  });
}

function showPageOffer() {
  const offer = playerFloor.pendingPageOffers[0];
  if (!offer) return;
  pageChoiceMeta.textContent = `Team emotion ${offer.teamEmotionLevel} · Tier ${offer.tier} · ${offer.options.length} available`;
  pageAssignee.replaceChildren(...playerFloor.librarians.map((librarian) => {
    const option = document.createElement('option');
    option.value = librarian.id;
    option.textContent = librarian.name;
    return option;
  }));
  pageChoiceOptions.replaceChildren(...offer.options.map((page) => {
    const button = document.createElement('button');
    button.className = 'page-choice-option';
    button.type = 'button';
    const title = document.createElement('strong');
    title.textContent = page.name;
    const detail = document.createElement('span');
    detail.textContent = `${page.abnormalityName} · ${page.emotionState} · ${page.spriteId || 'NO SPRITE ID'}\n${page.description || 'Rule description unavailable'}\nScript: ${page.scriptId || 'none'} · ${page.scriptReferenceStatus || 'not checked'}`;
    button.append(title, detail);
    button.addEventListener('click', () => {
      const librarian = playerFloor.librarians.find((member) => member.id === pageAssignee.value);
      if (!librarian || !progression.chooseAbnormalityPage(playerFloor, librarian.id, page.id)) return;
      const equippedPage = librarian.abnormalityPages.at(-1);
      combat.equipAbnormalityPage(librarian, equippedPage, { allies: playerFloor.librarians });
      pageChoiceDialog.close();
      updateEmotionDisplay();
      if (playerFloor.pendingPageOffers.length) showPageOffer();
    });
    return button;
  }));
  if (!pageChoiceDialog.open) pageChoiceDialog.showModal();
}

function catalogEntries() {
  const kind = catalogKind.value;
  if (kind === 'abnormalityPages') return window.ABNORMALITY_PAGE_CATALOG || [];
  return window.TIPHERETH_CATALOG?.[kind] || [];
}

function describeCatalogEntry(entry, kind) {
  if (kind === 'cards') {
    const dice = (entry.dice || []).map((die) => `${die.kind} ${die.damageType} ${die.min}-${die.max}`).join(' · ') || 'No dice metadata';
    const scriptIds = [entry.cardScriptId, ...(entry.behaviourScriptIds || [])].filter(Boolean);
    return `${dice}${scriptIds.length ? ` · Script IDs: ${scriptIds.join(', ')}` : ''}`;
  }
  if (kind === 'passives') return `${entry.usage || 'Unclassified'} · Cost ${entry.cost} · ${entry.description || 'No description'}${entry.scriptClass ? ` · Script: ${entry.scriptClass}` : ''}`;
  if (kind === 'effects') return `${entry.description || 'No description'}${entry.scriptClass ? ` · Script: ${entry.scriptClass}` : ''}`;
  return `${entry.floorId} · ${entry.abnormalityName} · Tier ${entry.tier} · ${entry.emotionState} · Sprite ${entry.spriteId || 'none'} · Script ${entry.scriptId || 'none'} · ${entry.description || 'No description'}`;
}

function renderCombatCatalog() {
  const kind = catalogKind.value;
  const search = catalogSearch.value.trim().toLowerCase();
  const matches = catalogEntries().filter((entry) =>
    `${entry.name} ${entry.id} ${entry.floorId || ''} ${entry.abnormalityName || ''} ${entry.availability || ''} ${entry.usage || ''} ${entry.scriptClass || ''} ${entry.cardScriptId || ''} ${(entry.behaviourScriptIds || []).join(' ')} ${entry.scriptReferenceStatus || ''}`.toLowerCase().includes(search));
  const pageSize = 40;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  state.catalogPage = Math.min(state.catalogPage, pageCount - 1);
  const firstIndex = state.catalogPage * pageSize;
  const fragment = document.createDocumentFragment();
  for (const entry of matches.slice(firstIndex, firstIndex + pageSize)) {
    const row = document.createElement('article');
    row.className = 'catalog-entry';
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = entry.name || `Entry ${entry.id}`;
    const meta = document.createElement('div');
    meta.className = 'catalog-entry-meta';
    meta.textContent = `ID ${entry.id}${entry.rarity ? ` · ${entry.rarity}` : ''}${entry.availability ? ` · ${entry.availability}` : ''}${entry.scriptReferenceStatus ? ` · ${entry.scriptReferenceStatus === 'linked' ? 'SCRIPT LINKED' : 'SCRIPT NOT FOUND'}` : ''}`;
    text.append(name, meta);
    const links = document.createElement('div');
    links.className = 'catalog-entry-links';
    for (const [label, url] of [['ENTRY ↗', entry.source], ['SCRIPT ↗', entry.scriptSource]]) {
      if (!url) continue;
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = label;
      links.append(link);
    }
    const detail = document.createElement('div');
    detail.className = 'catalog-entry-detail';
    detail.textContent = describeCatalogEntry(entry, kind);
    row.append(text, links, detail);
    fragment.append(row);
  }
  catalogList.replaceChildren(fragment);
  catalogStatus.textContent = `${matches.length.toLocaleString()} entries · showing ${matches.length ? firstIndex + 1 : 0}-${Math.min(firstIndex + pageSize, matches.length)}`;
  catalogPageLabel.textContent = `${state.catalogPage + 1} / ${pageCount}`;
  catalogPrevious.disabled = state.catalogPage === 0;
  catalogNext.disabled = state.catalogPage >= pageCount - 1;
}

async function fetchCategoryTitles(categoryName, depth = 0, visited = new Set()) {
  const categoryTitle = `Category:${categoryName}`;
  if (visited.has(categoryTitle)) return [];
  visited.add(categoryTitle);
  const query = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: categoryTitle,
    cmtype: depth === 0 ? 'file|subcat' : 'file',
    cmlimit: '500',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${wikiApi}?${query}`);
  if (!response.ok) throw new Error(`Wiki API returned ${response.status}`);
  const data = await response.json();
  const files = [];
  const subcategories = [];
  for (const member of data.query?.categorymembers || []) {
    if (member.ns === 6) files.push(member.title);
    if (member.ns === 14 && depth < 2) subcategories.push(member.title.replace(/^Category:/, ''));
  }
  for (const subcategory of subcategories) {
    files.push(...await fetchCategoryTitles(subcategory, depth + 1, visited));
  }
  return [...new Set(files)];
}

async function fetchImageInfo(titles) {
  const images = [];
  for (let index = 0; index < titles.length; index += 50) {
    const query = new URLSearchParams({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '280',
      titles: titles.slice(index, index + 50).join('|'),
      format: 'json',
      origin: '*',
    });
    const response = await fetch(`${wikiApi}?${query}`);
    if (!response.ok) throw new Error(`Wiki API returned ${response.status}`);
    const data = await response.json();
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (info?.url) images.push({ title: page.title.replace(/^File:/, ''), url: info.url, thumbnail: info.thumburl || info.url });
    }
  }
  return images.sort((left, right) => left.title.localeCompare(right.title));
}

async function getCategoryItems(categoryKey) {
  const localItems = window.LOCAL_ASSET_GROUPS?.[categoryKey];
  if (localItems?.length) return localItems;
  if (!categoryCache.has(categoryKey)) {
    const promise = fetchCategoryTitles(assetCategories[categoryKey]).then(fetchImageInfo);
    categoryCache.set(categoryKey, promise);
    promise.catch(() => categoryCache.delete(categoryKey));
  }
  return categoryCache.get(categoryKey);
}

function renderAssetItems() {
  const search = assetSearch.value.trim().toLowerCase();
  const matchingItems = state.assetItems.filter((item) => item.title.toLowerCase().includes(search));
  const fragment = document.createDocumentFragment();
  for (const item of matchingItems) {
    const button = document.createElement('button');
    button.className = 'asset-tile';
    button.type = 'button';
    button.title = `Apply ${item.title} to ${assetSlot.selectedOptions[0].text.toLowerCase()}`;
    const image = document.createElement('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    const title = document.createElement('span');
    title.textContent = item.title;
    button.append(image, title);
    button.addEventListener('click', () => applyAsset(item));
    fragment.append(button);
  }
  assetGrid.replaceChildren(fragment);
  assetStatus.textContent = `${matchingItems.length} of ${state.assetItems.length} images shown. Selecting one applies it as ${assetSlot.selectedOptions[0].text.toLowerCase()}.`;
}

function applyAsset(item) {
  const slot = assetSlot.value;
  const image = new Image();
  image.onload = () => {
    if (slot.startsWith('assistant-')) {
      const librarian = playerFloor.librarians.find((member) => member.id === assistantCustomTarget.value);
      const part = slot.slice('assistant-'.length);
      if (librarian && window.AssistantCustomization.setPart(librarian, part, image, item.url)) {
        assetStatus.textContent = `${item.title} assigned to ${librarian.name} (${part}).`;
      }
      return;
    }
    state.assets[slot] = image;
    if (slot === 'vfx') {
      window.CombatVfx.setSprite(image, {
        columns: Number(vfxColumns.value),
        rows: Number(vfxRows.value),
        frameDuration: Number(vfxFrameDuration.value),
      });
    }
    if (slot === 'crew') {
      const portrait = document.querySelector('.portrait');
      const portraitImage = document.createElement('img');
      portraitImage.src = item.url;
      portraitImage.alt = 'Selected crew portrait';
      portrait.replaceChildren(portraitImage);
    }
  };
  image.onerror = () => {
    assetStatus.textContent = `Could not load ${item.title}. Try another image.`;
  };
  image.src = item.url;
  assetStatus.textContent = `Loading ${item.title} into ${assetSlot.selectedOptions[0].text.toLowerCase()}...`;
}

async function loadSelectedCategory() {
  const categoryKey = assetCategory.value;
  state.assetItems = [];
  assetGrid.replaceChildren();
  assetSearch.value = '';
  if (!categoryKey) {
    assetStatus.textContent = 'Choose a collection to browse its images.';
    return;
  }
  assetStatus.textContent = 'Loading collection from the wiki...';
  try {
    state.assetItems = await getCategoryItems(categoryKey);
    renderAssetItems();
  } catch (error) {
    assetStatus.textContent = 'The collection could not be loaded. Check your connection and try again.';
  }
}

cards.forEach((card) => {
  card.addEventListener('click', () => {
    const wasSelected = card.getAttribute('aria-pressed') === 'true';
    cards.forEach((otherCard) => otherCard.setAttribute('aria-pressed', 'false'));
    state.selectedCard = wasSelected ? null : card.dataset.card;
    state.displayLibrarianIndex = state.actingLibrarianIndex;
    if (!wasSelected) card.setAttribute('aria-pressed', 'true');
    selectionStatus.textContent = state.selectedCard ? `${state.selectedCard} selected` : 'No maneuver selected';
    resolveButton.disabled = !state.selectedCard;
  });
});

resolveButton.addEventListener('click', () => {
  if (!state.selectedCard) return;
  const activeLibrarian = playerFloor.librarians[state.actingLibrarianIndex];
  state.displayLibrarianIndex = state.actingLibrarianIndex;
  combat.startUnitScene(activeLibrarian, { allies: playerFloor.librarians, allEnemies: [activeEnemy] });
  combat.startUnitScene(activeEnemy);
  const enemyDice = combat.resolveCard(activeEnemy.cardIds[0], activeEnemy, activeLibrarian);
  const enemyDamage = enemyDice
    .filter((die) => die.kind === 'attack')
    .reduce((total, die) => total + die.result, 0);
  const triggeredPassives = [...new Set(enemyDice.flatMap((die) => die.triggeredPassiveIds))];
  combat.endUnitScene(activeLibrarian);
  combat.endUnitScene(activeEnemy);
  progression.awardEmotionCoins(playerFloor, activeLibrarian.id, { positive: 1 });
  const progressionResult = progression.endScene(playerFloor);
  state.round += 1;
  roundNumber.textContent = String(state.round).padStart(2, '0');
  const passiveNote = triggeredPassives.length ? `; passive ${triggeredPassives.join(', ')} triggered` : '';
  const emotionNote = progressionResult.levelUps.length ? `; ${activeLibrarian.name} reached emotion ${activeLibrarian.emotionLevel}` : '';
  selectionStatus.textContent = `${state.selectedCard} resolved; enemy dealt ${enemyDamage}${passiveNote}${emotionNote}`;
  state.selectedCard = null;
  cards.forEach((card) => card.setAttribute('aria-pressed', 'false'));
  resolveButton.disabled = true;
  state.actingLibrarianIndex = (state.actingLibrarianIndex + 1) % playerFloor.librarians.length;
  updateEmotionDisplay();
  if (progressionResult.pageOffers.length) showPageOffer();
});

stageSelect.addEventListener('change', () => {
  const nextStage = stageCatalog.find((stage) => stage.id === stageSelect.value);
  if (!nextStage) return;
  try {
    activeEnemy = createStageEnemy(nextStage);
    selectedStage = nextStage;
    state.stageId = nextStage.id;
    enemyCaption.textContent = nextStage.name.toUpperCase();
    selectionStatus.textContent = `${nextStage.name} · ${nextStage.waves.length} wave${nextStage.waves.length === 1 ? '' : 's'} loaded`;
  } catch (error) {
    selectionStatus.textContent = `Could not load ${nextStage.name}: ${error.message}`;
  }
});

storyToggle.addEventListener('click', () => {
  if (storyPanel.hidden) showStoryScene('atrium', 'beforeEncounter');
  else setStoryVisibility(false);
});
window.addEventListener('story:trigger', (event) => {
  const { stageId, trigger, flags = {} } = event.detail || {};
  if (stageId && trigger) showStoryScene(stageId, trigger, flags);
});
storyClose.addEventListener('click', () => setStoryVisibility(false));
storyPrevious.addEventListener('click', () => changeStoryLine(-1));
storyNext.addEventListener('click', () => {
  const lines = state.storyScene?.dialogue || [];
  if (state.storyLineIndex === lines.length - 1) setStoryVisibility(false);
  else changeStoryLine(1);
});
assetOpen.addEventListener('click', () => assetDialog.showModal());
assetClose.addEventListener('click', () => assetDialog.close());
catalogOpen.addEventListener('click', () => {
  renderCombatCatalog();
  catalogDialog.showModal();
});
catalogClose.addEventListener('click', () => catalogDialog.close());
catalogKind.addEventListener('change', () => {
  state.catalogPage = 0;
  renderCombatCatalog();
});
catalogSearch.addEventListener('input', () => {
  state.catalogPage = 0;
  renderCombatCatalog();
});
catalogPrevious.addEventListener('click', () => {
  state.catalogPage -= 1;
  renderCombatCatalog();
});
catalogNext.addEventListener('click', () => {
  state.catalogPage += 1;
  renderCombatCatalog();
});
pageChoiceClose.addEventListener('click', () => pageChoiceDialog.close());
assetCategory.addEventListener('change', loadSelectedCategory);
assetSlot.addEventListener('change', () => {
  vfxSettings.hidden = assetSlot.value !== 'vfx';
  assistantCustomControls.hidden = !assetSlot.value.startsWith('assistant-');
  if (!assistantCustomControls.hidden) updateAssistantColorControls();
});
assistantCustomTarget.addEventListener('change', updateAssistantColorControls);
assistantHairColor.addEventListener('input', () => {
  const librarian = playerFloor.librarians.find((member) => member.id === assistantCustomTarget.value);
  if (librarian) window.AssistantCustomization.setColor(librarian, 'hair', assistantHairColor.value);
});
assistantEyeColor.addEventListener('input', () => {
  const librarian = playerFloor.librarians.find((member) => member.id === assistantCustomTarget.value);
  if (librarian) window.AssistantCustomization.setColor(librarian, 'eyes', assistantEyeColor.value);
});
assistantSkinColor.addEventListener('input', () => {
  const librarian = playerFloor.librarians.find((member) => member.id === assistantCustomTarget.value);
  if (librarian) window.AssistantCustomization.setColor(librarian, 'skin', assistantSkinColor.value);
});
assetSearch.addEventListener('input', renderAssetItems);
assetSlot.addEventListener('change', () => {
  if (assetCategory.value) renderAssetItems();
});
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
populateStageSelector();
populateAssistantTargets();
updateEmotionDisplay();
requestAnimationFrame(frame);