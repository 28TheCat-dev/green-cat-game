/* 与原引擎 ASSET_FILL = 0.92 一致。编辑坐标为 512 × 512 图片像素。 */
(function () {
  'use strict';
  const SIZE = 512, UNIT = SIZE * 0.92 / 2;
  const KEY = 'green-cat.collisions.v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  function validate(input) {
    if (!Array.isArray(input) || input.length !== 11) throw Error('需要 11 级碰撞数据，按图片 1～11 排列。');
    return input.map((shape, i) => {
      if (!shape || !Array.isArray(shape.parts) || !shape.parts.length || shape.parts.length > 16) throw Error('第 '+(i+1)+' 级需要 1～16 个圆。');
      const parts = shape.parts.map(p => {
        if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || p[2] < 0.02) throw Error('每个圆必须是 [偏移X, 偏移Y, 正半径]。');
        return p.slice();
      });
      const rb = Math.max(...parts.map(p => Math.hypot(p[0], p[1]) + p[2]));
      const maxRb=195/[17,23,31,39,48,58,69,81,94,108,124][i];
      if (rb > maxRb) throw Error('第 '+(i+1)+' 级的碰撞范围太大，请缩小圆或移近图片中心。');
      // rb 向上取整，避免导出舍入导致包围圆偏小。
      return { rb: Math.ceil(rb * 1000000) / 1000000, parts };
    });
  }
  function fromPixels(p) { return [(p[0]-256)/UNIT, (p[1]-256)/UNIT, p[2]/UNIT]; }
  function toPixels(p) { return [256+p[0]*UNIT, 256+p[1]*UNIT, p[2]*UNIT]; }
  function read(fallback) {
    try { const raw = localStorage.getItem(KEY); if(raw) return validate(JSON.parse(raw)); } catch (_) {}
    return validate(clone(fallback));
  }
  window.CatCollision = { SIZE, UNIT, KEY, clone, validate, fromPixels, toPixels, read };
})();
