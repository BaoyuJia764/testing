window.CombatRegistry.registerAbnormalityPageScript('fairy3', {
  name: 'Predation',
  onEquip({ unit, allies, applyStatus }) {
    let recovered = 0;
    for (const ally of allies || []) {
      if (ally === unit) continue;
      const lost = Math.min(10, ally.hp);
      ally.hp = Math.max(0, ally.hp - 10);
      recovered += lost;
    }
    unit.hp = Math.min(unit.maxHp, unit.hp + recovered);
    applyStatus(unit, 'Strength', 3, 1);
    applyStatus(unit, 'Haste', 3, 1);
  },
});