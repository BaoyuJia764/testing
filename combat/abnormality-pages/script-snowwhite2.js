window.CombatRegistry.registerAbnormalityPageScript('snowwhite2', {
  name: 'Barrier of Thorns',
  onDamaged({ unit, attacker, random, applyStatus }) {
    if (!attacker) return;
    const reflectedDamage = 2 + Math.floor(random() * 7);
    const actualDamage = Math.min(attacker.hp, reflectedDamage);
    attacker.hp = Math.max(0, attacker.hp - reflectedDamage);
    const bind = 1 + Math.floor(random() * 3);
    applyStatus(attacker, 'Binding', bind);
    if (bind === 3) unit.hp = Math.min(unit.maxHp, unit.hp + actualDamage);
  },
});