window.CombatRegistry.registerEffect('Haste', {
  name: 'Haste',
  onSpeedRoll(unit, speed, stacks) {
    return speed + stacks;
  },
});