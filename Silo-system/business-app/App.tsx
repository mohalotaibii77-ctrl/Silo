import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { LocalizationProvider } from './src/localization/LocalizationContext';
import { ConfigProvider } from './src/context/ConfigContext';

function AppContent() {
  const { isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeRTL();
  }, []);

  const initializeRTL = async () => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (businessStr) {
        const business = JSON.parse(businessStr);
        const isArabic = business.language === 'ar';
        
        // Only force RTL if it doesn't match current state
        if (isArabic !== I18nManager.isRTL) {
          I18nManager.allowRTL(isArabic);
          I18nManager.forceRTL(isArabic);
          // Note: Changes will apply on next app restart
        }
      }
    } catch (error) {
      console.error('Error initializing RTL:', error);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#09090b' : '#fafafa' }}>
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#09090b'} />
      </View>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <LocalizationProvider>
          <AppContent />
        </LocalizationProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}
