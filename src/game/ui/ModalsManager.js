export class ModalsManager {
  constructor(engine) {
    this.engine = engine;
    this.activeModal = null; // 'garage' | 'dealership' | 'customization' | 'settings' | 'gas_station' | 'input_settings' | null

    this.container = document.createElement('div');
    this.container.id = 'uml-modals-root';
    this.container.innerHTML = `
      <style>
        #uml-modals-root {
          position: fixed;
          inset: 0;
          z-index: 500;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }

        .uml-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(11, 15, 25, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease, visibility 0.2s ease;
          padding: 16px;
        }

        .uml-backdrop.active {
          opacity: 1;
          visibility: visible;
        }

        .uml-modal-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          width: 100%;
          max-width: 680px;
          max-height: 85vh;
          overflow-y: auto;
          padding: 24px;
          color: #f8fafc;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
          transform: translateY(16px);
          transition: transform 0.2s ease;
        }

        .uml-backdrop.active .uml-modal-card {
          transform: translateY(0);
        }

        .uml-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 14px;
          margin-bottom: 18px;
        }

        .uml-modal-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .uml-close-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .uml-close-btn:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .uml-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .uml-card-item {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .uml-card-item:hover {
          border-color: #38bdf8;
          background: #27354a;
        }

        .uml-card-item.selected {
          border-color: #38bdf8;
          background: rgba(56, 189, 248, 0.12);
        }

        .uml-btn {
          background: #3b82f6;
          border: none;
          color: white;
          padding: 9px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .uml-btn:hover {
          background: #2563eb;
        }

        .uml-btn.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
        }

        .uml-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .uml-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .uml-action-prompt {
          position: fixed;
          top: max(75px, env(safe-area-inset-top, 75px));
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          display: none;
          align-items: center;
          gap: 8px;
          z-index: 300;
        }

        .uml-prompt-key {
          background: #38bdf8;
          color: #0f172a;
          padding: 2px 7px;
          border-radius: 4px;
          font-weight: 800;
        }
      </style>

      <div id="action-prompt" class="uml-action-prompt">
        <span class="uml-prompt-key" id="prompt-key">E</span>
        <span id="prompt-text">Interact</span>
      </div>

      <div id="modal-backdrop" class="uml-backdrop">
        <div class="uml-modal-card" id="modal-card">
          <!-- Dynamic Modal Content -->
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.backdrop = this.container.querySelector('#modal-backdrop');
    this.card = this.container.querySelector('#modal-card');
    this.actionPrompt = this.container.querySelector('#action-prompt');
    this.promptText = this.container.querySelector('#prompt-text');

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.closeModal();
    });

    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
  }

  showPrompt(text, key = 'E') {
    this.promptText.textContent = text;
    this.actionPrompt.style.display = 'flex';
  }

  hidePrompt() {
    this.actionPrompt.style.display = 'none';
  }

  onKeyDown(e) {
    if (e.key === 'Escape' && this.activeModal) {
      this.closeModal();
    }
  }

  closeModal() {
    this.activeModal = null;
    this.backdrop.classList.remove('active');
    this.engine.input.reset();
  }

  // A. GARAGE MODAL
  openGarage() {
    this.activeModal = 'garage';
    const saveData = this.engine.saveData;

    let vehiclesHtml = saveData.ownedVehicles.map((v) => {
      const isCurrent = v.id === saveData.currentVehicleId;
      return `
        <div class="uml-card-item ${isCurrent ? 'selected' : ''}" data-vid="${v.id}">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${v.name}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">${v.category}</div>
          <div style="display:flex; justify-content:space-between; font-size: 11px; color:#cbd5e1;">
            <span>Fuel: ${v.fuel.toFixed(1)} / ${v.maxFuel} L</span>
            <span>${(v.mileageKm || 0).toFixed(1)} km</span>
          </div>
          <div style="margin-top: 10px; display: flex; gap: 8px;">
            <button class="uml-btn ${isCurrent ? 'secondary' : ''}" style="width: 100%; font-size: 11px; padding: 6px;" onclick="window.__UML_MODALS__.selectVehicle('${v.id}')">
              ${isCurrent ? 'Driving' : 'Drive'}
            </button>
            <button class="uml-btn secondary" style="font-size: 11px; padding: 6px 10px;" onclick="window.__UML_MODALS__.openCustomization('${v.id}')">
              Mod
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Personal Garage</span>
          <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">$${this.engine.economy.getMoney().toLocaleString()}</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>
      <div class="uml-grid">
        ${vehiclesHtml}
      </div>
      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn secondary" onclick="window.__UML_MODALS__.closeModal()">Resume Driving</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  selectVehicle(vehicleId) {
    this.engine.switchVehicle(vehicleId);
    this.openGarage();
  }

  // B. DEALERSHIP MODAL
  openDealership() {
    this.activeModal = 'dealership';
    const playerMoney = this.engine.economy.getMoney();

    const catalog = [
      {
        id: 'coupe_r3',
        name: 'Veloce Spectre Coupe',
        category: 'Sport Coupe',
        price: 18500,
        specs: '136 km/h • 1380kg • RWD',
        color: '#1f2937'
      },
      {
        id: 'roadster_gt',
        name: 'Apex Monza GT Roadster',
        category: 'Supercar',
        price: 42000,
        specs: '165 km/h • 1220kg • AWD',
        color: '#dc2626'
      },
      {
        id: 'urban_cruiser',
        name: 'Metro Strada Hatch',
        category: 'Urban Compact',
        price: 9800,
        specs: '110 km/h • 1050kg • FWD',
        color: '#2563eb'
      }
    ];

    const catalogHtml = catalog.map(c => {
      const isOwned = this.engine.saveData.ownedVehicles.some(v => v.id === c.id);
      const canBuy = playerMoney >= c.price && !isOwned;

      return `
        <div class="uml-card-item">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 4px;">
            <div style="font-weight: 700; font-size: 14px;">${c.name}</div>
            <div style="font-weight: 700; color: #4ade80;">$${c.price.toLocaleString()}</div>
          </div>
          <div style="font-size: 11px; color: #38bdf8; margin-bottom: 6px;">${c.category}</div>
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">${c.specs}</p>
          <button class="uml-btn" style="width: 100%; font-size: 12px;" ${isOwned ? 'disabled' : !canBuy ? 'disabled' : ''} onclick="window.__UML_MODALS__.buyVehicle('${c.id}', ${c.price}, '${c.name}', '${c.category}', '${c.color}')">
            ${isOwned ? 'Owned' : canBuy ? 'Buy Vehicle' : 'Insufficient Funds'}
          </button>
        </div>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Vehicle Dealership</span>
          <span style="font-size: 12px; color: #4ade80; font-weight: 600;">Funds: $${playerMoney.toLocaleString()}</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>
      <div class="uml-grid">
        ${catalogHtml}
      </div>
      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn secondary" onclick="window.__UML_MODALS__.closeModal()">Exit Dealership</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  buyVehicle(id, price, name, category, color) {
    if (this.engine.economy.spend(price, `Bought ${name}`)) {
      this.engine.saveData.ownedVehicles.push({
        id,
        name,
        category,
        color,
        colorName: 'Factory Color',
        rimStyle: 'chrome',
        spoilerType: 'sport',
        engineStage: 1,
        suspensionStage: 1,
        fuel: 55.0,
        maxFuel: 55.0,
        mileageKm: 0.0
      });
      this.engine.saveProgress();
      this.openDealership();
    }
  }

  // C. CUSTOMIZATION MODAL
  openCustomization(vehicleId) {
    this.activeModal = 'customization';
    const vehicle = this.engine.saveData.ownedVehicles.find(v => v.id === vehicleId) || this.engine.currentVehicleData;
    const playerMoney = this.engine.economy.getMoney();

    const colors = [
      { name: 'Obsidian Slate', hex: '#1f2937', price: 450 },
      { name: 'Ferrari Crimson', hex: '#dc2626', price: 650 },
      { name: 'Monaco Blue', hex: '#2563eb', price: 550 },
      { name: 'Sunburst Gold', hex: '#eab308', price: 800 },
      { name: 'Emerald Green', hex: '#059669', price: 550 },
      { name: 'Alabaster White', hex: '#f8fafc', price: 400 }
    ];

    const colorsHtml = colors.map(c => `
      <button style="background: ${c.hex}; width: 34px; height: 34px; border-radius: 50%; border: 2px solid ${vehicle.color === c.hex ? '#38bdf8' : 'rgba(255,255,255,0.2)'}; cursor: pointer;" title="${c.name} ($${c.price})" onclick="window.__UML_MODALS__.applyPaint('${vehicle.id}', '${c.hex}', ${c.price})"></button>
    `).join('');

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Customization: ${vehicle.name}</span>
          <span style="font-size: 12px; color: #4ade80; font-weight: 600;">$${playerMoney.toLocaleString()}</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>

      <div style="margin-bottom: 18px;">
        <h4 style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Body Paint Color</h4>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          ${colorsHtml}
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <h4 style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Wheel Rims ($600)</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="uml-btn ${vehicle.rimStyle === 'chrome' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applyRims('${vehicle.id}', 'chrome', 600)">Chrome Alloy</button>
          <button class="uml-btn ${vehicle.rimStyle === 'matte_black' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applyRims('${vehicle.id}', 'matte_black', 600)">Matte Black</button>
          <button class="uml-btn ${vehicle.rimStyle === 'gold' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applyRims('${vehicle.id}', 'gold', 600)">Gold</button>
        </div>
      </div>

      <div style="margin-bottom: 18px;">
        <h4 style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Aerodynamic Spoilers ($1,200)</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="uml-btn ${vehicle.spoilerType === 'sport' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applySpoiler('${vehicle.id}', 'sport', 1200)">Sport Lip</button>
          <button class="uml-btn ${vehicle.spoilerType === 'gt_wing' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applySpoiler('${vehicle.id}', 'gt_wing', 1200)">Carbon GT Wing</button>
          <button class="uml-btn ${!vehicle.spoilerType ? '' : 'secondary'}" onclick="window.__UML_MODALS__.applySpoiler('${vehicle.id}', '', 0)">Delete</button>
        </div>
      </div>

      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn secondary" onclick="window.__UML_MODALS__.closeModal()">Done Customizing</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  applyPaint(vid, hex, price) {
    const vehicle = this.engine.saveData.ownedVehicles.find(v => v.id === vid);
    if (vehicle.color === hex) return;
    if (this.engine.economy.spend(price, 'Custom Paint')) {
      vehicle.color = hex;
      this.engine.applyCustomizationToActiveCar();
      this.openCustomization(vid);
    }
  }

  applyRims(vid, style, price) {
    const vehicle = this.engine.saveData.ownedVehicles.find(v => v.id === vid);
    if (vehicle.rimStyle === style) return;
    if (this.engine.economy.spend(price, 'Wheel Rims Upgrade')) {
      vehicle.rimStyle = style;
      this.engine.applyCustomizationToActiveCar();
      this.openCustomization(vid);
    }
  }

  applySpoiler(vid, type, price) {
    const vehicle = this.engine.saveData.ownedVehicles.find(v => v.id === vid);
    if (vehicle.spoilerType === type) return;
    if (price === 0 || this.engine.economy.spend(price, 'Spoiler Upgrade')) {
      vehicle.spoilerType = type;
      this.engine.applyCustomizationToActiveCar();
      this.openCustomization(vid);
    }
  }

  // D. GAS STATION MODAL
  openGasStation() {
    this.activeModal = 'gas_station';
    const vehicle = this.engine.currentVehicleData;
    const playerMoney = this.engine.economy.getMoney();
    const neededFuel = (vehicle.maxFuel - vehicle.fuel).toFixed(1);
    const fullCost = Math.round(neededFuel * this.engine.fuelSystem.fuelPricePerLiter);

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Avenue Fuel Station</span>
          <span style="font-size: 12px; color: #4ade80; font-weight: 600;">$${playerMoney.toLocaleString()}</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>

      <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 12px; margin-bottom: 18px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
          <span>Current Tank Level:</span>
          <b>${vehicle.fuel.toFixed(1)} / ${vehicle.maxFuel} L</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
          <span>Fuel Needed:</span>
          <b>${neededFuel} L</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
          <span>Price per Liter:</span>
          <b>$${this.engine.fuelSystem.fuelPricePerLiter.toFixed(2)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; font-size: 15px; color: #38bdf8; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
          <span>Total Cost to Fill:</span>
          <b>$${fullCost}</b>
        </div>
      </div>

      <div style="display:flex; gap: 10px; justify-content: flex-end;">
        <button class="uml-btn secondary" onclick="window.__UML_MODALS__.closeModal()">Cancel</button>
        <button class="uml-btn" onclick="window.__UML_MODALS__.refuelTank()">Refuel Now ($${fullCost})</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  refuelTank() {
    const result = this.engine.fuelSystem.refuel(this.engine.currentVehicleData);
    if (result.success) {
      this.engine.saveProgress();
      this.closeModal();
    } else {
      alert(result.message);
    }
  }

  // E. GRAPHICS SETTINGS MODAL
  openSettings() {
    this.activeModal = 'settings';
    const qm = this.engine.graphicsQuality;

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Graphics Settings</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
          <div>
            <div style="font-weight: 600; font-size: 13px;">Adaptive Performance Scaling</div>
            <div style="font-size: 11px; color: #94a3b8;">Automatically downscales if FPS drops below 32</div>
          </div>
          <input type="checkbox" id="auto-adjust-toggle" ${qm.isAutoAdjust ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;" onchange="window.__UML_MODALS__.toggleAutoAdjust(this.checked)">
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Quality Presets</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="uml-btn ${qm.currentPreset === 'LOW' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.selectPreset('LOW')">LOW (Mobile/Save)</button>
          <button class="uml-btn ${qm.currentPreset === 'MEDIUM' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.selectPreset('MEDIUM')">MEDIUM (Balanced)</button>
          <button class="uml-btn ${qm.currentPreset === 'HIGH' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.selectPreset('HIGH')">HIGH (Full Detail)</button>
        </div>
      </div>

      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn" onclick="window.__UML_MODALS__.closeModal()">Apply & Close</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  toggleAutoAdjust(val) {
    this.engine.graphicsQuality.setAutoAdjust(val);
    this.openSettings();
  }

  selectPreset(preset) {
    this.engine.graphicsQuality.setManualPreset(preset);
    this.openSettings();
  }

  // F. INPUT & MOBILE CONTROLS SETTINGS MODAL
  openInputSettings() {
    this.activeModal = 'input_settings';
    const touch = this.engine.touchControls;
    const prefs = touch.prefs;

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Controls & Mobile Settings</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Touch Controls Visibility</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="uml-btn ${prefs.enabled === 'auto' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('enabled', 'auto')">Auto (Touch Detect)</button>
          <button class="uml-btn ${prefs.enabled === 'always' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('enabled', 'always')">Always On</button>
          <button class="uml-btn ${prefs.enabled === 'never' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('enabled', 'never')">Disabled</button>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Steering Input Mode</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <button class="uml-btn ${prefs.steeringMode === 'buttons' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('steeringMode', 'buttons')">Left / Right Buttons</button>
          <button class="uml-btn ${prefs.steeringMode === 'joystick' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('steeringMode', 'joystick')">Virtual Joystick</button>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Touch Button Size</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="uml-btn ${prefs.buttonSize === 'small' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('buttonSize', 'small')">Compact</button>
          <button class="uml-btn ${prefs.buttonSize === 'medium' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('buttonSize', 'medium')">Medium</button>
          <button class="uml-btn ${prefs.buttonSize === 'large' ? '' : 'secondary'}" onclick="window.__UML_MODALS__.setTouchPref('buttonSize', 'large')">Comfortable</button>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Button Opacity</span>
          <span style="font-size: 12px; font-weight: 700;">${Math.round(prefs.opacity * 100)}%</span>
        </div>
        <input type="range" min="0.2" max="1.0" step="0.05" value="${prefs.opacity}" style="width: 100%; cursor: pointer;" oninput="window.__UML_MODALS__.setTouchOpacity(this.value)">
      </div>

      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn" onclick="window.__UML_MODALS__.closeModal()">Save Preferences</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  setTouchPref(key, val) {
    this.engine.touchControls.prefs[key] = val;
    this.engine.touchControls.savePreferences();
    this.engine.touchControls.applyPreferences();
    this.openInputSettings();
  }

  setTouchOpacity(val) {
    this.engine.touchControls.prefs.opacity = parseFloat(val);
    this.engine.touchControls.savePreferences();
    this.engine.touchControls.applyPreferences();
  }

  // G. CAR MEET & COMMUNITY MODAL
  openCarMeet() {
    this.activeModal = 'car_meet';
    const vehicle = this.engine.currentVehicleData;
    const playerMoney = this.engine.economy.getMoney();

    const showcaseCars = [
      { name: 'Scarlet GT Turbo', owner: 'Kenji', spec: 'Twin-Turbo • 480 HP • Carbon Aero', rep: '+120 Rep' },
      { name: 'Midnight Stance S15', owner: 'Maya', spec: 'Camber -4° • Air Suspension • BBS Rims', rep: '+95 Rep' },
      { name: 'Sunburst Drift Spec', owner: 'Daisuke', spec: 'Welded Diff • Angle Kit • 520 HP', rep: '+150 Rep' },
      { name: 'Emerald Circuit R', owner: 'Elena', spec: 'Sequential Gearbox • Slick Tires', rep: '+140 Rep' }
    ];

    const carsListHtml = showcaseCars.map(c => `
      <div class="uml-card-item">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 4px;">
          <div style="font-weight: 700; font-size: 13px;">${c.name}</div>
          <span style="font-size: 11px; color: #38bdf8; font-weight: 600;">${c.rep}</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">Owner: ${c.owner}</div>
        <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 10px;">${c.spec}</div>
        <button class="uml-btn secondary" style="width: 100%; font-size: 11px; padding: 6px;" onclick="alert('Inspected ${c.name}! Beautiful build details and clean engine bay.')">
          Inspect Build
        </button>
      </div>
    `).join('');

    this.card.innerHTML = `
      <div class="uml-modal-header">
        <div class="uml-modal-title">
          <span>Stance & Speed Car Meet</span>
          <span style="font-size: 12px; color: #4ade80; font-weight: 600;">$${playerMoney.toLocaleString()}</span>
        </div>
        <button class="uml-close-btn" onclick="window.__UML_MODALS__.closeModal()">✕</button>
      </div>

      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">Your Ride: ${vehicle.name}</div>
            <div style="font-size: 11px; color: #94a3b8;">Color: ${vehicle.color} • Rim: ${vehicle.rimStyle || 'Chrome'} • Aero: ${vehicle.spoilerType || 'Stock'}</div>
          </div>
          <button class="uml-btn" onclick="window.__UML_MODALS__.showcasePlayerCar()">Showcase Ride (+ $350)</button>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Community Showcase</h4>
        <div class="uml-grid" style="margin-bottom: 0;">
          ${carsListHtml}
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.04); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight: 700; font-size: 13px;">Street Sprint Challenge</div>
            <div style="font-size: 11px; color: #94a3b8;">Hit 80 km/h in the city drag stretch to claim community reward!</div>
          </div>
          <button class="uml-btn" style="background: #e11d48;" onclick="window.__UML_MODALS__.startSpeedChallenge()">Start Sprint</button>
        </div>
      </div>

      <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
        <button class="uml-btn secondary" onclick="window.__UML_MODALS__.closeModal()">Leave Meet</button>
      </div>
    `;

    this.backdrop.classList.add('active');
  }

  showcasePlayerCar() {
    this.engine.economy.earn(350, 'Car Meet Showcase Reward');
    if (this.engine.audio) this.engine.audio.playRefuel();
    this.engine.saveProgress();
    alert('Your car was showcased to the community crowd! Earned +$350.');
    this.openCarMeet();
  }

  startSpeedChallenge() {
    this.closeModal();
    this.showPrompt('ACCELERATE! Reach 80 km/h for the prize!', 'GO');
    const checkInterval = setInterval(() => {
      if (this.engine.physics.getKmh() >= 80) {
        clearInterval(checkInterval);
        this.engine.economy.earn(1000, 'Street Sprint Challenge Win');
        if (this.engine.audio) this.engine.audio.playRefuel();
        this.engine.saveProgress();
        this.showPrompt('CHALLENGE WON! +$1,000 Awarded!', 'WIN');
        setTimeout(() => this.hidePrompt(), 3500);
      }
    }, 200);

    setTimeout(() => {
      clearInterval(checkInterval);
    }, 15000);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
