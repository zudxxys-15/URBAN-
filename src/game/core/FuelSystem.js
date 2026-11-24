export class FuelSystem {
  constructor(economySystem) {
    this.economy = economySystem;
    this.fuelPricePerLiter = 4.5; // $4.50 per liter
    this.consumptionRatePerKm = 0.085; // 8.5L / 100km standard
    this.idleBurnPerSecond = 0.002; // Small burn during idle

    // Gas station interaction zone
    this.stationPosition = { x: 45, z: 0, radius: 10 };
  }

  update(dt, currentVehicle, physics) {
    if (!currentVehicle || dt <= 0) return;

    if (currentVehicle.fuel <= 0) {
      currentVehicle.fuel = 0;
      // Stutter/stall engine speed when out of gas
      physics.speed = Math.max(0, physics.speed - 12.0 * dt);
      return;
    }

    const speedKmh = physics.getKmh();
    const distanceTraveledKm = (Math.abs(physics.speed) * dt) / 1000;

    // Fuel consumed based on distance + idle burn
    const fuelBurn = (distanceTraveledKm * this.consumptionRatePerKm * 10) + (this.idleBurnPerSecond * dt);
    currentVehicle.fuel = Math.max(0, currentVehicle.fuel - fuelBurn);
    currentVehicle.mileageKm = (currentVehicle.mileageKm || 0) + distanceTraveledKm;
  }

  isAtGasStation(pos) {
    const dx = pos.x - this.stationPosition.x;
    const dz = pos.z - this.stationPosition.z;
    return (dx * dx + dz * dz) <= (this.stationPosition.radius * this.stationPosition.radius);
  }

  refuel(vehicle, litersDesired) {
    if (!vehicle) return { success: false, message: 'No vehicle selected' };
    const needed = (vehicle.maxFuel || 55) - vehicle.fuel;
    if (needed <= 0.1) return { success: false, message: 'Fuel tank is already full' };

    const litersToFill = Math.min(needed, litersDesired || needed);
    const cost = Math.round(litersToFill * this.fuelPricePerLiter);

    if (!this.economy.canAfford(cost)) {
      return { success: false, message: `Insufficient funds. Need $${cost}` };
    }

    this.economy.spend(cost, `Refueling (${litersToFill.toFixed(1)}L)`);
    vehicle.fuel = Math.min(vehicle.maxFuel, vehicle.fuel + litersToFill);
    return { success: true, litersFilled: litersToFill, cost };
  }
}
