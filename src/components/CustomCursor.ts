/**
 * CustomCursor —— 自定义光标
 * 默认：小圆点，跟随鼠标（lerp 缓动）
 * 悬停可交互元素（a / button / [data-cursor]）：圆点放大半透明
 * 悬停文本元素（p / h1-h6 / span / li / time / blockquote）：变为竖线
 * 触摸设备 / prefers-reduced-motion 不激活（has-cursor 不加，系统光标恢复）
 *
 * 跨页面位置保持：鼠标坐标存储在 window.__cursorPos，页面切换重建光标时
 * 直接从上次位置初始化，避免从左上角跳动；首次移动时吸附而非缓动。
 */

const INTERACTIVE_SELECTOR = 'a, button, [data-cursor="hover"]';
const TEXT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, span, li, time, blockquote, td, th, figcaption';

interface CursorPos { x: number; y: number }

declare global {
  interface Window { __cursorPos?: CursorPos }
}

function initCursor(): void {
  // 触摸设备 / 减弱动画：不激活（has-cursor 不加，系统光标保留）
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 每次页面切换都重建，防止旧实例的事件泄漏
  document.querySelectorAll('.cursor-dot').forEach((el) => el.remove());

  const cursor = document.createElement('div');
  cursor.className = 'cursor-dot';
  document.body.appendChild(cursor);

  // 从跨页面存储的位置初始化；无记录时以 NaN 标记“尚未初始化”
  const stored = window.__cursorPos;
  let x = stored ? stored.x : NaN;
  let y = stored ? stored.y : NaN;
  let lastX = stored ? stored.x : 0;
  let lastY = stored ? stored.y : 0;

  const move = (e: MouseEvent) => {
    window.__cursorPos = { x: e.clientX, y: e.clientY };
    lastX = e.clientX;
    lastY = e.clientY;
    // 首次移动：直接吸附，不做从原点出发的缓动
    if (Number.isNaN(x)) {
      x = lastX;
      y = lastY;
    }
    if (!cursor.classList.contains('visible')) cursor.classList.add('visible');

    const target = e.target as Element | null;
    const isInteractive = !!target?.closest?.(INTERACTIVE_SELECTOR);
    const isText = !isInteractive && !!target?.closest?.(TEXT_SELECTOR);
    cursor.classList.toggle('hovering', isInteractive);
    cursor.classList.toggle('text', isText);
  };

  document.addEventListener('mousemove', move);

  // lerp 缓动跟随（每帧写入，代价仅一次 transform 更新）
  let raf = 0;
  const loop = () => {
    if (!Number.isNaN(x)) {
      x += (lastX - x) * 0.2;
      y += (lastY - y) * 0.2;
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // 页面即将切换：清理本实例的监听与循环（astro:before-swap 在交换前触发）
  const cleanup = () => {
    document.removeEventListener('mousemove', move);
    cancelAnimationFrame(raf);
    document.removeEventListener('astro:before-swap', cleanup);
  };
  document.addEventListener('astro:before-swap', cleanup);
}

function boot(): void {
  initCursor();
  document.body.classList.add('has-cursor');
}

document.addEventListener('astro:page-load', boot);
