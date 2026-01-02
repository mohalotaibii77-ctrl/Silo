import { NavigationProp } from '@react-navigation/native';

/**
 * Safely navigates back if possible, otherwise navigates to the appropriate dashboard
 * based on the current user's role stored in AsyncStorage
 */
export const safeGoBack = async (navigation: NavigationProp<any>) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    // If can't go back, navigate to appropriate dashboard
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const userData = await AsyncStorage.getItem('user');
      
      if (userData) {
        const user = JSON.parse(userData);
        
        // Navigate based on user role
        switch (user.role) {
          case 'owner':
            navigation.navigate('OwnerDashboard' as never);
            break;
          case 'operations_manager':
          case 'manager':
          case 'employee':
            navigation.navigate('StaffDashboard' as never);
            break;
          case 'pos':
          case 'cashier':
            navigation.navigate('POSTerminal' as never);
            break;
          case 'kitchen_display':
            navigation.navigate('KitchenDisplay' as never);
            break;
          default:
            navigation.navigate('Login' as never);
        }
      } else {
        navigation.navigate('Login' as never);
      }
    } catch (error) {
      console.error('Error in safeGoBack:', error);
      // Fallback to login if error
      navigation.navigate('Login' as never);
    }
  }
};




