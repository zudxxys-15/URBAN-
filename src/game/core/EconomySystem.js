import { SaveSystem } from './SaveSystem.js';

export class EconomySystem {
  constructor() {
    this.saveData = SaveSystem.load();
    this.onMoneyChanged = null;
  }

  getMoney() {
    return this.saveData.money;
  }

  canAfford(amount) {
    return this.saveData.money >= amount;
  }

  spend(amount, reason = 'Purchase') {
    if (!this.canAfford(amount)) return false;
    this.saveData.money -= amount;
    SaveSystem.save(this.saveData);
    if (this.onMoneyChanged) this.onMoneyChanged(this.saveData.money, -amount, reason);
    return true;
  }

  earn(amount, reason = 'Reward') {
    this.saveData.money += amount;
    SaveSystem.save(this.saveData);
    if (this.onMoneyChanged) this.onMoneyChanged(this.saveData.money, amount, reason);
    return true;
  }
}
