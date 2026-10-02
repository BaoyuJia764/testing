window.CombatRegistry.registerAbnormalityPageScript('fairy2', {
  name: 'Gluttony',
  onBeforeDie(event) {
    if (event.die.kind !== 'attack' || !event.target.sceneDamageTaken) return;
    event.power += 1 + Math.floor(event.random() * 3);
    event.gluttonyHeal = 2 + Math.floor(event.random() * 4);
  },
  onHit({ unit, gluttonyHeal }) {
    if (!gluttonyHeal) return;
    unit.hp = Math.min(unit.maxHp, unit.hp + gluttonyHeal);
  },
});