import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity 
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Modal from 'react-native-modal';
import * as SMS from 'expo-sms';
import { Settings, loadSettings } from '../utils/settings';
import { fetchSensorData, generateSensorId, getMockMotorData } from '../utils/api';

interface Motor {
  id: string;
  name: string;
  status: boolean;
  power: string;
  smsId: string;
  smsPrefix: string;
}

interface MotorSensorData {
  current: string;
  voltage: string;
  temperature: string;
  powerFactor: string;
  isLoading?: boolean;
}

const MotorsScreen = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sensorData, setSensorData] = useState<MotorSensorData | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadInitialSettings();
    }
  }, [isFocused]);

  const loadInitialSettings = async () => {
    const loadedSettings = await loadSettings();
    setSettings(loadedSettings);
    
    const motorsArray = Object.entries(loadedSettings.motors).map(([key, motor]) => ({
      id: key,
      name: motor.name,
      status: false,
      power: motor.power,
      smsId: motor.smsId,
      smsPrefix: motor.smsPrefix
    }));
    
    setMotors(motorsArray);
  };

  const fetchMotorSensorData = async (motor: Motor): Promise<MotorSensorData> => {
    const sensorId = generateSensorId('motor', motor.smsPrefix, motor.smsId);
    
    try {
      const apiData = await fetchSensorData(sensorId);
      
      if (apiData) {
        return {
          current: apiData.current ? `${parseFloat(apiData.current).toFixed(1)}` : '--',
          voltage: apiData.voltage ? `${parseFloat(apiData.voltage).toFixed(0)}` : '--',
          temperature: apiData.temperature ? `${parseFloat(apiData.temperature).toFixed(1)}` : '--',
          powerFactor: apiData.powerFactor ? `${parseFloat(apiData.powerFactor).toFixed(2)}` : '--'
        };
      } else {
        const mockData = getMockMotorData(motor.name, motor.status);
        return {
          current: mockData.current,
          voltage: mockData.voltage,
          temperature: mockData.temperature,
          powerFactor: mockData.powerFactor
        };
      }
    } catch (error) {
      const mockData = getMockMotorData(motor.name, motor.status);
      return {
        current: mockData.current,
        voltage: mockData.voltage,
        temperature: mockData.temperature,
        powerFactor: mockData.powerFactor
      };
    }
  };

  const showMotorDetails = async (motor: Motor) => {
    setSelectedMotor(motor);
    setIsModalVisible(true);
    
    setSensorData({
      current: '--',
      voltage: '--',
      temperature: '--',
      powerFactor: '--',
      isLoading: true
    });

    const sensorData = await fetchMotorSensorData(motor);
    setSensorData(sensorData);
  };

  const sendSMSCommand = async (command: string, motor: Motor) => {
    if (!settings) {
      Alert.alert('Error', 'Settings not loaded');
      return false;
    }

    try {
      setLoadingId(motor.id);
      
      const isAvailable = await SMS.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('SMS Not Available', 'SMS is not available on this device');
        return false;
      }

      const smsMessage = command === 'ON' 
        ? settings.onFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId)
        : settings.offFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId);

      const { result } = await SMS.sendSMSAsync(
        [settings.phoneNumber],
        smsMessage
      );

      setMotors(motors.map(m => 
        m.id === motor.id ? { ...m, status: command === 'ON' } : m
      ));

      Alert.alert('Success', `SMS app opened with command: ${smsMessage}\n\nPlease tap "Send" in your messaging app.`);
      
      return true;

    } catch (error) {
      Alert.alert('Error', 'Failed to open SMS app');
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  const quickToggleMotor = (motor: Motor) => {
    if (!settings) return;

    const newStatus = !motor.status;
    const command = newStatus ? 'ON' : 'OFF';
    const smsMessage = command === 'ON' 
      ? settings.onFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId)
      : settings.offFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId);
    
    Alert.alert(
      `Control ${motor.name}`,
      `Send "${smsMessage}" to ${settings.phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SMS', onPress: () => sendSMSCommand(command, motor) },
        { text: 'View Details', onPress: () => showMotorDetails(motor) },
      ]
    );
  };

  const formatSensorValue = (value: string, unit: string) => {
    if (value === '--') return `--${unit}`;
    return `${value} ${unit}`;
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
        <Text style={styles.title}>Motor Control</Text>
        <Text style={styles.subtitle}>Tap switches to control via SMS • Long press for details</Text>
        
        {motors.map(motor => (
          <TouchableOpacity 
            key={motor.id} 
            style={styles.motorCard}
            onPress={() => quickToggleMotor(motor)}
            onLongPress={() => showMotorDetails(motor)}
            delayLongPress={500}
          >
            <View style={styles.motorInfo}>
              <Text style={styles.motorName}>{motor.name}</Text>
              <Text style={styles.motorId}>SMS ID: {motor.smsPrefix}{motor.smsId}</Text>
              <Text style={styles.motorPower}>{motor.power}</Text>
              <Text style={[styles.motorStatus, { color: motor.status ? '#4CAF50' : '#F44336' }]}>
                {motor.status ? 'Running' : 'Stopped'}
              </Text>
            </View>
            <View style={styles.controls}>
              {loadingId === motor.id ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Switch
                  value={motor.status}
                  onValueChange={() => quickToggleMotor(motor)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={motor.status ? '#007AFF' : '#f4f3f4'}
                />
              )}
            </View>
          </TouchableOpacity>
        ))}

        <Modal
          isVisible={isModalVisible}
          onBackdropPress={() => setIsModalVisible(false)}
          onSwipeComplete={() => setIsModalVisible(false)}
          swipeDirection="down"
          style={styles.modal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMotor?.name} - Sensor Readings</Text>
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
                  <Text style={styles.sensorLabel}>Current</Text>
                  <Text style={[styles.sensorValue, { color: sensorData?.current === '--' ? '#999' : '#007AFF' }]}>
                    {formatSensorValue(sensorData?.current || '--', 'A')}
                  </Text>
                </View>
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Voltage</Text>
                  <Text style={[styles.sensorValue, { color: sensorData?.voltage === '--' ? '#999' : '#007AFF' }]}>
                    {formatSensorValue(sensorData?.voltage || '--', 'V')}
                  </Text>
                </View>
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Temperature</Text>
                  <Text style={[styles.sensorValue, { color: sensorData?.temperature === '--' ? '#999' : '#007AFF' }]}>
                    {formatSensorValue(sensorData?.temperature || '--', '°C')}
                  </Text>
                </View>
                <View style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>Power Factor</Text>
                  <Text style={[styles.sensorValue, { color: sensorData?.powerFactor === '--' ? '#999' : '#007AFF' }]}>
                    {sensorData?.powerFactor === '--' ? '--' : sensorData?.powerFactor}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Current Status:</Text>
              <Text style={[styles.statusValue, { color: selectedMotor?.status ? '#4CAF50' : '#F44336' }]}>
                {selectedMotor?.status ? 'RUNNING' : 'STOPPED'}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={async () => {
                if (selectedMotor) {
                  setSensorData(prev => ({ ...prev!, isLoading: true }));
                  const freshData = await fetchMotorSensorData(selectedMotor);
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 14, marginBottom: 20, color: '#666' },
  motorCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  motorInfo: { flex: 1 },
  motorName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  motorId: { fontSize: 12, color: '#007AFF', marginBottom: 4, fontWeight: '600' },
  motorPower: { fontSize: 14, color: '#666', marginBottom: 4 },
  motorStatus: { fontSize: 14, fontWeight: '600' },
  controls: { alignItems: 'center', minWidth: 50 },
  modal: { justifyContent: 'flex-end', margin: 0 },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
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
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1 },
  closeButton: { padding: 5 },
  closeButtonText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
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
  sensorLabel: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '500' },
  sensorValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  statusLabel: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  statusValue: { fontSize: 16, fontWeight: 'bold' },
  refreshButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  refreshButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default MotorsScreen;