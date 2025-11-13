import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Switch,
  TextInput
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Modal from 'react-native-modal';
import * as SMS from 'expo-sms';
import { Settings, loadSettings, TankConfig } from '../utils/settings';
import { fetchSensorData, generateSensorId, getMockFertigationData } from '../utils/api';

interface Tank extends TankConfig {
  id: string;
  valveStatus: boolean;
}

interface FertigationSensorData {
  ec: string;
  pH: string;
  temperature: string;
  pressure: string;
  flowRate: string;
  tankLevels: {
    [key: string]: string;
  };
  isLoading?: boolean;
}

interface NutrientMix {
  N: number;
  P: number;
  K: number;
  Ca: number;
  Mg: number;
  S: number;
}

const FertigationScreen = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [dosingPumpStatus, setDosingPumpStatus] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sensorData, setSensorData] = useState<FertigationSensorData | null>(null);
  const [nutrientMix, setNutrientMix] = useState<NutrientMix>({ N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 });
  const [editingTank, setEditingTank] = useState<Tank | null>(null);
  const [isNutrientModalVisible, setIsNutrientModalVisible] = useState(false);
  const [editingNutrients, setEditingNutrients] = useState({
    N: '',
    P: '',
    K: '',
    Ca: '',
    Mg: '',
    S: ''
  });
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadInitialSettings();
    }
  }, [isFocused]);

  useEffect(() => {
    calculateOverallNutrientMix();
  }, [tanks]);

  const loadInitialSettings = async () => {
    const loadedSettings = await loadSettings();
    setSettings(loadedSettings);
    
    if (loadedSettings.fertigation) {
      const tanksArray = Object.entries(loadedSettings.fertigation.tanks).map(([key, tank]) => ({
        id: key,
        ...tank,
        valveStatus: false
      }));
      setTanks(tanksArray);
    }
  };

  const calculateOverallNutrientMix = () => {
    let totalN = 0, totalP = 0, totalK = 0, totalCa = 0, totalMg = 0, totalS = 0;
    let activeTanks = 0;

    tanks.forEach(tank => {
      if (tank.valveStatus) {
        totalN += parseFloat(tank.nutrient.N) || 0;
        totalP += parseFloat(tank.nutrient.P) || 0;
        totalK += parseFloat(tank.nutrient.K) || 0;
        totalCa += parseFloat(tank.nutrient.Ca) || 0;
        totalMg += parseFloat(tank.nutrient.Mg) || 0;
        totalS += parseFloat(tank.nutrient.S) || 0;
        activeTanks++;
      }
    });

    if (activeTanks > 0) {
      setNutrientMix({
        N: totalN / activeTanks,
        P: totalP / activeTanks,
        K: totalK / activeTanks,
        Ca: totalCa / activeTanks,
        Mg: totalMg / activeTanks,
        S: totalS / activeTanks
      });
    } else {
      setNutrientMix({ N: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0 });
    }
  };

  const fetchFertigationSensorData = async (): Promise<FertigationSensorData> => {
    try {
      const apiData = await fetchSensorData('fertigation_system');
      
      if (apiData) {
        return {
          ec: apiData.ec ? `${parseFloat(apiData.ec).toFixed(1)}` : '--',
          pH: apiData.pH ? `${parseFloat(apiData.pH).toFixed(1)}` : '--',
          temperature: apiData.temperature ? `${parseFloat(apiData.temperature).toFixed(1)}` : '--',
          pressure: apiData.pressure ? `${parseFloat(apiData.pressure).toFixed(1)}` : '--',
          flowRate: apiData.flowRate ? `${parseFloat(apiData.flowRate).toFixed(1)}` : '--',
          tankLevels: apiData.tankLevels || {
            tank1: '--',
            tank2: '--',
            tank3: '--'
          }
        };
      } else {
        const mockData = getMockFertigationData();
        return {
          ec: mockData.ec,
          pH: mockData.pH,
          temperature: mockData.temperature,
          pressure: mockData.pressure,
          flowRate: mockData.flowRate,
          tankLevels: mockData.tankLevels
        };
      }
    } catch (error) {
      const mockData = getMockFertigationData();
      return {
        ec: mockData.ec,
        pH: mockData.pH,
        temperature: mockData.temperature,
        pressure: mockData.pressure,
        flowRate: mockData.flowRate,
        tankLevels: mockData.tankLevels
      };
    }
  };

  const showSystemDetails = async () => {
    setIsModalVisible(true);
    
    setSensorData({
      ec: '--',
      pH: '--',
      temperature: '--',
      pressure: '--',
      flowRate: '--',
      tankLevels: { tank1: '--', tank2: '--', tank3: '--' },
      isLoading: true
    });

    const sensorData = await fetchFertigationSensorData();
    setSensorData(sensorData);
  };

  const sendSMSCommand = async (command: string, deviceType: 'tank' | 'dosingPump', deviceId?: string) => {
    if (!settings) {
      Alert.alert('Error', 'Settings not loaded');
      return false;
    }

    try {
      setLoadingId(deviceId || 'dosingPump');
      
      const isAvailable = await SMS.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('SMS Not Available', 'SMS is not available on this device');
        return false;
      }

      let smsMessage = '';
      if (deviceType === 'tank' && deviceId) {
        const tank = tanks.find(t => t.id === deviceId);
        if (tank) {
          smsMessage = command === 'ON' 
            ? settings.onFormat.replace('{prefix}', tank.smsPrefix).replace('{deviceId}', tank.smsId)
            : settings.offFormat.replace('{prefix}', tank.smsPrefix).replace('{deviceId}', tank.smsId);
        }
      } else {
        smsMessage = command === 'ON' 
          ? settings.onFormat.replace('{prefix}', settings.fertigation.dosingPump.smsPrefix).replace('{deviceId}', settings.fertigation.dosingPump.smsId)
          : settings.offFormat.replace('{prefix}', settings.fertigation.dosingPump.smsPrefix).replace('{deviceId}', settings.fertigation.dosingPump.smsId);
      }

      const { result } = await SMS.sendSMSAsync(
        [settings.phoneNumber],
        smsMessage
      );

      if (deviceType === 'tank' && deviceId) {
        setTanks(tanks.map(tank => 
          tank.id === deviceId ? { ...tank, valveStatus: command === 'ON' } : tank
        ));
      } else {
        setDosingPumpStatus(command === 'ON');
      }

      Alert.alert('Success', `SMS app opened with command: ${smsMessage}\n\nPlease tap "Send" in your messaging app.`);
      
      return true;

    } catch (error) {
      Alert.alert('Error', 'Failed to open SMS app');
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  const toggleTankValve = (tank: Tank) => {
    if (!settings) return;

    const newStatus = !tank.valveStatus;
    const command = newStatus ? 'ON' : 'OFF';
    const smsMessage = command === 'ON' 
      ? settings.onFormat.replace('{prefix}', tank.smsPrefix).replace('{deviceId}', tank.smsId)
      : settings.offFormat.replace('{prefix}', tank.smsPrefix).replace('{deviceId}', tank.smsId);
    
    Alert.alert(
      `Control ${tank.name}`,
      `Send "${smsMessage}" to ${settings.phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send SMS', 
          onPress: () => {
            sendSMSCommand(command, 'tank', tank.id);
          }
        },
      ]
    );
  };

  const toggleDosingPump = () => {
    if (!settings) return;

    const newStatus = !dosingPumpStatus;
    const command = newStatus ? 'ON' : 'OFF';
    const smsMessage = command === 'ON' 
      ? settings.onFormat.replace('{prefix}', settings.fertigation.dosingPump.smsPrefix).replace('{deviceId}', settings.fertigation.dosingPump.smsId)
      : settings.offFormat.replace('{prefix}', settings.fertigation.dosingPump.smsPrefix).replace('{deviceId}', settings.fertigation.dosingPump.smsId);
    
    Alert.alert(
      `Control Dosing Pump`,
      `Send "${smsMessage}" to ${settings.phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SMS', onPress: () => sendSMSCommand(command, 'dosingPump') },
      ]
    );
  };

  const editNutrientMix = (tank: Tank) => {
    setEditingTank(tank);
    setEditingNutrients({
      N: tank.nutrient.N,
      P: tank.nutrient.P,
      K: tank.nutrient.K,
      Ca: tank.nutrient.Ca,
      Mg: tank.nutrient.Mg,
      S: tank.nutrient.S
    });
    setIsNutrientModalVisible(true);
  };

  const handleNutrientChange = (nutrient: keyof typeof editingNutrients, value: string) => {
    setEditingNutrients(prev => ({
      ...prev,
      [nutrient]: value
    }));
  };

  const saveNutrientMix = () => {
    if (editingTank && settings) {
      const updatedTanks = tanks.map(tank => 
        tank.id === editingTank.id 
          ? {
              ...tank,
              nutrient: {
                N: editingNutrients.N || '0',
                P: editingNutrients.P || '0',
                K: editingNutrients.K || '0',
                Ca: editingNutrients.Ca || '0',
                Mg: editingNutrients.Mg || '0',
                S: editingNutrients.S || '0'
              }
            }
          : tank
      );
      
      setTanks(updatedTanks);
      Alert.alert('Success', 'Nutrient mix updated!');
      setIsNutrientModalVisible(false);
      setEditingTank(null);
    }
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
        <Text style={styles.title}>Fertigation Control</Text>
        <Text style={styles.subtitle}>
          Manage nutrient tanks and dosing system
        </Text>

        {/* Dosing Pump Control */}
        <View style={styles.dosingPumpCard}>
          <View style={styles.dosingPumpInfo}>
            <Text style={styles.dosingPumpName}>Dosing Pump</Text>
            <Text style={styles.dosingPumpId}>
              SMS ID: {settings.fertigation.dosingPump.smsPrefix}{settings.fertigation.dosingPump.smsId}
            </Text>
            <Text style={[styles.dosingPumpStatus, { color: dosingPumpStatus ? '#4CAF50' : '#F44336' }]}>
              {dosingPumpStatus ? 'RUNNING' : 'STOPPED'}
            </Text>
          </View>
          <View style={styles.controls}>
            {loadingId === 'dosingPump' ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Switch
                value={dosingPumpStatus}
                onValueChange={toggleDosingPump}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={dosingPumpStatus ? '#007AFF' : '#f4f3f4'}
              />
            )}
          </View>
        </View>

        {/* Nutrient Tanks */}
        <Text style={styles.sectionTitle}>Nutrient Tanks</Text>
        {tanks.map(tank => (
          <View key={tank.id} style={styles.tankCard}>
            <View style={styles.tankInfo}>
              <Text style={styles.tankName}>{tank.name}</Text>
              <Text style={styles.tankId}>SMS ID: {tank.smsPrefix}{tank.smsId}</Text>
              <Text style={styles.tankVolume}>Volume: {tank.volume}L</Text>
              
              <View style={styles.nutrientGrid}>
                <Text style={styles.nutrientItem}>N: {tank.nutrient.N}%</Text>
                <Text style={styles.nutrientItem}>P: {tank.nutrient.P}%</Text>
                <Text style={styles.nutrientItem}>K: {tank.nutrient.K}%</Text>
                <Text style={styles.nutrientItem}>Ca: {tank.nutrient.Ca}%</Text>
                <Text style={styles.nutrientItem}>Mg: {tank.nutrient.Mg}%</Text>
                <Text style={styles.nutrientItem}>S: {tank.nutrient.S}%</Text>
              </View>
              
              <Text style={[styles.tankStatus, { color: tank.valveStatus ? '#4CAF50' : '#F44336' }]}>
                Valve: {tank.valveStatus ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
            <View style={styles.tankControls}>
              {loadingId === tank.id ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Switch
                  value={tank.valveStatus}
                  onValueChange={() => toggleTankValve(tank)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={tank.valveStatus ? '#007AFF' : '#f4f3f4'}
                />
              )}
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => editNutrientMix(tank)}
              >
                <Text style={styles.editButtonText}>Edit Mix</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Overall Nutrient Mix */}
        <View style={styles.nutrientMixCard}>
          <Text style={styles.nutrientMixTitle}>Current Nutrient Mix</Text>
          <Text style={styles.nutrientMixSubtitle}>
            Based on active tanks
          </Text>
          <View style={styles.nutrientMixGrid}>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Nitrogen (N)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.N.toFixed(1)}%</Text>
            </View>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Phosphorus (P)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.P.toFixed(1)}%</Text>
            </View>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Potassium (K)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.K.toFixed(1)}%</Text>
            </View>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Calcium (Ca)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.Ca.toFixed(1)}%</Text>
            </View>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Magnesium (Mg)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.Mg.toFixed(1)}%</Text>
            </View>
            <View style={styles.nutrientMixItem}>
              <Text style={styles.nutrientMixLabel}>Sulfur (S)</Text>
              <Text style={styles.nutrientMixValue}>{nutrientMix.S.toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* System Details Button */}
        <TouchableOpacity 
          style={styles.detailsButton}
          onPress={showSystemDetails}
        >
          <Text style={styles.detailsButtonText}>View System Details</Text>
        </TouchableOpacity>

        {/* System Details Modal */}
        <Modal
          isVisible={isModalVisible}
          onBackdropPress={() => setIsModalVisible(false)}
          onSwipeComplete={() => setIsModalVisible(false)}
          swipeDirection="down"
          style={styles.modal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fertigation System - Sensor Readings</Text>
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
              <ScrollView>
                <View style={styles.sensorGrid}>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>EC</Text>
                    <Text style={[styles.sensorValue, { color: sensorData?.ec === '--' ? '#999' : '#007AFF' }]}>
                      {formatSensorValue(sensorData?.ec || '--', 'mS/cm')}
                    </Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>pH</Text>
                    <Text style={[styles.sensorValue, { color: sensorData?.pH === '--' ? '#999' : '#007AFF' }]}>
                      {sensorData?.pH === '--' ? '--' : sensorData?.pH}
                    </Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Temperature</Text>
                    <Text style={[styles.sensorValue, { color: sensorData?.temperature === '--' ? '#999' : '#007AFF' }]}>
                      {formatSensorValue(sensorData?.temperature || '--', '°C')}
                    </Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Pressure</Text>
                    <Text style={[styles.sensorValue, { color: sensorData?.pressure === '--' ? '#999' : '#007AFF' }]}>
                      {formatSensorValue(sensorData?.pressure || '--', 'PSI')}
                    </Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Flow Rate</Text>
                    <Text style={[styles.sensorValue, { color: sensorData?.flowRate === '--' ? '#999' : '#007AFF' }]}>
                      {formatSensorValue(sensorData?.flowRate || '--', 'L/min')}
                    </Text>
                  </View>
                </View>

                {/* Tank Levels */}
                <Text style={styles.tankLevelsTitle}>Tank Levels</Text>
                <View style={styles.tankLevelsGrid}>
                  {tanks.map(tank => (
                    <View key={tank.id} style={styles.tankLevelItem}>
                      <Text style={styles.tankLevelLabel}>{tank.name}</Text>
                      <Text style={styles.tankLevelValue}>
                        {sensorData?.tankLevels[tank.id] === '--' ? '--' : `${sensorData?.tankLevels[tank.id]}%`}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={async () => {
                setSensorData(prev => ({ ...prev!, isLoading: true }));
                const freshData = await fetchFertigationSensorData();
                setSensorData(freshData);
              }}
            >
              <Text style={styles.refreshButtonText}>
                {sensorData?.isLoading ? 'Loading...' : 'Refresh Readings'}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Nutrient Edit Modal */}
        <Modal
          isVisible={isNutrientModalVisible}
          onBackdropPress={() => setIsNutrientModalVisible(false)}
          style={styles.modal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Nutrient Mix - {editingTank?.name}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setIsNutrientModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.nutrientEditScroll}>
              <View style={styles.nutrientEditGrid}>
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Nitrogen (N)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.N}
                    onChangeText={(value) => handleNutrientChange('N', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
                
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Phosphorus (P)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.P}
                    onChangeText={(value) => handleNutrientChange('P', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
                
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Potassium (K)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.K}
                    onChangeText={(value) => handleNutrientChange('K', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
                
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Calcium (Ca)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.Ca}
                    onChangeText={(value) => handleNutrientChange('Ca', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
                
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Magnesium (Mg)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.Mg}
                    onChangeText={(value) => handleNutrientChange('Mg', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
                
                <View style={styles.nutrientEditItem}>
                  <Text style={styles.nutrientEditLabel}>Sulfur (S)</Text>
                  <TextInput
                    style={styles.nutrientInput}
                    value={editingNutrients.S}
                    onChangeText={(value) => handleNutrientChange('S', value)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.nutrientUnit}>%</Text>
                </View>
              </View>

              {/* Current Total Display */}
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Current Total:</Text>
                <Text style={styles.totalValue}>
                  {Object.values(editingNutrients).reduce((total, value) => total + (parseFloat(value) || 0), 0).toFixed(1)}%
                </Text>
                <Text style={styles.totalNote}>
                  {Object.values(editingNutrients).reduce((total, value) => total + (parseFloat(value) || 0), 0) > 100 ? 
                    'Warning: Total exceeds 100%' : 'Ideal total: ~100%'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsNutrientModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveNutrientMix}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
};

// ... (keep the same styles object as before)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 14, marginBottom: 20, color: '#666' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333', marginTop: 20 },

  // Dosing Pump Styles
  dosingPumpCard: {
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
  dosingPumpInfo: { flex: 1 },
  dosingPumpName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  dosingPumpId: { fontSize: 12, color: '#007AFF', marginBottom: 4, fontWeight: '600' },
  dosingPumpStatus: { fontSize: 14, fontWeight: '600' },

  // Tank Styles
  tankCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tankInfo: { flex: 1 },
  tankName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  tankId: { fontSize: 12, color: '#007AFF', marginBottom: 4, fontWeight: '600' },
  tankVolume: { fontSize: 14, color: '#666', marginBottom: 8 },
  tankStatus: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  nutrientGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 8,
  },
  nutrientItem: { fontSize: 12, color: '#666', marginRight: 15, marginBottom: 4 },
  tankControls: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  editButton: { backgroundColor: '#6c757d', padding: 8, borderRadius: 6, marginTop: 8 },
  editButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  controls: { alignItems: 'center', minWidth: 50 },

  // Nutrient Mix Styles
  nutrientMixCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  nutrientMixTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#2E7D32' },
  nutrientMixSubtitle: { fontSize: 12, color: '#666', marginBottom: 10 },
  nutrientMixGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  nutrientMixItem: { width: '48%', marginBottom: 10 },
  nutrientMixLabel: { fontSize: 12, color: '#666', marginBottom: 2 },
  nutrientMixValue: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32' },

  // Button Styles
  detailsButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  detailsButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // Modal Styles
  modal: { justifyContent: 'flex-end', margin: 0 },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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

  // Sensor Grid
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

  // Tank Levels
  tankLevelsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  tankLevelsGrid: { marginBottom: 20 },
  tankLevelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  tankLevelLabel: { fontSize: 14, color: '#666' },
  tankLevelValue: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },

  // Nutrient Edit Modal Styles
  nutrientEditScroll: {
    maxHeight: 400,
    marginBottom: 15,
  },
  nutrientEditGrid: {
    marginBottom: 20,
  },
  nutrientEditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  nutrientEditLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  nutrientInput: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    width: 80,
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    marginHorizontal: 8,
  },
  nutrientUnit: {
    fontSize: 14,
    color: '#666',
    width: 30,
  },
  
  // Total Section
  totalSection: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 5,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  totalNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Modal Buttons
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  refreshButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default FertigationScreen;