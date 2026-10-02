window.CombatRegistry.registerEffect('Binding', {
  name: 'Bind',
  onSpeedRoll(unit, speed, stacks) {
    return speed - stacks;
  },
});