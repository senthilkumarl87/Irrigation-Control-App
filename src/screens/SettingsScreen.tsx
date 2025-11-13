import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Settings, loadSettings, saveSettings, resetSettings, MotorConfig, ValveConfig } from '../utils/settings';

const SettingsScreen = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadInitialSettings();
  }, []);

  const loadInitialSettings = async () => {
    const loadedSettings = await loadSettings();
    setSettings(loadedSettings);
    setLocalSettings(loadedSettings);
  };

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
      setSettings(localSettings);
      Alert.alert('Success', 'Settings saved successfully!');
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultSettings = await resetSettings();
            setSettings(defaultSettings);
            setLocalSettings(defaultSettings);
            Alert.alert('Success', 'Settings reset to default!');
          },
        },
      ]
    );
  };

  const updateLocalSetting = (key: keyof Settings, value: string) => {
    if (localSettings) {
      setLocalSettings(prev => ({ ...prev!, [key]: value }));
    }
  };

  const updateDeviceSetting = (type: 'motors' | 'valves', deviceKey: string, field: string, value: string) => {
    if (localSettings) {
      setLocalSettings(prev => ({
        ...prev!,
        [type]: {
          ...prev![type],
          [deviceKey]: {
            ...prev![type][deviceKey],
            [field]: value
          }
        }
      }));
    }
  };

  const addDevice = (type: 'motors' | 'valves') => {
    if (!localSettings) return;

    const devices = localSettings[type];
    const newIndex = Object.keys(devices).length + 1;
    const newKey = `${type.slice(0, -1)}${newIndex}`;
    
    const defaultConfig = type === 'motors' 
      ? { name: `New Motor ${newIndex}`, smsId: `${newIndex}`, smsPrefix: 'M', power: '0 kW' }
      : { name: `New Valve ${newIndex}`, smsId: `${newIndex}`, smsPrefix: 'V', flow: '0 L/min' };

    setLocalSettings(prev => ({
      ...prev!,
      [type]: {
        ...prev![type],
        [newKey]: defaultConfig
      }
    }));
  };

  const deleteDevice = (type: 'motors' | 'valves', deviceKey: string) => {
    if (!localSettings) return;

    const deviceName = localSettings[type][deviceKey].name;
    
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedDevices = { ...localSettings[type] };
            delete updatedDevices[deviceKey];
            
            setLocalSettings(prev => ({
              ...prev!,
              [type]: updatedDevices
            }));
          },
        },
      ]
    );
  };

  const getFullDeviceId = (prefix: string, id: string) => {
    return `${prefix}${id}`;
  };

  if (!settings || !localSettings) {
    return (
      <View style={styles.container}>
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>App Settings</Text>

        {/* Phone Number Setting */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Control Phone Number</Text>
          <Text style={styles.settingDescription}>
            The mobile number that will receive SMS commands
          </Text>
          <TextInput
            style={styles.textInput}
            value={localSettings.phoneNumber}
            onChangeText={(value) => updateLocalSetting('phoneNumber', value)}
            placeholder="Enter phone number with country code"
            keyboardType="phone-pad"
          />
        </View>

        {/* ON Format Setting */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>ON Command Format</Text>
          <Text style={styles.settingDescription}>
            Use {'{prefix}'} for device prefix and {'{deviceId}'} for device number
          </Text>
          <TextInput
            style={styles.textInput}
            value={localSettings.onFormat}
            onChangeText={(value) => updateLocalSetting('onFormat', value)}
            placeholder="e.g., ON {prefix}{deviceId}"
          />
          <Text style={styles.exampleText}>
            Example: "{localSettings.onFormat.replace('{prefix}', 'M').replace('{deviceId}', '1')}"
          </Text>
        </View>

        {/* OFF Format Setting */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>OFF Command Format</Text>
          <Text style={styles.settingDescription}>
            Use {'{prefix}'} for device prefix and {'{deviceId}'} for device number
          </Text>
          <TextInput
            style={styles.textInput}
            value={localSettings.offFormat}
            onChangeText={(value) => updateLocalSetting('offFormat', value)}
            placeholder="e.g., OFF {prefix}{deviceId}"
          />
          <Text style={styles.exampleText}>
            Example: "{localSettings.offFormat.replace('{prefix}', 'M').replace('{deviceId}', '1')}"
          </Text>
        </View>

        {/* Motor Settings */}
        <View style={styles.settingGroup}>
          <View style={styles.sectionHeader}>
            <Text style={styles.settingLabel}>Motor Configuration</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => addDevice('motors')}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
              <Text style={styles.addButtonText}>Add Motor</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingDescription}>
            Configure each motor individually
          </Text>
          {Object.entries(localSettings.motors).map(([key, motor]) => (
            <View key={key} style={styles.deviceSection}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceHeaderText}>Motor {key.replace('motor', '')}</Text>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteDevice('motors', key)}
                >
                  <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
              </View>
              <View style={styles.deviceRow}>
                <TextInput
                  style={[styles.textInput, styles.thirdInput]}
                  value={motor.name}
                  onChangeText={(value) => updateDeviceSetting('motors', key, 'name', value)}
                  placeholder="Motor name"
                />
                <TextInput
                  style={[styles.textInput, styles.sixthInput]}
                  value={motor.smsPrefix}
                  onChangeText={(value) => updateDeviceSetting('motors', key, 'smsPrefix', value)}
                  placeholder="Prefix"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.textInput, styles.sixthInput]}
                  value={motor.smsId}
                  onChangeText={(value) => updateDeviceSetting('motors', key, 'smsId', value)}
                  placeholder="ID"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.textInput, styles.thirdInput]}
                  value={motor.power}
                  onChangeText={(value) => updateDeviceSetting('motors', key, 'power', value)}
                  placeholder="Power"
                />
              </View>
              <Text style={styles.deviceIdPreview}>
                Full SMS ID: {getFullDeviceId(motor.smsPrefix, motor.smsId)}
              </Text>
            </View>
          ))}
          {Object.keys(localSettings.motors).length === 0 && (
            <Text style={styles.noDevicesText}>No motors configured</Text>
          )}
        </View>

        {/* Valve Settings */}
        <View style={styles.settingGroup}>
          <View style={styles.sectionHeader}>
            <Text style={styles.settingLabel}>Valve Configuration</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => addDevice('valves')}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
              <Text style={styles.addButtonText}>Add Valve</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.settingDescription}>
            Configure each valve individually
          </Text>
          {Object.entries(localSettings.valves).map(([key, valve]) => (
            <View key={key} style={styles.deviceSection}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceHeaderText}>Valve {key.replace('valve', '')}</Text>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteDevice('valves', key)}
                >
                  <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
              </View>
              <View style={styles.deviceRow}>
                <TextInput
                  style={[styles.textInput, styles.thirdInput]}
                  value={valve.name}
                  onChangeText={(value) => updateDeviceSetting('valves', key, 'name', value)}
                  placeholder="Valve name"
                />
                <TextInput
                  style={[styles.textInput, styles.sixthInput]}
                  value={valve.smsPrefix}
                  onChangeText={(value) => updateDeviceSetting('valves', key, 'smsPrefix', value)}
                  placeholder="Prefix"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.textInput, styles.sixthInput]}
                  value={valve.smsId}
                  onChangeText={(value) => updateDeviceSetting('valves', key, 'smsId', value)}
                  placeholder="ID"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.textInput, styles.thirdInput]}
                  value={valve.flow}
                  onChangeText={(value) => updateDeviceSetting('valves', key, 'flow', value)}
                  placeholder="Flow"
                />
              </View>
              <Text style={styles.deviceIdPreview}>
                Full SMS ID: {getFullDeviceId(valve.smsPrefix, valve.smsId)}
              </Text>
            </View>
          ))}
          {Object.keys(localSettings.valves).length === 0 && (
            <Text style={styles.noDevicesText}>No valves configured</Text>
          )}
        </View>

        {/* Command Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Command Preview</Text>
          
          <Text style={styles.previewSubtitle}>Motor Commands:</Text>
          {Object.entries(localSettings.motors).slice(0, 2).map(([key, motor]) => (
            <View key={key} style={styles.previewRow}>
              <Text style={styles.previewLabel}>{motor.name}:</Text>
              <View>
                <Text style={styles.previewValue}>
                  ON: {localSettings.onFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId)}
                </Text>
                <Text style={styles.previewValue}>
                  OFF: {localSettings.offFormat.replace('{prefix}', motor.smsPrefix).replace('{deviceId}', motor.smsId)}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.previewSubtitle}>Valve Commands:</Text>
          {Object.entries(localSettings.valves).slice(0, 2).map(([key, valve]) => (
            <View key={key} style={styles.previewRow}>
              <Text style={styles.previewLabel}>{valve.name}:</Text>
              <View>
                <Text style={styles.previewValue}>
                  ON: {localSettings.onFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)}
                </Text>
                <Text style={styles.previewValue}>
                  OFF: {localSettings.offFormat.replace('{prefix}', valve.smsPrefix).replace('{deviceId}', valve.smsId)}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Send to:</Text>
            <Text style={styles.previewValue}>{localSettings.phoneNumber}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  settingGroup: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
  },
  deviceSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  thirdInput: {
    flex: 0.32,
  },
  sixthInput: {
    flex: 0.15,
  },
  deviceIdPreview: {
    fontSize: 12,
    color: '#28a745',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 4,
  },
  noDevicesText: {
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  exampleText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 5,
    fontStyle: 'italic',
  },
  previewCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#007AFF',
  },
  previewSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 5,
    color: '#333',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  previewLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    flex: 0.4,
  },
  previewValue: {
    fontSize: 12,
    color: '#007AFF',
    fontFamily: 'monospace',
    flex: 0.6,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;