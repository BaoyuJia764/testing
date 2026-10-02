(() => {
  const storageKey = 'lor-assistant-customization';
  const imageParts = ['body', 'hairRear', 'skin', 'eyes', 'eyebrows', 'mouth', 'hairFront', 'idle', 'attack', 'hit', 'block', 'evade'];
  const colorParts = ['hair', 'eyes', 'skin'];
  const expressions = ['idle', 'attack', 'hit', 'block', 'evade'];
  const tintCache = new Map();

  function readSaved() {
    try {
      return JSON.parse(window.localStorage?.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  }

  function save(unit) {
    try {
      const saved = readSaved();
      saved[unit.id] = { assetUrls: unit.appearance.assetUrls, colors: unit.appearance.colors };
      window.localStorage?.setItem(storageKey, JSON.stringify(saved));
    } catch {}
  }

  function attach(unit) {
    if (unit.role !== 'assistant') return null;
    const saved = readSaved()[unit.id] || {};
    const appearance = {
      parts: Object.fromEntries(imageParts.map((part) => [part, null])),
      assetUrls: saved.assetUrls || {},
      colors: { hair: '#332b2a', eyes: '#8fb9b3', skin: '#d8bca7', ...(saved.colors || {}) },
      expression: 'idle',
    };
    unit.appearance = appearance;
    if (typeof Image !== 'undefined') {
      for (const [part, url] of Object.entries(appearance.assetUrls)) {
        if (!imageParts.includes(part) || !url) continue;
        const image = new Image();
        image.onload = () => { appearance.parts[part] = image; };
        image.src = url;
      }
    }
    return appearance;
  }

  function setPart(unit, part, image, url) {
    if (unit.role !== 'assistant' || !imageParts.includes(part)) return false;
    unit.appearance ||= attach(unit);
    unit.appearance.parts[part] = image;
    unit.appearance.assetUrls[part] = url;
    save(unit);
    return true;
  }

  function setColor(unit, colorPart, value) {
    if (unit.role !== 'assistant' || !colorParts.includes(colorPart)) return false;
    unit.appearance ||= attach(unit);
    unit.appearance.colors[colorPart] = value;
    save(unit);
    return true;
  }

  function setExpression(unit, expression) {
    if (unit.role !== 'assistant' || !expressions.includes(expression)) return false;
    unit.appearance ||= attach(unit);
    unit.appearance.expression = expression;
    return true;
  }

  function tintedImage(image, color) {
    if (!image?.complete || !image.naturalWidth || !color) return image;
    const key = `${image.src}|${color}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const tintContext = canvas.getContext('2d');
    tintContext.drawImage(image, 0, 0);
    tintContext.globalCompositeOperation = 'source-atop';
    tintContext.fillStyle = color;
    tintContext.fillRect(0, 0, canvas.width, canvas.height);
    tintContext.globalCompositeOperation = 'source-over';
    tintCache.set(key, canvas);
    return canvas;
  }

  window.AssistantCustomization = { imageParts, colorParts, expressions, attach, setPart, setColor, setExpression, tintedImage };
})();