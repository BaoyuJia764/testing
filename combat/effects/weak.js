const weakEffect = {
  name: 'Feeble',
  onBeforeDie(event, stacks) {
    if (event.die.kind === 'attack') event.power -= stacks;
  },
};

window.CombatRegistry.registerEffect('Weak', weakEffect);
window.CombatRegistry.registerEffect('Weak_Keyword', weakEffect);