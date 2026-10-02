const disarmEffect = {
  name: 'Disarm',
  onBeforeDie(event, stacks) {
    if (event.die.kind === 'defense') event.power -= stacks;
  },
};

window.CombatRegistry.registerEffect('Disarm', disarmEffect);
window.CombatRegistry.registerEffect('Disarm_Keyword', disarmEffect);