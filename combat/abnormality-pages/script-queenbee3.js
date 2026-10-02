window.CombatRegistry.registerAbnormalityPageScript('queenbee3', {
  name: 'Loyalty',
  onSceneStart({ unit, allies, applyStatus }) {
    const strength = Math.floor((unit.previousSceneDamage || 0) / 5);
    if (strength <= 0) return;
    for (const ally of allies || [unit]) applyStatus(ally, 'Strength', strength, 1);
  },
});