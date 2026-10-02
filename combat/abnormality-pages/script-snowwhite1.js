window.CombatRegistry.registerAbnormalityPageScript('snowwhite1', {
  name: 'Vines',
  onSceneStart({ unit, allEnemies, random, applyStatus }) {
    const targets = (allEnemies || []).filter((enemy) => enemy.hp > 0);
    if (!targets.length) return;
    const target = targets[Math.floor(random() * targets.length)];
    unit.effects.set('vines-target-id', target.id);
    applyStatus(target, 'Binding', 6);
  },
  onBeforeDie(event) {
    if (event.die.kind !== 'attack' || event.die.damageType !== 'Pierce') return;
    if (event.target?.id !== event.unit.effects.get('vines-target-id')) return;
    event.power += 1 + Math.floor(event.random() * 2);
  },
});