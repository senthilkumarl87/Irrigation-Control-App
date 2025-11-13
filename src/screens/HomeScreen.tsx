import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

const HomeScreen = () => {
  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Irrigation Control</Text>
        <Text style={styles.subtitle}>
          Manage your motors, valves, and fertigation systems from one place.
        </Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Status</Text>
          <Text style={styles.cardText}>All systems operational</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <Text style={styles.cardText}>• Check motor status</Text>
          <Text style={styles.cardText}>• Monitor valve positions</Text>
          <Text style={styles.cardText}>• Adjust fertigation mix</Text>
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
  contentContainer: {
    flexGrow: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
  },
  content: {
    padding: 20,
    ...(Platform.OS === 'web' && {
      maxWidth: 800,
      marginHorizontal: 'auto',
      width: '100%',
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: Platform.OS === 'web' ? 'center' : 'left',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
    textAlign: Platform.OS === 'web' ? 'center' : 'left',
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      width: '100%',
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#007AFF',
  },
  cardText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
});

export default HomeScreen;