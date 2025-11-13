// API configuration
const API_BASE_URL = 'https://api.farmapp.com/v1';

// Common function to fetch sensor data with error handling
export const fetchSensorData = async (sensorId: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/${sensorId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch sensor data for ${sensorId}:`, error);
    return null; // Return null instead of throwing to prevent app crashes
  }
};

// Generate sensor IDs based on device configuration
export const generateSensorId = (deviceType: 'motor' | 'valve', prefix: string, id: string): string => {
  return `${deviceType}_${prefix}${id}`.toLowerCase();
};

// Mock data fallback for when API is not available
export const getMockMotorData = (motorName: string, isRunning: boolean) => ({
  current: `${(Math.random() * 10 + 5).toFixed(1)}`,
  voltage: `${(Math.random() * 50 + 380).toFixed(0)}`,
  temperature: `${(Math.random() * 20 + 40).toFixed(1)}`,
  powerFactor: `${(Math.random() * 0.3 + 0.85).toFixed(2)}`,
  status: isRunning ? 'running' : 'stopped'
});

export const getMockValveData = (valveName: string, isOpen: boolean, configuredFlow: string) => ({
  moisture: `${(Math.random() * 30 + 40).toFixed(1)}`,
  pressure: `${(Math.random() * 20 + 30).toFixed(1)}`,
  pH: `${(Math.random() * 2 + 6).toFixed(1)}`,
  flowRate: isOpen ? configuredFlow : '0',
  temperature: `${(Math.random() * 10 + 20).toFixed(1)}`,
  status: isOpen ? 'open' : 'closed'
});

// Add fertigation mock data
export const getMockFertigationData = () => ({
  ec: `${(Math.random() * 2 + 1).toFixed(1)}`,
  pH: `${(Math.random() * 1 + 6.5).toFixed(1)}`,
  temperature: `${(Math.random() * 5 + 20).toFixed(1)}`,
  pressure: `${(Math.random() * 10 + 30).toFixed(1)}`,
  flowRate: `${(Math.random() * 10 + 5).toFixed(1)}`,
  tankLevels: {
    tank1: `${(Math.random() * 100).toFixed(0)}`,
    tank2: `${(Math.random() * 100).toFixed(0)}`,
    tank3: `${(Math.random() * 100).toFixed(0)}`
  }
});