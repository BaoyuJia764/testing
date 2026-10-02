(() => {
  const activeEffects = [];
  const animations = new Map();
  let defaultAnimation = {
    image: null,
    columns: 1,
    rows: 1,
    frameDuration: 70,
    loop: false,
    scale: 1,
  };

  function normalizeAnimation(animation) {
    return {
      image: animation.image || null,
      frames: Array.isArray(animation.frames) ? animation.frames : null,
      columns: Math.max(1, Math.floor(animation.columns || 1)),
      rows: Math.max(1, Math.floor(animation.rows || 1)),
      frameDuration: Math.max(16, animation.frameDuration || 70),
      loop: Boolean(animation.loop),
      scale: Math.max(0.1, animation.scale || 1),
    };
  }

  function setSprite(image, settings = {}) {
    defaultAnimation = normalizeAnimation({ ...settings, image });
  }

  function registerAnimation(id, animation) {
    animations.set(String(id), normalizeAnimation(animation));
  }

  function emit({ kind = 'impact', x = 0.5, y = 0.55, color = '#f1876d', duration, animationId = 'default' } = {}) {
    const animation = animationId === 'default' ? defaultAnimation : animations.get(String(animationId)) || defaultAnimation;
    const frameCount = animation.frames?.length || animation.columns * animation.rows;
    const hasFrames = Boolean(animation.frames?.length || animation.image);
    const animationDuration = hasFrames && frameCount > 1 && !animation.loop
      ? frameCount * animation.frameDuration
      : 650;
    activeEffects.push({
      kind,
      x,
      y,
      color,
      duration: duration || animationDuration,
      startedAt: performance.now(),
      animation,
    });
  }

  function render(context, now, width, height) {
    for (let index = activeEffects.length - 1; index >= 0; index -= 1) {
      const effect = activeEffects[index];
      const progress = (now - effect.startedAt) / effect.duration;
      if (progress >= 1) {
        activeEffects.splice(index, 1);
        continue;
      }

      const x = effect.x * width;
      const y = effect.y * height;
      const scale = 0.35 + progress * 1.1;
      context.save();
      context.globalAlpha = 1 - progress;
      context.translate(x, y - progress * 16);
      context.scale(scale * effect.animation.scale, scale * effect.animation.scale);
      const animation = effect.animation;
      const frameCount = animation.frames?.length || animation.columns * animation.rows;
      const rawFrame = Math.floor((now - effect.startedAt) / animation.frameDuration);
      const frame = animation.loop ? rawFrame % frameCount : Math.min(rawFrame, frameCount - 1);
      const image = animation.frames?.[frame] || animation.image;
      if (image?.complete && image.naturalWidth && image.naturalHeight) {
        if (animation.frames?.length) {
          const size = Math.min(116, width * 0.2);
          const drawHeight = size * image.naturalHeight / image.naturalWidth;
          context.drawImage(image, -size / 2, -drawHeight / 2, size, drawHeight);
        } else {
          const frameWidth = image.naturalWidth / animation.columns;
          const frameHeight = image.naturalHeight / animation.rows;
          const sourceX = (frame % animation.columns) * frameWidth;
          const sourceY = Math.floor(frame / animation.columns) * frameHeight;
          const size = Math.min(116, width * 0.2);
          const drawHeight = size * frameHeight / frameWidth;
          context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, -size / 2, -drawHeight / 2, size, drawHeight);
        }
      } else {
        context.strokeStyle = effect.color;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, 21, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = `${effect.color}55`;
        context.fillRect(-2, -34, 4, 68);
        context.fillRect(-34, -2, 68, 4);
      }
      context.restore();
    }
  }

  function clear() {
    activeEffects.length = 0;
  }

  window.CombatVfx = { setSprite, registerAnimation, emit, render, clear, get pendingCount() { return activeEffects.length; } };
})();