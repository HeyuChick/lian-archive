/**
 * CustomCursor —— 自定义光标
 * 默认：小圆点，跟随鼠标（lerp 缓动）
 * 悬停可交互元素（a / button / [data-cursor]）：圆点放大半透明
 * 悬停文本元素（p / h1-h6 / span / li / time / blockquote）：变为竖线
 * 触摸设备 / prefers-reduced-motion 不激活（has-cursor 不加，系统光标恢复）
 *
 * 跨页面位置保持（v2）：
 * 站点页面切换为整页刷新，window 会被重置，因此坐标双写——
 *   window.__cursorPos ：客户端路由切换（若启用）时保留
 *   sessionStorage     ：整页刷新后新页面仍可读取
 * mousedown 时强制落盘，保证点击链接导航前的精确位置不丢失；
 * bfcache 恢复（浏览器前进/后退）时作废旧坐标，下次移动直接吸附。
 */

const INTERACTIVE_SELECTOR = 'a, button, [data-cursor="hover"]';
const TEXT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, span, li, time, blockquote, td, th, figcaption';
const STORAGE_KEY = 'lian:cursor-pos';

interface CursorPos { x: number; y: number }

declare global {
  interface Window { __cursorPos?: CursorPos }
}

function readSessionPos(): CursorPos | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CursorPos>;
    if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  } catch { /* sessionStorage 不可用等情况 */ }
  return null;
}

let lastStore = 0;
function storePos(x: number, y: number, force = false): void {
  window.__cursorPos = { x, y };
  const now = performance.now();
  if (!force && now - lastStore < 50) return; // sessionStorage 写入节流
  lastStore = now;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })); } catch { /* ignore */ }
}

let activeCleanup: (() => void) | null = null;

function initCursor(): void {
  // 触摸设备 / 减弱动画：不激活（has-cursor 不加，系统光标保留）
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 重复初始化前先清理旧实例的监听与动画循环
  activeCleanup?.();
  document.querySelectorAll('.cursor-dot').forEach((el) => el.remove());

  const cursor = document.createElement('div');
  cursor.className = 'cursor-dot';
  document.body.appendChild(cursor);

  // 优先内存（客户端路由切换），其次 sessionStorage（整页刷新）
  const stored = window.__cursorPos ?? readSessionPos();
  let x = stored ? stored.x : NaN;
  let y = stored ? stored.y : NaN;
  let lastX = stored ? stored.x : 0;
  let lastY = stored ? stored.y : 0;

  // 初始即有坐标：直接定位并显示，光标不再从左上角出现
  if (stored) {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.classList.add('visible');
  }

  const move = (e: MouseEvent) => {
    storePos(e.clientX, e.clientY);
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

  // 点击链接触发导航前，强制记录精确点击位置
  const press = (e: MouseEvent) => storePos(e.clientX, e.clientY, true);

  document.addEventListener('mousemove', move);
  document.addEventListener('mousedown', press);

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

  // bfcache 恢复（浏览器前进/后退）：旧坐标已失效，下次移动直接吸附
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) {
      x = NaN;
      y = NaN;
    }
  };
  window.addEventListener('pageshow', onPageShow);

  const cleanup = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mousedown', press);
    window.removeEventListener('pageshow', onPageShow);
    cancelAnimationFrame(raf);
    document.removeEventListener('astro:before-swap', cleanup);
  };
  activeCleanup = cleanup;

  // 客户端路由（若启用）：交换前清理本实例
  document.addEventListener('astro:before-swap', cleanup);
}

function boot(): void {
  initCursor();
  document.body.classList.add('has-cursor');
}

// 双启动：整页加载（DOMContentLoaded）与客户端路由（astro:page-load）都覆盖
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
document.addEventListener('astro:page-load', boot);
