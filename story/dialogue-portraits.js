(() => {
  const expressionAliases = {
    angela: {
      default: 'AngelaDialogue1',
    },
    roland: {
      default: 'Neutral',
      tired: 'Nervous',
      injured: 'Surprised',
    },
  };

  function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function resolve(speakerId, expression = 'default') {
    if (!speakerId) return null;
    const key = normalize(speakerId);
    const matchingAssets = getVariants(speakerId);
    if (matchingAssets.length) {
      const desiredExpression = expressionAliases[key]?.[expression] || expression;
      const match = matchingAssets.find((asset) => normalize(asset.expression || '') === normalize(desiredExpression));
      if (match) return match;
      const defaultExpression = expressionAliases[key]?.default || 'default';
      const fallback = matchingAssets.find((asset) => normalize(asset.expression || '') === normalize(defaultExpression));
      const dialogueVariant = matchingAssets.find((asset) => /dialogue/i.test(asset.title));
      const neutralVariant = matchingAssets.find((asset) => /neutral|default/i.test(asset.expression || ''));
      return fallback || neutralVariant || dialogueVariant || matchingAssets[0];
    }
    const profileAssets = window.LOCAL_ASSET_GROUPS?.dialogue || [];
    const prefix = `${key}dia`;
    return profileAssets.find((asset) => normalize(asset.title).startsWith(prefix)) || null;
  }

  function getVariants(speakerId) {
    const key = normalize(speakerId || '');
    return (window.LOCAL_ASSET_GROUPS?.dialogueGallery || [])
      .filter((asset) => normalize(asset.speakerId || '') === key);
  }

  window.DialoguePortraits = { resolve, getVariants };
})();