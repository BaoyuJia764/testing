window.CombatRegistry.registerAbnormalityPageScript('queenbee1', {
  name: 'Spores',
  onDamaged({ attacker, random, scheduleStatus }) {
    if (!attacker) return;
    scheduleStatus(attacker, 'Burn', 1 + Math.floor(random() * 3));
    scheduleStatus(attacker, 'Bleeding', 1 + Math.floor(random() * 3));
  },
});