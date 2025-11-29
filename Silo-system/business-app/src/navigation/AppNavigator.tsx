import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import OwnerDashboardScreen from '../screens/OwnerDashboardScreen';
import PMDashboardScreen from '../screens/PMDashboardScreen';
import EmployeePOSScreen from '../screens/EmployeePOSScreen';
import POSScreen from '../screens/POSScreen';
import StorefrontScreen from '../screens/StorefrontScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
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



