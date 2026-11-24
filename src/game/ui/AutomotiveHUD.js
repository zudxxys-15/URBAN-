export class AutomotiveHUD {
  constructor(engine) {
    this.engine = engine;
    this.container = document.createElement('div');
    this.container.id = 'automotive-hud';
    this.buildHUD();
    document.body.appendChild(this.container);
  }

  buildHUD() {
    this.container.innerHTML = `
      <style>
        #automotive-hud {
          position: fixed;
          inset: 0;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          z-index: 100;
        }

        .hud-top-bar {
          position: absolute;
          top: 24px;
          left: 28px;
          right: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hud-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hud-badge {
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          pointer-events: auto;
        }

        .hud-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #f8fafc;
        }

        .hud-money {
          font-size: 13px;
          font-weight: 700;
          color: #4ade80;
        }

        .hud-action-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .hud-action-btn:hover {
          background: rgba(56, 189, 248, 0.25);
          border-color: #38bdf8;
        }

        .hud-controls-pill {
          position: absolute;
          bottom: 28px;
          left: 28px;
          background: rgba(15, 23, 42, 0.78);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px 20px;
          color: #cbd5e1;
          font-size: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .hud-controls-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .hud-controls-keys {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .hud-key-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hud-key {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 3px 7px;
          font-weight: 700;
          font-size: 11px;
          color: #f1f5f9;
        }

        .hud-cluster {
          position: absolute;
          bottom: 28px;
          right: 28px;
          background: rgba(15, 23, 42, 0.82);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 20px 24px;
          min-width: 230px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
        }

        .cluster-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }

        .speed-number {
          font-size: 46px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -1.5px;
          color: #ffffff;
          font-feature-settings: "tnum";
          font-variant-numeric: tabular-nums;
        }

        .speed-unit {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .gear-badge {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #60a5fa;
          font-size: 18px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 6px;
        }

        .rpm-bar-container {
          width: 100%;
          height: 5px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 10px;
        }

        .rpm-bar-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #38bdf8 0%, #3b82f6 60%, #ef4444 95%);
          transition: width 0.08s ease-out;
        }

        .fuel-bar-container {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 6px;
        }

        .fuel-bar-fill {
          height: 100%;
          width: 80%;
          background: #22c55e;
          transition: width 0.2s ease-out;
        }

        .cluster-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 10px 0;
        }

        .cluster-stats {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        .brake-indicator {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          color: #64748b;
          border: 1px solid #334155;
        }

        .brake-indicator.active {
          color: #ef4444;
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.2);
        }
      </style>

      <div class="hud-top-bar">
        <div class="hud-brand">
          <div class="hud-badge">
            <span class="hud-title">Urban Motor Life</span>
            <span id="hud-money" class="hud-money">$25,000</span>
          </div>
          <div class="hud-badge">
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openGarage()">Garage</button>
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openDealership()">Dealership</button>
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openSettings()">Graphics</button>
          </div>
        </div>
        <div class="hud-badge">
          <span style="font-size: 11px; color:#94a3b8;">F3 Diagnostics</span>
        </div>
      </div>

      <div class="hud-controls-pill">
        <div class="hud-controls-title">Drive Controls</div>
        <div class="hud-controls-keys">
          <div class="hud-key-item"><span class="hud-key">W</span> Accelerate</div>
          <div class="hud-key-item"><span class="hud-key">S</span> Brake / Reverse</div>
          <div class="hud-key-item"><span class="hud-key">A / D</span> Steer</div>
          <div class="hud-key-item"><span class="hud-key">Space</span> Handbrake</div>
          <div class="hud-key-item"><span class="hud-key">E</span> Interact Zone</div>
        </div>
      </div>

      <div class="hud-cluster">
        <div class="cluster-top">
          <div>
            <span id="hud-speed" class="speed-number">0</span>
            <span class="speed-unit">km/h</span>
          </div>
          <div id="hud-gear" class="gear-badge">N</div>
        </div>

        <div class="rpm-bar-container">
          <div id="hud-rpm-fill" class="rpm-bar-fill"></div>
        </div>

        <div style="margin-top: 8px;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
            <span>FUEL LEVEL</span>
            <span id="hud-fuel-text">48.0 L</span>
          </div>
          <div class="fuel-bar-container">
            <div id="hud-fuel-fill" class="fuel-bar-fill"></div>
          </div>
        </div>

        <div class="cluster-divider"></div>

        <div class="cluster-stats">
          <span>RPM: <b id="hud-rpm" style="color:#f1f5f9">900</b></span>
          <span id="hud-brake" class="brake-indicator">PARK / EBRAKE</span>
        </div>
      </div>
    `;

    this.speedEl = this.container.querySelector('#hud-speed');
    this.gearEl = this.container.querySelector('#hud-gear');
    this.rpmEl = this.container.querySelector('#hud-rpm');
    this.rpmFillEl = this.container.querySelector('#hud-rpm-fill');
    this.fuelTextEl = this.container.querySelector('#hud-fuel-text');
    this.fuelFillEl = this.container.querySelector('#hud-fuel-fill');
    this.brakeEl = this.container.querySelector('#hud-brake');
    this.moneyEl = this.container.querySelector('#hud-money');
  }

  update(physics, input, vehicleData, money) {
    const kmh = physics.getKmh();
    const gear = physics.getGear();
    const rpm = physics.getRpm();

    this.speedEl.textContent = kmh;
    this.gearEl.textContent = gear;
    this.rpmEl.textContent = rpm;

    const rpmPercent = Math.min(100, Math.max(0, (rpm / 7200) * 100));
    this.rpmFillEl.style.width = `${rpmPercent}%`;

    if (vehicleData) {
      const fuelPercent = Math.max(0, Math.min(100, (vehicleData.fuel / (vehicleData.maxFuel || 55)) * 100));
      this.fuelFillEl.style.width = `${fuelPercent}%`;
      this.fuelTextEl.textContent = `${vehicleData.fuel.toFixed(1)} L`;
      if (fuelPercent <= 15) {
        this.fuelFillEl.style.background = '#ef4444';
      } else {
        this.fuelFillEl.style.background = '#22c55e';
      }
    }

    if (money !== undefined) {
      this.moneyEl.textContent = `$${money.toLocaleString()}`;
    }

    if (input.handbrake) {
      this.brakeEl.classList.add('active');
    } else {
      this.brakeEl.classList.remove('active');
    }
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
