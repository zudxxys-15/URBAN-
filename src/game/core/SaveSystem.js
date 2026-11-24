export class SaveSystem {
  static STORAGE_KEY = 'urban_motor_life_save_v1';

  static getDefaultState() {
    return {
      version: 1,
      lastSaved: Date.now(),
      money: 25000, // Starting budget for buying starter car or upgrading
      currentVehicleId: 'coupe_r3',
      ownedVehicles: [
        {
          id: 'coupe_r3',
          name: 'Veloce Spectre Coupe',
          category: 'Sport Coupe',
          color: '#1f2937',
          colorName: 'Slate Charcoal',
          rimStyle: 'chrome',
          spoilerType: 'sport',
          engineStage: 1,
          suspensionStage: 1,
          fuel: 48.0,
          maxFuel: 55.0,
          mileageKm: 12.4
        }
      ],
      garageLocations: [
        { id: 'central_garage', x: 0, z: -30, name: 'Downtown Haven Garage' }
      ],
      gasStations: [
        { id: 'gas_station_1', x: 45, z: 0, name: 'Avenue Fuel & Wash' }
      ]
    };
  }

  static load() {
    try {
      const dataStr = localStorage.getItem(SaveSystem.STORAGE_KEY);
      if (!dataStr) {
        const defaultState = SaveSystem.getDefaultState();
        SaveSystem.save(defaultState);
        return defaultState;
      }
      const data = JSON.parse(dataStr);
      // Validate schema
      if (!data || typeof data.money !== 'number' || !Array.isArray(data.ownedVehicles)) {
        console.warn('Invalid save data detected, restoring default progression.');
        return SaveSystem.getDefaultState();
      }
      return data;
    } catch (err) {
      console.error('Failed to load save state:', err);
      return SaveSystem.getDefaultState();
    }
  }

  static save(state) {
    try {
      state.lastSaved = Date.now();
      localStorage.setItem(SaveSystem.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Failed to save state to LocalStorage:', err);
      return false;
    }
  }

  static reset() {
    localStorage.removeItem(SaveSystem.STORAGE_KEY);
    return SaveSystem.getDefaultState();
  }
}
