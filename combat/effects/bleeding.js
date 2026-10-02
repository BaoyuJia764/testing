const bleedingEffect = {
  name: 'Bleeding',
  onAfterDie(event, stacks, status) {
    if (event.die.kind !== 'attack') return;
    event.owner.hp = Math.max(0, event.owner.hp - stacks);
    status.stacks = Math.max(0, stacks - Math.ceil(stacks / 3));
  },
};

window.CombatRegistry.registerEffect('Bleeding', bleedingEffect);
window.CombatRegistry.registerEffect('Bleeding_Keyword', bleedingEffect);