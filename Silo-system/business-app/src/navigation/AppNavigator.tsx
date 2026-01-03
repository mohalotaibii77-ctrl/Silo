import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all screens directly - no lazy loading
// React Native doesn't benefit from lazy loading like web does
// because the bundle is already on the device
import LoginScreen from '../screens/LoginScreen';
import SetPasswordScreen from '../screens/SetPasswordScreen';
import OwnerDashboardScreen from '../screens/OwnerDashboardScreen';
import PMDashboardScreen from '../screens/PMDashboardScreen';
import StaffDashboardScreen from '../screens/StaffDashboardScreen';
import POSScreen from '../screens/POSScreen';
import KitchenDisplayScreen from '../screens/KitchenDisplayScreen';
import EmployeePOSScreen from '../screens/EmployeePOSScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import ItemsScreen from '../screens/ItemsScreen';
import ProductsScreen from '../screens/ProductsScreen';
import ItemsProductsScreen from '../screens/ItemsProductsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import InventoryScreen from '../screens/InventoryScreen';
import StaffManagementScreen from '../screens/StaffManagementScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import BundlesScreen from '../screens/BundlesScreen';
import TablesScreen from '../screens/TablesScreen';
import DriversScreen from '../screens/DriversScreen';
import DeliveryPartnersScreen from '../screens/DeliveryPartnersScreen';
import DiscountsScreen from '../screens/DiscountsScreen';
import PODetailScreen from '../screens/PODetailScreen';
import POCountingScreen from '../screens/POCountingScreen';
import POReceivingScreen from '../screens/POReceivingScreen';
import HRScreen from '../screens/HRScreen';

import { dataPreloader } from '../services/DataPreloader';
import { idleTimeout } from '../services/IdleTimeout';
import { cacheManager } from '../services/CacheManager';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Login');
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const routeNameRef = useRef<string>('');

  // Navigate to login callback for idle timeout
  const navigateToLogin = useCallback((screen: string) => {
    if (navigationRef.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: screen }],
      });
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, []);

  // Cleanup idle timeout on unmount
  useEffect(() => {
    return () => {
      idleTimeout.stop();
    };
  }, []);

  const checkAuthState = async () => {
    try {
      // Warm up cache from AsyncStorage to memory for instant access
      await cacheManager.warmUp();
      
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        
        // Start background preloading of data (not screens)
        dataPreloader.preloadAll().catch(console.error);
        
        // Navigate based on user role
        switch (user.role) {
          case 'owner':
            setInitialRoute('OwnerDashboard');
            break;
          case 'operations_manager':
          case 'manager':
            setInitialRoute('StaffDashboard');
            break;
          case 'pos':
          case 'cashier':
            setInitialRoute('POSTerminal');
            break;
          case 'kitchen_display':
            setInitialRoute('KitchenDisplay');
            break;
          case 'employee':
            setInitialRoute('StaffDashboard');
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

  // Handle navigation state changes for idle timeout
  const onNavigationReady = () => {
    const currentRoute = navigationRef.current?.getCurrentRoute();
    const currentRouteName = currentRoute?.name ?? '';
    routeNameRef.current = currentRouteName;
    
    // Start idle timeout monitoring
    idleTimeout.start(currentRouteName, navigateToLogin);
  };

  const onNavigationStateChange = () => {
    const previousRouteName = routeNameRef.current;
    const currentRoute = navigationRef.current?.getCurrentRoute();
    const currentRouteName = currentRoute?.name ?? '';

    if (previousRouteName !== currentRouteName) {
      // Update idle timeout with new screen
      idleTimeout.updateScreen(currentRouteName);
    }

    routeNameRef.current = currentRouteName;
  };

  // Create activity tracker pan responder
  const activityTracker = idleTimeout.createActivityTracker();

  return (
    <View style={{ flex: 1 }} {...activityTracker.panHandlers}>
      <NavigationContainer 
        ref={navigationRef}
        onReady={onNavigationReady}
        onStateChange={onNavigationStateChange}
      >
        <Stack.Navigator 
          initialRouteName={initialRoute} 
          screenOptions={{ 
            headerShown: false,
            // Faster, snappier animations
            animation: 'slide_from_right',
            animationDuration: 200,
          }}
        >
          {/* Auth screens */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
          
          {/* Dashboard screens */}
          <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
          <Stack.Screen name="PMDashboard" component={PMDashboardScreen} />
          <Stack.Screen name="StaffDashboard" component={StaffDashboardScreen} />
          
          {/* POS screens */}
          <Stack.Screen name="POSTerminal" component={POSScreen} />
          <Stack.Screen name="EmployeePOS" component={EmployeePOSScreen} />
          <Stack.Screen name="KitchenDisplay" component={KitchenDisplayScreen} />
          
          {/* Management screens */}
          <Stack.Screen name="Items" component={ItemsScreen} />
          <Stack.Screen name="Products" component={ProductsScreen} />
          <Stack.Screen name="ItemsProducts" component={ItemsProductsScreen} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Categories" component={CategoriesScreen} />
          <Stack.Screen name="Bundles" component={BundlesScreen} />
          
          {/* Staff & Settings */}
          <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Requests" component={RequestsScreen} />
          <Stack.Screen name="HR" component={HRScreen} />
          
          {/* Tables & Delivery */}
          <Stack.Screen name="Tables" component={TablesScreen} />
          <Stack.Screen name="Drivers" component={DriversScreen} />
          <Stack.Screen name="DeliveryPartners" component={DeliveryPartnersScreen} />
          <Stack.Screen name="Discounts" component={DiscountsScreen} />
          
          {/* Purchase Order screens */}
          <Stack.Screen name="PODetail" component={PODetailScreen} />
          <Stack.Screen name="POCounting" component={POCountingScreen} />
          <Stack.Screen name="POReceiving" component={POReceivingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
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
