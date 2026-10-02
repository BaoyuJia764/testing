const catalogCard = window.TIPHERETH_CATALOG.cards.find((card) => card.id === '13');

window.CombatRegistry.registerCard('13', {
  ...catalogCard,
  dice: catalogCard.dice.map((die) => ({
    kind: die.kind === 'Atk' ? 'attack' : 'defense',
    damageType: die.damageType,
    min: die.min,
    max: die.max,
  })),
});