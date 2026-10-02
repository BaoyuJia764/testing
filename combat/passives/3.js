const catalogPassive = window.TIPHERETH_CATALOG.passives.find((passive) => passive.id === '3');

window.CombatRegistry.registerPassive('3', {
  ...catalogPassive,
  onBeforeDie(event) {
    if (event.die.damageType !== 'Blunt' || event.random() >= 0.25) return;
    event.power += 1;
    event.triggeredPassiveIds.push('3');
  },
});