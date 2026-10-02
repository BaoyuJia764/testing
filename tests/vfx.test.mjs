import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../combat/vfx.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {}, performance: { now: () => 0 } });
vm.runInContext(source, context);
const vfx = context.window.CombatVfx;

test('spritesheet VFX advances frames, renders the selected cell, and expires', () => {
  const sprite = { complete: true, naturalWidth: 128, naturalHeight: 64 };
  const drawCalls = [];
  const drawingContext = {
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, stroke() {}, fillRect() {},
    drawImage(...args) { drawCalls.push(args); },
  };
  vfx.setSprite(sprite, { columns: 4, rows: 2, frameDuration: 50 });
  vfx.emit({ x: 0.4, y: 0.5 });
  vfx.render(drawingContext, 125, 640, 360);
  assert.equal(drawCalls[0][0], sprite);
  assert.deepEqual(Array.from(drawCalls[0].slice(1, 5)), [64, 0, 32, 32]);
  vfx.render(drawingContext, 401, 640, 360);
  assert.equal(vfx.pendingCount, 0);
});

test('VFX can play a sequence of separate image frames', () => {
  const frames = [
    { id: 'frame-one', complete: true, naturalWidth: 64, naturalHeight: 64 },
    { id: 'frame-two', complete: true, naturalWidth: 64, naturalHeight: 64 },
  ];
  const drawnImages = [];
  const drawingContext = {
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, stroke() {}, fillRect() {},
    drawImage(image) { drawnImages.push(image); },
  };
  vfx.registerAnimation('two-frame', { frames, frameDuration: 50 });
  vfx.emit({ animationId: 'two-frame' });
  vfx.render(drawingContext, 75, 640, 360);
  assert.equal(drawnImages[0].id, 'frame-two');
  vfx.clear();
});