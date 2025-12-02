import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../screens/LoginScreen';
import OwnerDashboardScreen from '../screens/OwnerDashboardScreen';
import PMDashboardScreen from '../screens/PMDashboardScreen';
import EmployeePOSScreen from '../screens/EmployeePOSScreen';
import POSScreen from '../screens/POSScreen';
import StorefrontScreen from '../screens/StorefrontScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Login');

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        // Navigate based on user role
        switch (user.role) {
          case 'owner':
            setInitialRoute('OwnerDashboard');
            break;
          case 'operations_manager':
          case 'manager':
            setInitialRoute('PMDashboard');
            break;
          case 'pos':
          case 'cashier':
            setInitialRoute('POSTerminal');
            break;
          case 'employee':
            setInitialRoute('EmployeePOS');
            break;
          default:
            setInitialRoute('Login');
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
        <Stack.Screen name="PMDashboard" component={PMDashboardScreen} />
        <Stack.Screen name="EmployeePOS" component={EmployeePOSScreen} />
        <Stack.Screen name="POSTerminal" component={POSScreen} />
        <Stack.Screen name="Storefront" component={StorefrontScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});



