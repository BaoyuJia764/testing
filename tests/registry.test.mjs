import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = [
  '../combat/cards/catalog.js',
  '../combat/passives/catalog.js',
  '../combat/effects/catalog.js',
  '../combat/abnormality-pages/catalog.js',
  '../combat/stages/catalog.js',
  '../combat/assistant-customization.js',
  '../combat/registry.js',
  '../combat/effects/strength.js',
  '../combat/effects/burn.js',
  '../combat/effects/bleeding.js',
  '../combat/effects/endurance.js',
  '../combat/effects/weak.js',
  '../combat/effects/disarm.js',
  '../combat/effects/protection.js',
  '../combat/effects/vulnerable.js',
  '../combat/effects/paralysis.js',
  '../combat/passives/3.js',
  '../combat/cards/13.js',
  '../combat/abnormality-pages/malkuth-ashes.js',
  '../combat/abnormality-pages/script-burnningGirl2.js',
  '../combat/abnormality-pages/script-queenbee1.js',
  '../combat/abnormality-pages/script-fairy1.js',
  '../combat/abnormality-pages/script-fairy2.js',
];
const context = vm.createContext({ window: {}, Map, Math });
for (const file of files) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  vm.runInContext(source, context, { filename: file });
}
const registry = context.window.CombatRegistry;

test('catalog cards resolve generic dice without per-card scripts', () => {
  const owner = { id: 'player', side: 'player', effects: new Map(), passiveIds: [], keyPageIds: [] };
  const target = { id: 'enemy', hp: 20, effects: new Map(), passiveIds: [], keyPageIds: [] };
  const result = registry.resolveCard('2', owner, target, () => 0);
  assert.equal(result[0].result, 2);
  assert.equal(result[1].result, 1);
  assert.equal(target.hp, 17);
});

test('catalog sync preserves linked source class references when present', () => {
  const effects = context.window.TIPHERETH_CATALOG.effects;
  const strength = effects.find((effect) => effect.id === 'Strength');
  assert.equal(strength.scriptClass, 'BattleUnitBuf_strength');
  assert.match(strength.scriptSource, /\/src\/cs\/BattleUnitBuf_strength\/$/);
  const passive = context.window.TIPHERETH_CATALOG.passives.find((entry) => entry.id === '3');
  assert.equal(passive.scriptReferenceStatus, 'not-found');
});

test('catalog card availability is checked while authored scripts add passive hooks', () => {
  const enemy = registry.createEnemy({ id: 'test', maxHp: 20, passiveIds: ['3'], cardIds: ['13'], keyPageIds: [] });
  const target = { id: 'player', side: 'player', hp: 20, effects: new Map(), passiveIds: [], keyPageIds: [] };
  const result = registry.resolveCard('13', enemy, target, () => 0);
  assert.equal(result[0].result, 2);
  assert.equal(target.hp, 18);
  assert.throws(() => registry.resolveCard('13', { side: 'player' }, target), /restricted/);
});

test('synced reception wave instantiates its first enemy from catalog IDs', () => {
  const stage = context.window.STAGE_CATALOG.find((entry) => entry.id === '100001');
  const unitId = stage.waves[0].unitIds[0];
  const unit = stage.units.find((entry) => entry.id === unitId);
  const enemy = registry.createEnemy({
    id: `${stage.id}:${unit.id}`,
    name: unit.name,
    maxHp: unit.hp,
    keyPageIds: [unit.keypageId],
    passiveIds: unit.passiveIds,
    cardIds: unit.cardIds,
  });
  assert.equal(enemy.name, 'Backstreets Butcher');
  assert.equal(enemy.hp, unit.hp);
  assert.equal(enemy.cardIds.length, 8);
});

