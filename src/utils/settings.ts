import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TankConfig {
  name: string;
  nutrient: {
    N: string;  // Nitrogen
    P: string;  // Phosphorus
    K: string;  // Potassium
    Ca: string; // Calcium
    Mg: string; // Magnesium
    S: string;  // Sulfur
  };
  volume: string;
  smsId: string;
  smsPrefix: string;
}

export interface FertigationSettings {
  dosingPump: {
    smsId: string;
    smsPrefix: string;
  };
  tanks: {
    [key: string]: TankConfig;
  };
}


export interface MotorConfig {
  name: string;
  smsId: string;
  smsPrefix: string;
  power: string;
}

export interface ValveConfig {
  name: string;
  smsId: string;
  smsPrefix: string;
  flow: string;
}

export interface Settings {
  phoneNumber: string;
  onFormat: string;
  offFormat: string;
  motors: {
    [key: string]: MotorConfig;
  };
  valves: {
    [key: string]: ValveConfig;
  };
  fertigation: FertigationSettings; // Add this

}

const defaultSettings: Settings = {
  phoneNumber: '+917305467054',
  onFormat: 'ON {prefix}{deviceId}',
  offFormat: 'OFF {prefix}{deviceId}',
  motors: {
    motor1: { name: 'Main Pump', smsId: '1', smsPrefix: 'M', power: '5.2 kW' },
    motor2: { name: 'Booster Pump', smsId: '2', smsPrefix: 'M', power: '3.7 kW' },
    motor3: { name: 'Circulation Pump', smsId: '3', smsPrefix: 'M', power: '2.1 kW' },
  },
  valves: {
    valve1: { name: 'Zone 1 - North Field', smsId: '1', smsPrefix: 'V', flow: '45 L/min' },
    valve2: { name: 'Zone 2 - South Field', smsId: '2', smsPrefix: 'V', flow: '45 L/min' },
    valve3: { name: 'Zone 3 - East Orchard', smsId: '3', smsPrefix: 'V', flow: '38 L/min' },
    valve4: { name: 'Zone 4 - West Garden', smsId: '4', smsPrefix: 'V', flow: '45 L/min' },
  },
  fertigation: {
    dosingPump: {
      smsId: '1',
      smsPrefix: 'DP'
    },
    tanks: {
      tank1: {
        name: 'Tank A - Base Nutrients',
        nutrient: { N: '15', P: '5', K: '10', Ca: '5', Mg: '2', S: '3' },
        volume: '1000',
        smsId: '1',
        smsPrefix: 'T'
      },
      tank2: {
        name: 'Tank B - Calcium Nitrate',
        nutrient: { N: '19', P: '0', K: '0', Ca: '26', Mg: '0', S: '0' },
        volume: '1000',
        smsId: '2',
        smsPrefix: 'T'
      },
      tank3: {
        name: 'Tank C - Magnesium Sulfate',
        nutrient: { N: '0', P: '0', K: '0', Ca: '0', Mg: '16', S: '13' },
        volume: '1000',
        smsId: '3',
        smsPrefix: 'T'
      }
    }
  }

};

// ... rest of the functions remain the same
export const loadSettings = async (): Promise<Settings> => {
  try {
    const storedSettings = await AsyncStorage.getItem('appSettings');
    if (storedSettings) {
      return { ...defaultSettings, ...JSON.parse(storedSettings) };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  try {
    await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const resetSettings = async (): Promise<Settings> => {
  try {
    await AsyncStorage.setItem('appSettings', JSON.stringify(defaultSettings));
    return defaultSettings;
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return defaultSettings;
  }
};