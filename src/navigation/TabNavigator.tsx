import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Import your screen components
import HomeScreen from '../screens/HomeScreen';
import MotorsScreen from '../screens/MotorsScreen';
import ValvesScreen from '../screens/ValvesScreen';
import FertigationScreen from '../screens/FertigationScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type TabParamList = {
  Home: undefined;
  Motors: undefined;
  Valves: undefined;
  Fertigation: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Motors') {
            iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
          } else if (route.name === 'Valves') {
            iconName = focused ? 'water' : 'water-outline';
          } else if (route.name === 'Fertigation') {
            iconName = focused ? 'leaf' : 'leaf-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Web-specific tab bar styling
        ...(Platform.OS === 'web' && {
          tabBarStyle: {
            position: 'fixed' as const,
            bottom: 0,
            left: 0,
            right: 0,
          },
        }),
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="Motors" 
        component={MotorsScreen}
        options={{ title: 'Motors' }}
      />
      <Tab.Screen 
        name="Valves" 
        component={ValvesScreen}
        options={{ title: 'Valves' }}
      />
      <Tab.Screen 
        name="Fertigation" 
        component={FertigationScreen}
        options={{ title: 'Fertigation' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;