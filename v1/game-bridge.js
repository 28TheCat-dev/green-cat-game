(function () {
  'use strict';
  const C = window.CatCollision;
  window.SUIKA_PARTS = C.read(window.SUIKA_PARTS);
  window.addEventListener('message', e => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === 'green-cat-display') { window.CAT_SHOW_COLLIDERS = !!e.data.show; return; }
    if (e.data.type !== 'green-cat-preview') return;
    try {
      const shapes = C.validate(e.data.shapes);
      // 保留数组引用，物理引擎会直接使用新的形状。
      window.SUIKA_PARTS.splice(0, 11, ...shapes);
      window.CAT_SHOW_COLLIDERS = !!e.data.show;
      if (window.__DNW__) window.__DNW__.reset();
    } catch (err) { console.warn(err.message); }
  });
})();