test('selected abnormality page reacts to damage, starts its next-scene hook, and applies Burn', () => {
  const page = context.window.ABNORMALITY_PAGE_CATALOG.find((entry) => entry.id === 'Malkuth:1');
  const defender = { id: 'defender', hp: 30, effects: new Map(), statuses: new Map(), abnormalityPages: [page] };
  const attacker = { id: 'attacker', side: 'player', hp: 30, effects: new Map(), statuses: new Map(), abnormalityPages: [], passiveIds: [], keyPageIds: [] };
  registry.resolveCard('2', attacker, defender, () => 0);
  assert.equal(attacker.statuses.get('Burn').stacks, 2);
  assert.equal(defender.effects.has('ashes-burn-next-scene'), true);
  registry.endUnitScene(attacker);
  assert.equal(attacker.hp, 28);
  registry.startUnitScene(defender);
  const nextTarget = { id: 'next', hp: 30, effects: new Map(), statuses: new Map(), abnormalityPages: [] };
  registry.resolveCard('2', defender, nextTarget, () => 0);
  assert.equal(nextTarget.statuses.get('Burn').stacks, 2);
});

test('Footfalls triggers its low-health retaliation, capped damage, Burn, and defeat', () => {
  const page = context.window.ABNORMALITY_PAGE_CATALOG.find((entry) => entry.id === 'Malkuth:2');
  const target = { id: 'target', hp: 200, maxHp: 200, statuses: new Map(), effects: new Map(), abnormalityPages: [] };
  const librarian = { id: 'low-health-librarian', hp: 20, maxHp: 100, effects: new Map(), statuses: new Map(), abnormalityPages: [page] };
  librarian.currentTarget = target;
  registry.startUnitScene(librarian, { currentTarget: target, random: () => 0 });
  assert.equal(target.hp, 164);
  assert.equal(target.statuses.get('Burn').stacks, 1);
  assert.equal(librarian.hp, 0);
  assert.equal(librarian.defeated, true);

  const cappedTarget = { id: 'capped', hp: 200, maxHp: 200, statuses: new Map(), effects: new Map(), abnormalityPages: [] };
  const cappedLibrarian = { id: 'capped-librarian', hp: 10, maxHp: 100, effects: new Map(), statuses: new Map(), abnormalityPages: [page], currentTarget: cappedTarget };
  registry.startUnitScene(cappedLibrarian, { random: () => 0 });
  assert.equal(cappedTarget.hp, 164);
});

test('imported abnormality script IDs dispatch behavior without page-ID registration', () => {
  const scriptDrivenUnit = {
    id: 'script-driven',
    hp: 10,
    maxHp: 100,
    effects: new Map(),
    statuses: new Map(),
    abnormalityPages: [{ id: 'other-page-id', scriptId: 'burnningGirl2' }],
  };
  const target = { id: 'script-target', hp: 100, maxHp: 100, effects: new Map(), statuses: new Map(), abnormalityPages: [] };
  registry.startUnitScene(scriptDrivenUnit, { currentTarget: target, random: () => 0 });
  assert.equal(scriptDrivenUnit.defeated, true);
  assert.equal(target.hp, 70);
  assert.equal(target.statuses.get('Burn').stacks, 1);
});

test('Queen Bee Spores schedules Burn and Bleed for the attacker at next scene start', () => {
  const page = context.window.ABNORMALITY_PAGE_CATALOG.find((entry) => entry.id === 'Malkuth:10');
  const defender = { id: 'spores-holder', hp: 30, effects: new Map(), statuses: new Map(), abnormalityPages: [page] };
  const attacker = { id: 'spores-attacker', side: 'player', hp: 30, effects: new Map(), statuses: new Map(), abnormalityPages: [], passiveIds: [], keyPageIds: [] };
  registry.resolveCard('2', attacker, defender, () => 0);
  assert.equal(attacker.statuses.size, 0);
  assert.equal(attacker.pendingStatuses.get('Burn'), 2);
  assert.equal(attacker.pendingStatuses.get('Bleeding'), 2);
  registry.startUnitScene(attacker);
  assert.equal(attacker.statuses.get('Burn').stacks, 2);
  assert.equal(attacker.statuses.get('Bleeding').stacks, 2);
  assert.equal(attacker.pendingStatuses.size, 0);
});

