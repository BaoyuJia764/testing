const vulnerableEffect = {
  name: 'Fragile',
  onIncomingDamage({ damage }, stacks) {
    return damage + stacks;
  },
};

window.CombatRegistry.registerEffect('Vulnerable', vulnerableEffect);
window.CombatRegistry.registerEffect('Vulnerable_Keyword', vulnerableEffect);