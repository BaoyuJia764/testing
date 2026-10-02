import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
for (const file of ['../assets/lor/manifest.js', '../story/dialogue-portraits.js', '../story/scenes.js', '../story/dialogue-local.js']) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

test('a filled local opening scene overrides the built-in sample', () => {
  const localScene = context.window.LOCAL_STORY_SCENES[0];
  assert.equal(localScene.dialogue.length, 31);
  localScene.dialogue = [{ speaker: 'Angela', text: 'Authorized opening line.' }];
  const selected = context.window.StoryScenes.find('atrium', 'beforeEncounter');
  assert.equal(selected.id, 'atrium-opening-local');
  assert.equal(selected.sourceUrl, 'https://tiphereth.zasz.su/episodes/1_1_1/');
  assert.equal(selected.dialogue[0].speaker, 'Angela');
});

test('speaker identity resolves local portraits and line expressions select variants', () => {
  const portraits = context.window.DialoguePortraits;
  assert.match(portraits.resolve('angela').url, /AngelaDialogue1\.png$/);
  assert.match(portraits.resolve('roland').url, /RolandFullBody\.png$/);
  assert.match(portraits.resolve('roland', 'tired').url, /RolandNervous\.png$/);
  assert.match(portraits.resolve('roland', 'injured').url, /RolandSurprise\.png$/);
  assert.match(portraits.resolve('roland', 'Dialogue4').url, /RolandDialogue4\.png$/);
  assert.equal(portraits.resolve('unknown-speaker'), null);
  const gallery = context.window.LOCAL_ASSET_GROUPS.dialogueGallery;
  assert.equal(gallery.length, 188);
  assert.ok(new Set(gallery.map((asset) => asset.speakerId)).size >= 53);
  const otherSpeakerId = gallery.find((asset) => asset.speakerId !== 'angela' && asset.speakerId !== 'roland').speakerId;
  assert.ok(portraits.getVariants(otherSpeakerId).length > 0);
  assert.ok(portraits.resolve(otherSpeakerId));
});