test('Fairies Care heals for three scenes and applies its three-hit penalty', () => {
  const page = context.window.ABNORMALITY_PAGE_CATALOG.find((entry) => entry.id === 'Malkuth:7');
  const librarian = { id: 'fairy-care-test', hp: 60, maxHp: 100, effects: new Map(), statuses: new Map(), abnormalityPages: [] };
  registry.equipAbnormalityPage(librarian, page);
  registry.endUnitScene(librarian);
  assert.equal(librarian.hp, 75);
  registry.notifyAbnormalityPage(librarian, 'onDamaged');
  registry.notifyAbnormalityPage(librarian, 'onDamaged');
  assert.equal(librarian.hp, 75);
  registry.notifyAbnormalityPage(librarian, 'onDamaged');
  assert.equal(librarian.hp, 56);
  assert.equal(librarian.effects.has('fairy-care'), false);
});

test('Gluttony gains power and heals when attacking a target already damaged this scene', () => {
  const page = context.window.ABNORMALITY_PAGE_CATALOG.find((entry) => entry.id === 'Malkuth:8');
  const attacker = { id: 'gluttony-user', hp: 20, maxHp: 50, effects: new Map(), statuses: new Map(), abnormalityPages: [page], passiveIds: [], keyPageIds: [] };
  const target = { id: 'pre-damaged', hp: 50, maxHp: 50, sceneDamageTaken: 1, effects: new Map(), statuses: new Map(), abnormalityPages: [] };
  const result = registry.resolveCard('2', attacker, target, () => 0);
  assert.equal(result[0].power, 1);
  assert.equal(attacker.hp, 24);
  assert.equal(target.hp, 45);
  registry.endUnitScene(target);
  assert.equal(target.sceneDamageTaken, 0);
});

test('assistant appearance layers and colors are separate from patron combat expressions', () => {
  const customization = context.window.AssistantCustomization;
  const assistant = { id: 'assistant-test', role: 'assistant', side: 'player', hp: 30, effects: new Map(), passiveIds: [], keyPageIds: [] };
  customization.attach(assistant);
  assert.equal(customization.setPart(assistant, 'hairFront', { complete: true, naturalWidth: 64 }, 'assets/hair.png'), true);
  assert.equal(customization.setColor(assistant, 'hair', '#cc2255'), true);
  const patron = { id: 'patron-test', role: 'patron', side: 'enemy', hp: 30, effects: new Map(), passiveIds: [], keyPageIds: [] };
  registry.resolveCard('2', assistant, patron, () => 0);
  assert.equal(assistant.appearance.expression, 'attack');
  registry.resolveCard('2', patron, assistant, () => 0);
  assert.equal(assistant.appearance.expression, 'hit');
  assert.equal(customization.attach(patron), null);
  assert.equal(customization.setExpression(patron, 'hit'), false);
});

test('common statuses modify dice, damage, and scene decay through shared hooks', () => {
  const attacker = { id: 'status-attacker', hp: 30, effects: new Map(), statuses: new Map(), passiveIds: [], keyPageIds: [] };
  const protectedTarget = { id: 'protected-target', hp: 20, effects: new Map(), statuses: new Map(), passiveIds: [], keyPageIds: [] };
  registry.applyStatus(attacker, 'Strength', 2);
  registry.applyStatus(protectedTarget, 'Protection', 2);
  registry.resolveCard('2', attacker, protectedTarget, () => 0);
  assert.equal(protectedTarget.hp, 17);

  registry.applyStatus(attacker, 'Bleeding', 3);
  const secondTarget = { id: 'second-target', hp: 50, effects: new Map(), statuses: new Map(), passiveIds: [], keyPageIds: [] };
  registry.resolveCard('2', attacker, secondTarget, () => 0);
  assert.equal(attacker.hp, 25);
  assert.equal(attacker.statuses.get('Bleeding').stacks, 1);

  const paralyzed = { id: 'paralyzed', hp: 30, effects: new Map(), statuses: new Map(), passiveIds: [], keyPageIds: [] };
  registry.applyStatus(paralyzed, 'Paralysis', 1);
  registry.startUnitScene(paralyzed);
  const thirdTarget = { id: 'third-target', hp: 30, effects: new Map(), statuses: new Map(), passiveIds: [], keyPageIds: [] };
  const dice = registry.resolveCard('2', paralyzed, thirdTarget, () => 0);
  assert.equal(dice[0].die.max, 2);
  assert.equal(dice[1].die.max, 4);
});