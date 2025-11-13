import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Switch
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Modal from 'react-native-modal';
import * as SMS from 'expo-sms';
import { Settings, loadSettings } from '../utils/settings';
import { fetchSensorData, generateSensorId, getMockValveData } from '../utils/api';

interface Valve {
  id: string;
  name: string;
  status: boolean;
  flow: string;
  smsId: string;
  smsPrefix: string;
}

interface ValveSensorData {
  moisture: string;
  pressure: string;
  pH: string;
  flowRate: string;
  temperature: string;
  isLoading?: boolean;
}

const ValvesScreen = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [valves, setValves] = useState<Valve[]>([]);
  const [selectedValve, setSelectedValve] = useState<Valve | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sensorData, setSensorData] = useState<ValveSensorData | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadInitialSettings();
    }
  }, [isFocused]);

  const loadInitialSettings = async () => {
    const loadedSettings = await loadSettings();
    setSettings(loadedSettings);
    
    const valvesArray = Object.entries(loadedSettings.valves).map(([key, valve]) => ({
      id: key,
      name: valve.name,
      status: false,
      flow: valve.flow,
      smsId: valve.smsId,
      smsPrefix: valve.smsPrefix
    }));
    
    setValves(valvesArray);
  };

  const fetchValveSensorData = async (valve: Valve): Promise<ValveSensorData> => {
    // Generate sensor ID for API call
    const sensorId = generateSensorId('valve', valve.smsPrefix, valve.smsId);
    
    try {
      const apiData = await fetchSensorData(sensorId);
      
      if (apiData) {
        // Map API response to our sensor data format
        return {
          moisture: apiData.moisture ? `${parseFloat(apiData.moisture).toFixed(1)}` : '--',
          pressure: apiData.pressure ? `${parseFloat(apiData.pressure).toFixed(1)}` : '--',
          pH: apiData.pH ? `${parseFloat(apiData.pH).toFixed(1)}` : '--',
          flowRate: apiData.flowRate ? apiData.flowRate : (valve.status ? valve.flow : '0'),
          temperature: apiData.temperature ? `${parseFloat(apiData.temperature).toFixed(1)}` : '--'
        };
      } else {
        // Fallback to mock data if API fails
        console.log('Using mock data for valve:', valve.name);
        const mockData = getMockValveData(valve.name, valve.status, valve.flow);
        return {
          moisture: mockData.moisture,
          pressure: mockData.pressure,
          pH: mockData.pH,
          flowRate: mockData.flowRate,
          temperature: mockData.temperature
        };
      }
    } catch (error) {
      console.error('Error fetching valve sensor data:', error);
      const mockData = getMockValveData(valve.name, valve.status, valve.flow);
      return {
        moisture: mockData.moisture,
        pressure: mockData.pressure,
        pH: mockData.pH,
        flowRate: mockData.flowRate,
        temperature: mockData.temperature
      };
    }
  };

  const showValveDetails = async (valve: Valve) => {
    setSelectedValve(valve);
    setIsModalVisible(true);
    
    // Set loading state
    setSensorData({
      moisture: '--',
      pressure: '--',
      pH: '--',
      flowRate: '--',
      temperature: '--',
      isLoading: true
    });

    // Fetch real sensor data
    const sensorData = await fetchValveSensorData(valve);
    setSensorData(sensorData);
  };

  const sendSMSCommand = async (command: string, valve: Valve) => {
    if (!settings) {
      Alert.alert('Error', 'Settings not loaded');
      return false;
    }

    try {
      setLoadingId(valve.id);
      
      const isAvailable = await SMS.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('SMS Not Available', 'SMS is not available on this device');
        return false;
      }

      const smsMessage = command === 'ON' 
        ? settings.onFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)
        : settings.offFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId);

      console.log('Sending SMS:', {
        phone: settings.phoneNumber,
        message: smsMessage,
        valve: valve.name,
        prefix: valve.smsPrefix,
        id: valve.smsId
      });

      const { result } = await SMS.sendSMSAsync(
        [settings.phoneNumber],
        smsMessage
      );

      console.log('SMS result:', result);

      // Update the UI immediately
      setValves(valves.map(v => 
        v.id === valve.id ? { 
          ...v, 
          status: command === 'ON',
          flow: command === 'ON' ? valve.flow : '0 L/min'
        } : v
      ));

      Alert.alert('Success', `SMS app opened with command: ${smsMessage}\n\nPlease tap "Send" in your messaging app.`);
      
      return true;

    } catch (error) {
      console.error('SMS sending error:', error);
      Alert.alert('Error', 'Failed to open SMS app');
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  const quickToggleValve = (valve: Valve) => {
    if (!settings) {
      Alert.alert('Error', 'Settings not loaded yet');
      return;
    }

    const newStatus = !valve.status;
    const command = newStatus ? 'ON' : 'OFF';
    const smsMessage = command === 'ON' 
      ? settings.onFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)
      : settings.offFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId);
    
    Alert.alert(
      `Control ${valve.name}`,
      `Send "${smsMessage}" to ${settings.phoneNumber}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send SMS',
          onPress: () => sendSMSCommand(command, valve),
        },
        {
          text: 'View Details',
          onPress: () => showValveDetails(valve),
        },
      ]
    );
  };

  const formatSensorValue = (value: string, unit: string) => {
    if (value === '--') return `--${unit}`;
    return `${value} ${unit}`;
  };

  const getWaterQualityStatus = (pH: string) => {
    if (pH === '--') return { status: '--', color: '#999' };
    const pHValue = parseFloat(pH);
    if (pHValue >= 6.5 && pHValue <= 7.5) {
      return { status: 'Good', color: '#4CAF50' };
    } else {
      return { status: 'Check', color: '#F44336' };
    }
  };

  if (!settings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Valve Control</Text>
        <Text style={styles.subtitle}>
          Tap switches to control via SMS • Long press for details
        </Text>
        
        {valves.map(valve => (
          <TouchableOpacity 
            key={valve.id} 
            style={[
              styles.valveCard,
              { borderLeftColor: valve.status ? '#4CAF50' : '#F44336' }
            ]}
            onPress={() => quickToggleValve(valve)}
            onLongPress={() => showValveDetails(valve)}
            delayLongPress={500}
          >
            <View style={styles.valveInfo}>
              <Text style={styles.valveName}>{valve.name}</Text>
              <Text style={styles.valveId}>
                SMS ID: {valve.smsPrefix}{valve.smsId}
              </Text>
              <Text style={styles.valveFlow}>
                Flow: {valve.status ? valve.flow : '0 L/min'}
              </Text>
              <Text style={[
                styles.valveStatus,
                { color: valve.status ? '#4CAF50' : '#F44336' }
              ]}>
                {valve.status ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
            <View style={styles.controls}>
              {loadingId === valve.id ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Switch
                  value={valve.status}
                  onValueChange={() => quickToggleValve(valve)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={valve.status ? '#007AFF' : '#f4f3f4'}
                />
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Valve Details Modal */}
        <Modal
          isVisible={isModalVisible}
          onBackdropPress={() => setIsModalVisible(false)}
          onSwipeComplete={() => setIsModalVisible(false)}
          swipeDirection="down"
          style={styles.modal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedValve?.name} - Sensor Readings
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {sensorData?.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading sensor data...</Text>
              </View>
            ) : (
              <View style={styles.sensorGrid}>
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Moisture</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: sensorData?.moisture === '--' ? '#999' : '#007AFF' }
                  ]}>
                    {formatSensorValue(sensorData?.moisture || '--', '%')}
                  </Text>
                </View>
                
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Pressure</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: sensorData?.pressure === '--' ? '#999' : '#007AFF' }
                  ]}>
                    {formatSensorValue(sensorData?.pressure || '--', 'PSI')}
                  </Text>
                </View>
                
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>pH Level</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: sensorData?.pH === '--' ? '#999' : '#007AFF' }
                  ]}>
                    {sensorData?.pH === '--' ? '--' : sensorData?.pH}
                  </Text>
                </View>
                
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Flow Rate</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: sensorData?.flowRate === '--' ? '#999' : '#007AFF' }
                  ]}>
                    {sensorData?.flowRate === '--' ? '-- L/min' : sensorData?.flowRate}
                  </Text>
                </View>
                
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Temperature</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: sensorData?.temperature === '--' ? '#999' : '#007AFF' }
                  ]}>
                    {formatSensorValue(sensorData?.temperature || '--', '°C')}
                  </Text>
                </View>
                
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Water Quality</Text>
                  <Text style={[
                    styles.sensorValue,
                    { color: getWaterQualityStatus(sensorData?.pH || '--').color }
                  ]}>
                    {getWaterQualityStatus(sensorData?.pH || '--').status}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Current Status:</Text>
              <Text style={[
                styles.statusValue,
                { color: selectedValve?.status ? '#4CAF50' : '#F44336' }
              ]}>
                {selectedValve?.status ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={async () => {
                if (selectedValve) {
                  setSensorData(prev => ({ ...prev!, isLoading: true }));
                  const freshData = await fetchValveSensorData(selectedValve);
                  setSensorData(freshData);
                }
              }}
            >
              <Text style={styles.refreshButtonText}>
                {sensorData?.isLoading ? 'Loading...' : 'Refresh Readings'}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Current Configuration</Text>
          <Text style={styles.infoText}>Phone: {settings.phoneNumber}</Text>
          <Text style={styles.infoText}>ON Format: {settings.onFormat}</Text>
          <Text style={styles.infoText}>OFF Format: {settings.offFormat}</Text>
        </View>

        <View style={styles.commandCard}>
          <Text style={styles.commandTitle}>Available Valve Commands:</Text>
          {valves.map(valve => (
            <View key={valve.id}>
              <Text style={styles.commandText}>
                • {settings.onFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)} - Open {valve.name}
              </Text>
              <Text style={styles.commandText}>
                • {settings.offFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)} - Close {valve.name}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={loadInitialSettings}
        >
          <Text style={styles.refreshButtonText}>Refresh Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    color: '#666',
  },
  valveCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  valveInfo: {
    flex: 1,
  },
  valveName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  valveId: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
    fontWeight: '600',
  },
  valveFlow: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  valveStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'center',
    minWidth: 50,
  },
  // Modal Styles
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sensorItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sensorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '500',
  },
  sensorValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  commandCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  commandTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2E7D32',
  },
  commandText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});

export default ValvesScreen;