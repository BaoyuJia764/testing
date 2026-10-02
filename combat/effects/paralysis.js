const paralysisEffect = {
  name: 'Paralysis',
  onSceneStart(unit, stacks, status) {
    status.remainingDice = stacks;
  },
  onBeforeDie(event, stacks, status) {
    if (status.remainingDice <= 0) return;
    event.die.max = Math.max(event.die.min, event.die.max - 3);
    status.remainingDice -= 1;
  },
};

window.CombatRegistry.registerEffect('Paralysis', paralysisEffect);
window.CombatRegistry.registerEffect('Paralysis_Keyword', paralysisEffect);