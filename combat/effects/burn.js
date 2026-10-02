window.CombatRegistry.registerEffect('Burn', {
  onSceneEnd(unit, stacks, status) {
    unit.hp = Math.max(0, unit.hp - stacks);
    status.stacks = Math.max(0, stacks - Math.floor(stacks / 3));
  },
});