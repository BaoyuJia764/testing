const ashesPage = window.ABNORMALITY_PAGE_CATALOG.find((page) => page.id === 'Malkuth:1');

window.CombatRegistry.registerAbnormalityPage('Malkuth:1', {
  name: ashesPage.name,
  source: ashesPage.source,
  onDamaged({ unit, attacker, random, applyStatus }) {
    if (!attacker) return;
    applyStatus(attacker, 'Burn', 1 + Math.floor(random() * 3));
    if (random() < 0.4) unit.effects.set('ashes-burn-next-scene', 1);
  },
  onSceneStart({ unit }) {
    if (!unit.effects.has('ashes-burn-next-scene')) return;
    unit.effects.delete('ashes-burn-next-scene');
    unit.effects.set('ashes-burn-on-hit', 1);
  },
  onHit({ unit, target, applyStatus }) {
    if (unit.effects.has('ashes-burn-on-hit')) applyStatus(target, 'Burn', 1);
  },
  onSceneEnd({ unit }) {
    unit.effects.delete('ashes-burn-on-hit');
  },
});