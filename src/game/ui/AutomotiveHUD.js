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
          -webkit-user-select: none;
          z-index: 100;
        }

        .hud-top-bar {
          position: absolute;
          top: max(16px, env(safe-area-inset-top, 16px));
          left: max(16px, env(safe-area-inset-left, 16px));
          right: max(16px, env(safe-area-inset-right, 16px));
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .hud-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hud-badge {
          background: rgba(15, 23, 42, 0.78);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          pointer-events: auto;
        }

        .hud-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #f8fafc;
        }

        .hud-money {
          font-size: 12px;
          font-weight: 700;
          color: #4ade80;
        }

        .hud-action-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .hud-action-btn:hover, .hud-action-btn:active {
          background: rgba(56, 189, 248, 0.25);
          border-color: #38bdf8;
        }

        /* Desktop Controls Pill (Hidden on mobile or compact viewports) */
        .hud-controls-pill {
          position: absolute;
          bottom: 28px;
          left: 28px;
          background: rgba(15, 23, 42, 0.78);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px 18px;
          color: #cbd5e1;
          font-size: 11px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .hud-controls-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 6px;
        }

        .hud-controls-keys {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hud-key-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .hud-key {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 2px 6px;
          font-weight: 700;
          font-size: 10px;
          color: #f1f5f9;
        }

        /* Cluster Instrument HUD (Responsive bottom center/right) */
        .hud-cluster {
          position: absolute;
          bottom: max(20px, env(safe-area-inset-bottom, 20px));
          right: max(20px, env(safe-area-inset-right, 20px));
          background: rgba(15, 23, 42, 0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          padding: 14px 18px;
          min-width: 190px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
        }

        .cluster-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 2px;
        }

        .speed-number {
          font-size: 38px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -1px;
          color: #ffffff;
          font-feature-settings: "tnum";
          font-variant-numeric: tabular-nums;
        }

        .speed-unit {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .gear-badge {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #60a5fa;
          font-size: 16px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 6px;
        }

        .rpm-bar-container {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 8px;
        }

        .rpm-bar-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #38bdf8 0%, #3b82f6 60%, #ef4444 95%);
          transition: width 0.08s ease-out;
        }

        .fuel-bar-container {
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
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
          margin: 8px 0;
        }

        .cluster-stats {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 500;
        }

        .brake-indicator {
          display: inline-block;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 4px;
          color: #64748b;
          border: 1px solid #334155;
        }

        .brake-indicator.active {
          color: #ef4444;
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.2);
        }

        /* Mobile Responsive Adaptations */
        @media (max-width: 900px) {
          .hud-controls-pill {
            display: none !important;
          }
          .hud-cluster {
            /* Positioned in bottom center between left steering and right pedals on mobile */
            bottom: max(14px, env(safe-area-inset-bottom, 14px));
            right: 50%;
            transform: translateX(50%);
            padding: 8px 14px;
            min-width: 150px;
            border-radius: 12px;
          }
          .speed-number {
            font-size: 28px;
          }
          .gear-badge {
            font-size: 13px;
            padding: 2px 7px;
          }
          .cluster-stats {
            display: none;
          }
        }
      </style>

      <div class="hud-top-bar">
        <div class="hud-brand">
          <div class="hud-badge">
            <span class="hud-title">Urban Motor</span>
            <span id="hud-money" class="hud-money">$25,000</span>
          </div>
          <div class="hud-badge">
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openGarage()">Garage</button>
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openDealership()">Dealer</button>
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openInputSettings()">Controls</button>
            <button class="hud-action-btn" onclick="window.__UML_MODALS__.openSettings()">Graphics</button>
          </div>
        </div>
        <div class="hud-badge" id="hud-diag-badge">
          <span style="font-size: 10px; color:#94a3b8;">F3 Diag</span>
        </div>
      </div>

      <!-- Desktop Driving Legend -->
      <div class="hud-controls-pill">
        <div class="hud-controls-title">Drive Controls</div>
        <div class="hud-controls-keys">
          <div class="hud-key-item"><span class="hud-key">W</span> Gas</div>
          <div class="hud-key-item"><span class="hud-key">S</span> Brake</div>
          <div class="hud-key-item"><span class="hud-key">A / D</span> Steer</div>
          <div class="hud-key-item"><span class="hud-key">Space</span> Drift</div>
          <div class="hud-key-item"><span class="hud-key">E</span> Action</div>
          <div class="hud-key-item"><span class="hud-key">C</span> Cam</div>
        </div>
      </div>

      <!-- Instrument Cluster -->
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

        <div style="margin-top: 6px;">
          <div style="display:flex; justify-content:space-between; font-size:9px; color:#94a3b8;">
            <span>FUEL</span>
            <span id="hud-fuel-text">48.0 L</span>
          </div>
          <div class="fuel-bar-container">
            <div id="hud-fuel-fill" class="fuel-bar-fill"></div>
          </div>
        </div>

        <div class="cluster-divider"></div>

        <div class="cluster-stats">
          <span>RPM: <b id="hud-rpm" style="color:#f1f5f9">900</b></span>
          <span id="hud-brake" class="brake-indicator">EBRAKE</span>
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
