export class PerformanceMonitor {
  constructor(renderer) {
    this.renderer = renderer;
    this.visible = false;

    // Metrics tracking
    this.fps = 60;
    this.avgFps = 60;
    this.frameTime = 16.6;
    this.fpsHistory = [];
    this.historyLimit = 60;
    this.lastTime = performance.now();
    this.frames = 0;
    this.lastFpsUpdate = performance.now();

    // Graphic quality label
    this.currentQuality = 'HIGH';

    // Build DOM
    this.createPanel();

    // Toggle on F3
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'perf-diagnostic-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `
      <style>
        #perf-diagnostic-panel {
          position: fixed;
          top: 16px;
          left: 16px;
          background: rgba(10, 15, 29, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(56, 189, 248, 0.4);
          border-radius: 10px;
          padding: 14px 18px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          line-height: 1.6;
          color: #e2e8f0;
          z-index: 9999;
          min-width: 260px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          pointer-events: auto;
          user-select: none;
        }
        .perf-title {
          font-weight: 700;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 4px;
        }
        .perf-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .perf-label {
          color: #94a3b8;
        }
        .perf-val {
          font-weight: 600;
          color: #ffffff;
        }
        .perf-val.good { color: #4ade80; }
        .perf-val.warn { color: #facc15; }
        .perf-val.alert { color: #f87171; }
        .perf-footer {
          margin-top: 8px;
          font-size: 10px;
          color: #64748b;
          text-align: right;
        }
      </style>
      <div class="perf-title">
        <span>System Diagnostics</span>
        <span style="font-size: 9px; background: rgba(56,189,248,0.2); padding: 2px 6px; border-radius: 4px;">F3 TOGGLE</span>
      </div>
      <div class="perf-row"><span class="perf-label">Current FPS:</span><span id="dp-fps" class="perf-val good">60</span></div>
      <div class="perf-row"><span class="perf-label">Average FPS:</span><span id="dp-avg-fps" class="perf-val good">60</span></div>
      <div class="perf-row"><span class="perf-label">Frame Time:</span><span id="dp-frametime" class="perf-val">16.6 ms</span></div>
      <div class="perf-row"><span class="perf-label">Draw Calls:</span><span id="dp-calls" class="perf-val">0</span></div>
      <div class="perf-row"><span class="perf-label">Triangles:</span><span id="dp-triangles" class="perf-val">0</span></div>
      <div class="perf-row"><span class="perf-label">Geometries:</span><span id="dp-geometries" class="perf-val">0</span></div>
      <div class="perf-row"><span class="perf-label">Textures:</span><span id="dp-textures" class="perf-val">0</span></div>
      <div class="perf-row"><span class="perf-label">Pixel Ratio:</span><span id="dp-dpr" class="perf-val">1.0</span></div>
      <div class="perf-row"><span class="perf-label">Graphics Quality:</span><span id="dp-quality" class="perf-val good">HIGH</span></div>
      <div class="perf-footer">URBAN MOTOR LIFE • DIAGNOSTICS</div>
    `;
    document.body.appendChild(this.panel);

    this.elFps = this.panel.querySelector('#dp-fps');
    this.elAvgFps = this.panel.querySelector('#dp-avg-fps');
    this.elFrameTime = this.panel.querySelector('#dp-frametime');
    this.elCalls = this.panel.querySelector('#dp-calls');
    this.elTriangles = this.panel.querySelector('#dp-triangles');
    this.elGeometries = this.panel.querySelector('#dp-geometries');
    this.elTextures = this.panel.querySelector('#dp-textures');
    this.elDpr = this.panel.querySelector('#dp-dpr');
    this.elQuality = this.panel.querySelector('#dp-quality');
  }

  onKeyDown(e) {
    if (e.key === 'F3') {
      e.preventDefault();
      this.toggle();
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? 'block' : 'none';
  }

  setQualityLabel(presetName) {
    this.currentQuality = presetName;
  }

  begin() {
    this.startTime = performance.now();
  }

  end() {
    const now = performance.now();
    this.frameTime = Number((now - this.startTime).toFixed(1));
    this.frames++;

    if (now - this.lastFpsUpdate >= 300) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsUpdate));
      this.frames = 0;
      this.lastFpsUpdate = now;

      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.historyLimit) {
        this.fpsHistory.shift();
      }
      const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
      this.avgFps = Math.round(sum / this.fpsHistory.length);

      // Only update DOM strings when panel is visible to avoid layout thrashing
      if (this.visible && this.renderer) {
        const info = this.renderer.info;

        this.elFps.textContent = `${this.fps}`;
        this.elFps.className = `perf-val ${this.fps >= 50 ? 'good' : this.fps >= 30 ? 'warn' : 'alert'}`;

        this.elAvgFps.textContent = `${this.avgFps}`;
        this.elAvgFps.className = `perf-val ${this.avgFps >= 50 ? 'good' : this.avgFps >= 30 ? 'warn' : 'alert'}`;

        this.elFrameTime.textContent = `${this.frameTime} ms`;
        this.elCalls.textContent = `${info.render.calls}`;
        this.elTriangles.textContent = `${info.render.triangles.toLocaleString()}`;
        this.elGeometries.textContent = `${info.memory.geometries}`;
        this.elTextures.textContent = `${info.memory.textures}`;
        this.elDpr.textContent = `${this.renderer.getPixelRatio().toFixed(2)}`;
        this.elQuality.textContent = this.currentQuality;
      }
    }
  }

  getMetrics() {
    const info = this.renderer?.info || { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
    return {
      fps: this.fps,
      avgFps: this.avgFps,
      frameTime: this.frameTime,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      pixelRatio: this.renderer ? this.renderer.getPixelRatio() : 1.0,
      quality: this.currentQuality
    };
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}
