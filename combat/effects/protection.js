const protectionEffect = {
  name: 'Protection',
  onIncomingDamage({ damage }, stacks) {
    return Math.max(0, damage - stacks);
  },
};

window.CombatRegistry.registerEffect('Protection', protectionEffect);
window.CombatRegistry.registerEffect('Protection_Keyword', protectionEffect);