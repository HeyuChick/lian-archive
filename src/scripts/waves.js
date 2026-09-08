class Noise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256);
    let s = Math.floor(seed * 256) || 1;
    for (let i = 0; i < 256; i++) {
      s = (s * 16807) % 2147483647;
      this.p[i] = s % 256;
    }
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }
  grad(h, x, y) {
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }
  perlin2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this.fade(x), v = this.fade(y);
    const A = this.p[X] + Y, B = this.p[X + 1 & 255] + Y;
    return this.lerp(
      this.lerp(this.grad(this.p[A] & 7, x, y),
                this.grad(this.p[B] & 7, x - 1, y), u),
      this.lerp(this.grad(this.p[A + 1 & 255] & 7, x, y - 1),
                this.grad(this.p[B + 1 & 255] & 7, x - 1, y - 1), u),
      v) * 0.5;
  }
}

class WaveGL {
  constructor(gl) {
    this.gl = gl;
    const vertex = `#version 300 es
      in vec2 aPrevious;
      in vec2 aStart;
      in vec2 aEnd;
      in vec2 aNext;
      uniform vec2 uSize;
      uniform float uDpr;
      uniform int uPitch;
      out float vEdge;
      vec2 direction(vec2 d, vec2 fallback) {
        float l = length(d);
        return l > 0.0001 ? d / l : fallback;
      }
      vec2 normal(vec2 d) { return vec2(-d.y, d.x); }
      void main() {
        if (gl_InstanceID % uPitch >= uPitch - 3) {
          gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
          vEdge = 0.0;
          return;
        }
        vec2 d = direction(aEnd - aStart, vec2(0.0, 1.0));
        vec2 n = normal(d);
        bool end = (gl_VertexID & 1) == 1;
        vec2 adjacent = end ? direction(aNext - aEnd, d) : direction(aStart - aPrevious, d);
        vec2 miter = direction(n + normal(adjacent), n);
        miter /= max(dot(miter, n), 0.25);
        vEdge = (gl_VertexID < 2 ? -1.0 : 1.0) * (0.5 + 0.5 / uDpr);
        vec2 p = (end ? aEnd : aStart) + miter * vEdge;
        gl_Position = vec4(p / uSize * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
      }`;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec3 uColor;
      uniform float uDpr;
      in float vEdge;
      out vec4 color;
      void main() {
        float a = clamp((0.5 + 0.5 / uDpr - abs(vEdge)) * uDpr, 0.0, 1.0);
        color = vec4(uColor * a, a);
      }`;
    this.program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        this.dispose();
        throw new Error(message);
      }
      gl.attachShader(this.program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(this.program);
      this.dispose();
      throw new Error(message);
    }
    gl.useProgram(this.program);
    this.size = gl.getUniformLocation(this.program, 'uSize');
    this.dpr = gl.getUniformLocation(this.program, 'uDpr');
    this.pitch = gl.getUniformLocation(this.program, 'uPitch');
    this.color = gl.getUniformLocation(this.program, 'uColor');
    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    ['aPrevious', 'aStart', 'aEnd', 'aNext'].forEach((name, i) => {
      const location = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 8, i * 8);
      gl.vertexAttribDivisor(location, 1);
    });
    gl.enable(gl.BLEND);
    // 同一层线条取覆盖率并集，交点与连接处保持相同亮度。
    gl.blendEquation(gl.MAX);
  }
  resize(width, height, dpr, positions, pitch) {
    const gl = this.gl;
    gl.canvas.width = Math.round(width * dpr);
    gl.canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(this.size, width, height);
    gl.uniform1f(this.dpr, dpr);
    gl.uniform1i(this.pitch, pitch);
    gl.bufferData(gl.ARRAY_BUFFER, positions.byteLength, gl.DYNAMIC_DRAW);
  }
  draw(positions, color) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(this.color, color);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, positions.length / 2 - 3);
  }
  dispose() {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao ?? null);
    gl.deleteBuffer(this.buffer ?? null);
    gl.deleteProgram(this.program);
  }
}

class WaveCanvas {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
  }
  resize(width, height, dpr, positions, pitch) {
    const ctx = this.ctx;
    ctx.canvas.width = Math.round(width * dpr);
    ctx.canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
    this.pitch = pitch;
  }
  draw(positions, color) {
    const ctx = this.ctx, stride = this.pitch * 2;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.strokeStyle = `rgb(${color[0] * 255} ${color[1] * 255} ${color[2] * 255})`;
    ctx.beginPath();
    for (let line = 0; line < positions.length; line += stride) {
      ctx.moveTo(positions[line + 2], positions[line + 3]);
      for (let i = line + 4; i < line + stride - 2; i += 2) ctx.lineTo(positions[i], positions[i + 1]);
    }
    ctx.stroke();
  }
  dispose() {}
}

class AWaves extends HTMLElement {
  constructor() {
    super();
    this.noise = new Noise();
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, lx: 0, ly: 0, vs: 0, dx: 0, dy: 0, set: false };
    this.frame = 0;
    this.time = 0;
    this.lastTime = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.tick = this.tick.bind(this);
    this.sync = this.sync.bind(this);
    this.resizeNeeded = true;
    this.colorNeeded = true;
    this.color = new Float32Array([1, 1, 1]);
    this.colorFrom = this.color.slice();
    this.colorTo = this.color.slice();
  }
  connectedCallback() {
    this.events = new AbortController();
    const signal = this.events.signal;
    window.addEventListener('pointermove', e => {
      const mouse = this.mouse;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!mouse.set) {
        mouse.sx = mouse.lx = mouse.x;
        mouse.sy = mouse.ly = mouse.y;
        mouse.set = true;
      }
    }, { passive: true, signal });
    document.addEventListener('pointerleave', () => {
      this.mouse.set = false;
      this.mouse.vs = 0;
    }, { signal });
    window.addEventListener('resize', () => { this.resizeNeeded = true; }, { passive: true, signal });
    document.addEventListener('visibilitychange', this.sync, { signal });
    this.reduced.addEventListener('change', this.sync, { signal });
    this.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.lost = true;
      this.sync();
    }, { capture: true, signal });
    this.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.renderer = null;
      this.resizeNeeded = true;
      this.sync();
    }, { capture: true, signal });
    this.resizeObserver = new ResizeObserver(() => { this.resizeNeeded = true; });
    this.resizeObserver.observe(this);
    this.colorObserver = new MutationObserver(() => { this.colorNeeded = true; });
    this.colorObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    this.colorNeeded = true;
    this.resizeNeeded = true;
    this.sync();
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
    this.events.abort();
    this.resizeObserver.disconnect();
    this.colorObserver.disconnect();
    // Astro 在同一次页面交换中重新挂载持久化元素。
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.renderer?.dispose();
        this.renderer = null;
      }
    });
  }
  sync() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
    if (this.isConnected && !document.hidden && !this.reduced.matches && !this.lost) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }
  initRenderer() {
    this.canvas = this.querySelector('canvas');
    const gl = this.canvas.getContext('webgl2', { antialias: false, depth: false });
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const software = info && /SwiftShader|llvmpipe|softpipe|Software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    // 软件 OpenGL 会再次栅格化整个画布，原生 Canvas 路径更适合这种设备。
    if (gl && !software) {
      try {
        this.renderer = new WaveGL(gl);
      } catch (error) {
        console.warn(error);
      }
    }
    if (!this.renderer) {
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      const canvas = this.canvas.cloneNode(false);
      this.canvas.replaceWith(canvas);
      this.canvas = canvas;
      this.renderer = new WaveCanvas(canvas);
    }
  }
  setSize() {
    const { width, height, left, top } = this.getBoundingClientRect();
    const dpr = devicePixelRatio;
    const columns = Math.ceil((width + 200) / 14) + 1;
    const rows = Math.ceil((height + 30) / 36) + 1;
    const pitch = rows + 2;
    if (this.width !== width || this.height !== height || !this.points) {
      this.points = new Float32Array(columns * rows * 6);
      this.positions = new Float32Array(columns * pitch * 2);
      const xStart = (width - 14 * (columns - 1)) / 2;
      const yStart = (height - 36 * (rows - 1)) / 2;
      for (let x = 0; x < columns; x++) {
        for (let y = 0; y < rows; y++) {
          const p = (x * rows + y) * 6;
          this.points[p] = xStart + x * 14;
          this.points[p + 1] = yStart + y * 36;
        }
      }
    }
    Object.assign(this, { width, height, left, top, dpr, rows, columns, pitch });
    this.renderer.resize(width, height, dpr, this.positions, pitch);
    this.resizeNeeded = false;
  }
  pulse(cx, cy, strength = 1.6, radius = 220) {
    if (!this.points || this.reduced.matches) return;
    const points = this.points;
    const x = cx - this.left, y = cy - this.top;
    for (let i = 0; i < points.length; i += 6) {
      const dx = points[i] - x, dy = points[i + 1] - y;
      const d = Math.hypot(dx, dy);
      if (d < radius && d > 0.001) {
        const f = (1 - d / radius) * strength / d;
        points[i + 4] += dx * f;
        points[i + 5] += dy * f;
      }
    }
  }
  movePoints(dt) {
    const mouse = this.mouse, points = this.points;
    const mx = mouse.sx - this.left, my = mouse.sy - this.top;
    const forceX = mouse.dx * mouse.vs * 0.11375;
    const forceY = mouse.dy * mouse.vs * 0.11375;
    const steps = Math.ceil(dt), step = dt / steps;
    const friction = Math.pow(0.925, step);
    for (let i = 0; i < points.length; i += 6) {
      let x = points[i + 2], y = points[i + 3], vx = points[i + 4], vy = points[i + 5];
      const dx = points[i] - mx, dy = points[i + 1] - my;
      const distance = dx * dx + dy * dy;
      let force = 0;
      if (mouse.set && distance < 30625) {
        const d = Math.sqrt(distance);
        force = Math.cos(d * 0.001) * (1 - d / 175);
      }
      for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
        vx = (vx + (forceX * force - x * 0.005) * step) * friction;
        vy = (vy + (forceY * force - y * 0.005) * step) * friction;
        x += vx * 2 * step;
        y += vy * 2 * step;
        if (Math.abs(x) > 100) { x = Math.sign(x) * 100; if (vx * x > 0) vx = 0; }
        if (Math.abs(y) > 100) { y = Math.sign(y) * 100; if (vy * y > 0) vy = 0; }
      }
      points[i + 2] = x; points[i + 3] = y;
      points[i + 4] = vx; points[i + 5] = vy;
    }
  }
  drawPositions() {
    const points = this.points, positions = this.positions;
    const tx = this.time * 0.0125, ty = this.time * 0.005;
    for (let column = 0; column < this.columns; column++) {
      const start = column * this.pitch * 2;
      for (let row = 0; row < this.rows; row++) {
        const p = (column * this.rows + row) * 6;
        const move = this.noise.perlin2((points[p] + tx) * 0.002, (points[p + 1] + ty) * 0.0015) * 12;
        const free = row > 0 && row < this.rows - 1;
        const out = start + (row + 1) * 2;
        positions[out] = points[p] + Math.cos(move) * 32 + (free ? points[p + 2] : 0);
        positions[out + 1] = points[p + 1] + Math.sin(move) * 16 + (free ? points[p + 3] : 0);
      }
      positions[start] = positions[start + 2];
      positions[start + 1] = positions[start + 3];
      const end = start + (this.pitch - 1) * 2;
      positions[end] = positions[end - 2];
      positions[end + 1] = positions[end - 1];
    }
  }
  updateColor() {
    if (this.colorNeeded) {
      const rgb = getComputedStyle(this.canvas).color.match(/[\d.]+/g).slice(0, 3).map(n => Number(n) / 255);
      this.colorFrom.set(this.color);
      this.colorTo.set(rgb);
      this.colorStart = this.time;
      if (!this.colored) { this.color.set(rgb); this.colorFrom.set(rgb); this.colored = true; }
      this.colorNeeded = false;
    }
    const t = Math.min(1, (this.time - this.colorStart) / 800);
    // CSS ease 的三次贝塞尔曲线，与页面其余情绪色过渡同步。
    let x = t;
    for (let i = 0; i < 5; i++) x -= ((1.75 * x - 0.75) * x * x + 0.75 * x - t) / ((5.25 * x - 1.5) * x + 0.75);
    const eased = ((-1.7 * x + 2.4) * x + 0.3) * x;
    for (let i = 0; i < 3; i++) this.color[i] = this.colorFrom[i] + (this.colorTo[i] - this.colorFrom[i]) * eased;
  }
  tick(now) {
    this.frame = 0;
    if (!this.renderer) { this.initRenderer(); this.resizeNeeded = true; }
    if (this.resizeNeeded || this.dpr !== devicePixelRatio) this.setSize();
    const elapsed = this.lastTime ? Math.min(50, now - this.lastTime) : 1000 / 60;
    this.lastTime = now;
    this.time += elapsed;
    this.updateColor();
    const dt = elapsed * 0.06;
    const mouse = this.mouse;
    const smooth = 1 - Math.pow(0.9, dt);
    mouse.sx += (mouse.x - mouse.sx) * smooth;
    mouse.sy += (mouse.y - mouse.sy) * smooth;
    const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly;
    const distance = Math.hypot(dx, dy);
    mouse.vs += (distance / dt - mouse.vs) * smooth;
    mouse.vs = Math.min(100, mouse.vs);
    if (distance > 0) { mouse.dx = dx / distance; mouse.dy = dy / distance; }
    mouse.lx = mouse.x; mouse.ly = mouse.y;
    this.movePoints(dt);
    this.drawPositions();
    this.renderer.draw(this.positions, this.color);
    this.frame = requestAnimationFrame(this.tick);
  }
}

customElements.define('a-waves', AWaves);
