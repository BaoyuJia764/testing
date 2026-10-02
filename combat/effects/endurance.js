const enduranceEffect = {
  name: 'Endurance',
  onBeforeDie(event, stacks) {
    if (event.die.kind === 'defense') event.power += stacks;
  },
};

window.CombatRegistry.registerEffect('Endurance', enduranceEffect);
window.CombatRegistry.registerEffect('Endurance_Keyword', enduranceEffect);