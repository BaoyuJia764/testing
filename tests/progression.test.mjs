import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const progressionSource = await readFile(new URL('../combat/progression.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(progressionSource, context);
const progression = context.window.AbnormalityProgression;

function createTestFloor({ realizationLevel = 5, librarians = [{ id: 'a', name: 'A' }], pages } = {}) {
  return progression.createFloor({
    id: 'Malkuth',
    realizationLevel,
    fullyRealized: true,
    librarians,
    pageCatalog: pages ?? [
      { id: 'm1', floorId: 'Malkuth', tier: 1, name: 'Tier One' },
      { id: 'm2', floorId: 'Malkuth', tier: 2, name: 'Tier Two' },
      { id: 'm3', floorId: 'Malkuth', tier: 3, name: 'Tier Three' },
      { id: 'y1', floorId: 'Yesod', tier: 1, name: 'Other Floor' },
    ],
  });
}

test('emotion levels use the documented per-level coin thresholds and floor cap', () => {
  const floor = createTestFloor({ realizationLevel: 1 });
  const member = floor.librarians[0];
  progression.awardEmotionCoins(floor, member.id, { positive: 2 });
  assert.equal(progression.endScene(floor).levelUps.length, 0);
  progression.awardEmotionCoins(floor, member.id, { negative: 1 });
  assert.equal(progression.endScene(floor).levelUps[0].emotionLevel, 1);
  progression.awardEmotionCoins(floor, member.id, { positive: 9 });
  progression.endScene(floor);
  assert.equal(member.emotionLevel, 1);
  assert.equal(member.pendingEmotionCoins, 0);
});

test('team emotion offers only the matching floor tier and a picked page persists through the reception', () => {
  const floor = createTestFloor();
  const member = floor.librarians[0];
  progression.awardEmotionCoins(floor, member.id, { positive: 3 });
  const scene = progression.endScene(floor, () => 0);
  assert.equal(scene.teamEmotionLevel, 1);
  assert.equal(scene.pageOffers[0].tier, 1);
  assert.ok(scene.pageOffers[0].options.every((page) => page.floorId === 'Malkuth' && page.tier === 1));
  const selected = scene.pageOffers[0].options[0];
  assert.equal(progression.chooseAbnormalityPage(floor, member.id, selected.id), true);
  assert.equal(member.abnormalityPages[0].sourceFloorId, 'Malkuth');
  progression.endReception(floor);
  assert.equal(member.abnormalityPages.length, 0);
  assert.equal(floor.teamEmotionLevel, 0);
});

test('team emotion is averaged across librarians and only fully realized floors unlock E.G.O. pages', () => {
  const floor = createTestFloor({ librarians: [{ id: 'a' }, { id: 'b' }] });
  progression.awardEmotionCoins(floor, 'a', { positive: 3 });
  progression.endScene(floor);
  assert.equal(progression.averageTeamEmotionLevel(floor), 0.5);
  assert.equal(floor.teamEmotionLevel, 0);
  assert.equal(progression.canChooseEgoPage(floor, 3), true);
  assert.equal(progression.canChooseEgoPage({ fullyRealized: false }, 3), false);
  assert.equal(progression.guestEmotionCap(8), 5);
});