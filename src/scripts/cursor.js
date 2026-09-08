class LianCursor extends HTMLElement {
  constructor() {
    super();
    this.frame = 0;
    this.x = this.y = NaN;
    this.tx = this.ty = 0;
    this.lastTime = 0;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.pointer = matchMedia('(any-pointer: fine)');
    this.follow = this.follow.bind(this);
    this.sync = this.sync.bind(this);
  }
  connectedCallback() {
    this.events = new AbortController();
    const signal = this.events.signal;
    this.factor = Number(this.getAttribute('follow') || 0.2);
    document.addEventListener('pointermove', e => {
      if (!this.enabled || e.pointerType === 'touch') return;
      this.tx = e.clientX;
      this.ty = e.clientY;
      if (Number.isNaN(this.x)) { this.x = this.tx; this.y = this.ty; }
      this.classList.add('visible');
      this.start();
    }, { passive: true, signal });
    document.addEventListener('pointerover', e => {
      if (!(e.target instanceof Element)) return;
      const forbidden = !!e.target.closest('.is-sealed');
      const interactive = !forbidden && !!e.target.closest('a, button, [data-cursor="hover"], .link-card');
      const text = this.hasAttribute('text') && !forbidden && !interactive && !!e.target.closest('p, h1, h2, h3, h4, h5, h6, span, li, time, blockquote, td, th, figcaption');
      this.classList.toggle('forbidden', forbidden);
      this.classList.toggle('hovering', interactive);
      this.classList.toggle('text', text);
    }, { signal });
    const hide = () => {
      this.classList.remove('visible');
      this.x = this.y = NaN;
      this.stop();
    };
    document.addEventListener('pointerleave', hide, { signal });
    window.addEventListener('blur', hide, { signal });
    document.addEventListener('visibilitychange', this.sync, { signal });
    document.addEventListener('astro:after-swap', this.sync, { signal });
    this.motion.addEventListener('change', this.sync, { signal });
    this.pointer.addEventListener('change', this.sync, { signal });
    this.sync();
  }
  disconnectedCallback() {
    this.events.abort();
    this.stop();
    document.documentElement.classList.remove('has-cursor');
  }
  sync() {
    this.enabled = this.pointer.matches && !this.motion.matches;
    document.documentElement.classList.toggle('has-cursor', this.enabled);
    if (!this.enabled || document.hidden) {
      this.classList.remove('visible');
      this.x = this.y = NaN;
      this.stop();
    } else if (this.classList.contains('visible')) {
      this.start();
    }
  }
  start() {
    if (!this.frame && !document.hidden) this.frame = requestAnimationFrame(this.follow);
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
  }
  follow(now) {
    this.frame = 0;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) * 0.06 : 1;
    this.lastTime = now;
    const factor = 1 - Math.pow(1 - this.factor, dt);
    this.x += (this.tx - this.x) * factor;
    this.y += (this.ty - this.y) * factor;
    const moving = Math.abs(this.tx - this.x) + Math.abs(this.ty - this.y) > 0.01;
    if (!moving) { this.x = this.tx; this.y = this.ty; this.lastTime = 0; }
    this.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    if (moving) this.start();
  }
}

customElements.define('lian-cursor', LianCursor);
