window.CombatRegistry.registerAbnormalityPageScript('burnningGirl2', {
  name: 'Footfalls',
  onSceneStart({ unit, currentTarget, random, applyStatus }) {
    if (!currentTarget || unit.hp > unit.maxHp * 0.2) return;
    const damage = Math.min(36, currentTarget.maxHp * 0.3);
    currentTarget.hp = Math.max(0, currentTarget.hp - damage);
    applyStatus(currentTarget, 'Burn', 1 + Math.floor(random() * 3));
    unit.hp = 0;
    unit.defeated = true;
  },
});