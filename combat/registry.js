(() => {
  const effects = new Map();
  const passives = new Map();
  const cards = new Map();
  const abnormalityPages = new Map();
  const abnormalityPageScripts = new Map();
  const catalog = window.TIPHERETH_CATALOG || {};

  function findCatalogEntry(entries, id) {
    return entries?.find((entry) => String(entry.id) === String(id));
  }

  function findCard(id) {
    return cards.get(String(id)) || findCatalogEntry(catalog.cards, id);
  }

  function findPassive(id) {
    return passives.get(String(id)) || findCatalogEntry(catalog.passives, id);
  }

  function register(registry, id, definition, kind) {
    const key = String(id);
    if (!key || registry.has(key)) throw new Error(`Duplicate or empty ${kind} ID: ${key}`);
    registry.set(key, Object.freeze(definition));
  }

  function registerEffect(id, definition) {
    register(effects, id, definition, 'effect');
  }

  function registerPassive(id, definition) {
    register(passives, id, definition, 'passive');
  }

  function registerCard(id, definition) {
    register(cards, id, definition, 'card');
  }

  function registerAbnormalityPage(id, definition) {
    register(abnormalityPages, id, definition, 'abnormality page');
  }

  function registerAbnormalityPageScript(scriptId, definition) {
    register(abnormalityPageScripts, scriptId, definition, 'abnormality page script');
  }

  function equipAbnormalityPage(unit, page, event = {}) {
    const equippedPage = (unit.abnormalityPages || []).find((entry) => entry.id === page.id) || page;
    if (!unit.abnormalityPages) unit.abnormalityPages = [];
    if (!unit.abnormalityPages.some((entry) => entry.id === equippedPage.id)) unit.abnormalityPages.push(equippedPage);
    findAbnormalityPageHandler(equippedPage)?.onEquip?.({ ...event, unit, page: equippedPage, applyEffect, applyStatus, scheduleStatus });
    return equippedPage;
  }

  function findAbnormalityPageHandler(page) {
    return abnormalityPages.get(String(page.id)) || abnormalityPageScripts.get(String(page.scriptId));
  }

  function createEnemy(definition) {
    if (!definition) throw new Error('Enemy definition is missing');
    const missingPassives = definition.passiveIds.filter((id) => !findPassive(id));
    const missingCards = definition.cardIds.filter((id) => !findCard(id));
    if (missingPassives.length || missingCards.length) {
      throw new Error(`Enemy ${definition.id} references unregistered content: ${[...missingPassives, ...missingCards].join(', ')}`);
    }
    return {
      ...definition,
      side: 'enemy',
      hp: definition.maxHp,
      effects: new Map(),
      statuses: new Map(),
      abnormalityPages: definition.abnormalityPages || [],
    };
  }

  function applyEffect(unit, effectId, stacks = 1) {
    const key = String(effectId);
    const effect = effects.get(key);
    if (!effect) throw new Error(`Unknown effect ID: ${key}`);
    const totalStacks = (unit.effects.get(key) || 0) + stacks;
    unit.effects.set(key, totalStacks);
    effect.onApply?.(unit, stacks);
    return totalStacks;
  }

  function applyStatus(unit, statusId, stacks = 1, duration = 0) {
    if (!unit.statuses) unit.statuses = new Map();
    const key = String(statusId);
    const previous = unit.statuses.get(key) || { stacks: 0, duration: 0 };
    const status = {
      stacks: previous.stacks + stacks,
      duration: Math.max(previous.duration, duration),
    };
    unit.statuses.set(key, status);
    return status;
  }

  function resolveSpeedRoll(unit, baseSpeed) {
    let speed = baseSpeed;
    for (const [statusId, status] of unit.statuses || []) {
      const adjusted = effects.get(statusId)?.onSpeedRoll?.(unit, speed, status.stacks, status);
      if (Number.isFinite(adjusted)) speed = adjusted;
    }
    return Math.max(1, speed);
  }

  function scheduleStatus(unit, statusId, stacks = 1) {
    if (!unit.pendingStatuses) unit.pendingStatuses = new Map();
    const key = String(statusId);
    unit.pendingStatuses.set(key, (unit.pendingStatuses.get(key) || 0) + stacks);
  }

  function triggerAbnormalityPages(unit, trigger, event = {}) {
    for (const page of unit.abnormalityPages || []) {
      findAbnormalityPageHandler(page)?.[trigger]?.(Object.assign(event, {
        unit,
        currentTarget: event.currentTarget || unit.currentTarget || null,
        random: event.random || Math.random,
        applyEffect,
        applyStatus,
        scheduleStatus,
      }));
    }
  }

  function startUnitScene(unit, event = {}) {
    setAssistantExpression(unit, 'idle');
    for (const [statusId, stacks] of unit.pendingStatuses || []) applyStatus(unit, statusId, stacks);
    unit.pendingStatuses?.clear();
    for (const [statusId, status] of unit.statuses || []) {
      effects.get(statusId)?.onSceneStart?.(unit, status.stacks, status);
    }
    triggerAbnormalityPages(unit, 'onSceneStart', event);
  }

  function endUnitScene(unit) {
    for (const [statusId, status] of unit.statuses || []) {
      effects.get(statusId)?.onSceneEnd?.(unit, status.stacks, status);
      if (status.duration > 0 && status.duration <= 1) unit.statuses.delete(statusId);
      else if (status.duration > 1) unit.statuses.set(statusId, { ...status, duration: status.duration - 1 });
      else if (status.stacks <= 0) unit.statuses.delete(statusId);
    }
    triggerAbnormalityPages(unit, 'onSceneEnd');
    unit.previousSceneDamage = unit.sceneDamageTaken || 0;
    unit.sceneDamageTaken = 0;
  }

  function setAssistantExpression(unit, expression) {
    if (unit?.role === 'assistant') window.AssistantCustomization?.setExpression(unit, expression);
  }

  function notifyAbnormalityPage(unit, trigger, event = {}) {
    triggerAbnormalityPages(unit, trigger, event);
  }

  function resolveCard(cardId, owner, target, random = Math.random) {
    const key = String(cardId);
    const card = findCard(key);
    if (!card) throw new Error(`Unknown card ID: ${key}`);
    if (card.availability === 'EnemyOnly' && owner.side !== 'enemy') {
      throw new Error(`Card ${key} is restricted to enemies`);
    }
    if (card.availability === 'KeypageOnly' && !card.keyPageIds?.some((id) => owner.keyPageIds?.includes(id))) {
      throw new Error(`Card ${key} requires one of its listed key pages`);
    }

    const results = (card.dice || []).map((sourceDie) => {
      const die = {
        ...sourceDie,
        kind: sourceDie.kind === 'Atk' ? 'attack' : sourceDie.kind === 'Def' ? 'defense' : sourceDie.kind,
        min: Number.isFinite(sourceDie.min) ? sourceDie.min : 0,
        max: Number.isFinite(sourceDie.max) ? sourceDie.max : Number.isFinite(sourceDie.min) ? sourceDie.min : 0,
      };
      const event = {
        cardId: key,
        owner,
        target,
        die,
        roll: die.min + Math.floor(random() * (die.max - die.min + 1)),
        power: 0,
        random,
        triggeredPassiveIds: [],
      };
      owner.currentTarget = target;
      target.currentTarget = owner;
      triggerAbnormalityPages(owner, 'onBeforeDie', event);
      setAssistantExpression(owner, die.kind === 'attack' ? 'attack' : die.damageType === 'Evade' ? 'evade' : 'block');
      for (const passiveId of owner.passiveIds || []) {
        passives.get(String(passiveId))?.onBeforeDie?.(event);
      }
      for (const [effectId, stacks] of owner.effects || []) {
        effects.get(effectId)?.onBeforeDie?.(event, stacks);
      }
      for (const [statusId, status] of owner.statuses || []) {
        effects.get(statusId)?.onBeforeDie?.(event, status.stacks, status);
      }
      const result = Math.max(0, event.roll + event.power);
      let actualDamage = 0;
      if (die.kind === 'attack') {
        let damage = result;
        for (const [statusId, status] of target.statuses || []) {
          const adjustedDamage = effects.get(statusId)?.onIncomingDamage?.({ unit: target, attacker: owner, die, damage }, status.stacks, status);
          if (Number.isFinite(adjustedDamage)) damage = Math.max(0, adjustedDamage);
        }
        actualDamage = Math.min(target.hp, damage);
        target.hp = Math.max(0, target.hp - damage);
        target.sceneDamageTaken = (target.sceneDamageTaken || 0) + actualDamage;
        event.actualDamage = actualDamage;
        event.result = result;
        for (const [statusId, status] of owner.statuses || []) {
          effects.get(statusId)?.onAfterDie?.(event, status.stacks, status);
        }
        if (actualDamage > 0) {
          setAssistantExpression(target, 'hit');
          triggerAbnormalityPages(target, 'onDamaged', { attacker: owner, damage: actualDamage, die, random });
          triggerAbnormalityPages(owner, 'onHit', { ...event, target, damage: actualDamage, die, random });
          window.CombatVfx?.emit({
            kind: 'impact',
            x: target.side === 'enemy' ? 0.69 : 0.22,
            y: 0.58,
            color: die.damageType === 'Blunt' ? '#f1876d' : '#d5ef86',
          });
        }
      }
      return { ...event, result, damage: actualDamage };
    });
    cards.get(key)?.onResolve?.({ cardId: key, owner, target, results, applyEffect });
    return results;
  }

  window.CombatRegistry = {
    registerEffect,
    registerPassive,
    registerCard,
    registerAbnormalityPage,
    registerAbnormalityPageScript,
    createEnemy,
    applyEffect,
    applyStatus,
    resolveSpeedRoll,
    scheduleStatus,
    equipAbnormalityPage,
    notifyAbnormalityPage,
    startUnitScene,
    endUnitScene,
    resolveCard,
  };
})();