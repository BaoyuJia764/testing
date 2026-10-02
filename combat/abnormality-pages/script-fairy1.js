window.CombatRegistry.registerAbnormalityPageScript('fairy1', {
  name: 'The Fairies\' Care',
  onEquip({ unit }) {
    unit.effects.set('fairy-care', { scenesLeft: 3, hits: 0 });
  },
  onDamaged({ unit }) {
    const effect = unit.effects.get('fairy-care');
    if (!effect) return;
    effect.hits += 1;
    if (effect.hits < 3) return;
    unit.hp = Math.max(0, unit.hp - Math.min(30, Math.ceil(unit.hp * 0.25)));
    unit.effects.delete('fairy-care');
  },
  onSceneEnd({ unit }) {
    const effect = unit.effects.get('fairy-care');
    if (!effect) return;
    unit.hp = Math.min(unit.maxHp, unit.hp + Math.min(18, Math.floor(unit.maxHp * 0.15)));
    effect.scenesLeft -= 1;
    effect.hits = 0;
    if (effect.scenesLeft <= 0) unit.effects.delete('fairy-care');
  },
});