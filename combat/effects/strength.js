const strengthEffect = {
  name: 'Strength',
  onBeforeDie(event, stacks) {
    if (event.die.kind === 'attack') event.power += stacks;
  },
};

window.CombatRegistry.registerEffect('strength', strengthEffect);
window.CombatRegistry.registerEffect('Strength', strengthEffect);
window.CombatRegistry.registerEffect('Strength_Keyword', strengthEffect);