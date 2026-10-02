window.CombatRegistry.registerAbnormalityPageScript('snowwhite3', {
  name: 'Malice',
  onSceneStart({ unit, allEnemies }) {
    if (!unit.maxHp) return;
    const missingHpRatio = Math.max(0, 1 - unit.hp / unit.maxHp);
    const damage = Math.max(5, Math.min(30, Math.round(5 + missingHpRatio * 25)));
    for (const enemy of allEnemies || []) enemy.hp = Math.max(0, enemy.hp - damage);
  },
});