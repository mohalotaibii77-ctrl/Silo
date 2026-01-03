/**
 * MAP PICKER COMPONENT
 * Allows users to pick a location on a map for branch geofencing
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Crosshair, MapPin } from 'lucide-react-native';
import locationService from '../services/LocationService';

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onLocationSelect: (lat: number, lng: number) => void;
  isRTL?: boolean;
  language?: string;
  colors: {
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
  };
}

// Default location (Kuwait City)
const DEFAULT_LOCATION = {
  latitude: 29.3759,
  longitude: 47.9774,
};

export default function MapPicker({
  latitude,
  longitude,
  radiusMeters = 100,
  onLocationSelect,
  isRTL = false,
  language = 'en',
  colors,
}: MapPickerProps) {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(
    latitude && longitude ? { latitude, longitude } : null
  );

  const initialRegion: Region = {
    latitude: latitude || DEFAULT_LOCATION.latitude,
    longitude: longitude || DEFAULT_LOCATION.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  // Update marker when props change
  useEffect(() => {
    if (latitude && longitude) {
      setMarkerPosition({ latitude, longitude });
      // Animate to new location
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [latitude, longitude]);

  const handleMapPress = (event: any) => {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    setMarkerPosition({ latitude: lat, longitude: lng });
    onLocationSelect(lat, lng);
  };

  const handleMarkerDrag = (event: any) => {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    setMarkerPosition({ latitude: lat, longitude: lng });
    onLocationSelect(lat, lng);
  };

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const result = await locationService.getCurrentLocation();
      if (result.success && result.location) {
        const { latitude: lat, longitude: lng } = result.location;
        setMarkerPosition({ latitude: lat, longitude: lng });
        onLocationSelect(lat, lng);

        // Animate map to new location
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      } else {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          result.error || (language === 'ar' ? 'فشل في الحصول على الموقع' : 'Failed to get location')
        );
      }
    } catch (error) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل في الحصول على الموقع' : 'Failed to get location'
      );
    } finally {
      setGettingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={[styles.mapContainer, { borderColor: colors.border }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          onMapReady={() => setIsLoading(false)}
          showsUserLocation
          showsMyLocationButton={false}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        >
          {markerPosition && (
            <>
              <Marker
                coordinate={markerPosition}
                draggable
                onDragEnd={handleMarkerDrag}
              />
              <Circle
                center={markerPosition}
                radius={radiusMeters}
                strokeColor="rgba(59, 130, 246, 0.8)"
                fillColor="rgba(59, 130, 246, 0.2)"
                strokeWidth={2}
              />
            </>
          )}
        </MapView>

        {/* Loading overlay */}
        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.muted }]}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        )}

        {/* Get current location button */}
        <TouchableOpacity
          style={[
            styles.locationButton,
            { backgroundColor: colors.background, borderColor: colors.border },
            isRTL ? { left: 12 } : { right: 12 },
          ]}
          onPress={getCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Crosshair size={22} color={colors.foreground} />
          )}
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={[styles.instructions, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <MapPin size={16} color={colors.mutedForeground} />
        <Text style={[styles.instructionsText, { color: colors.mutedForeground }, isRTL && { textAlign: 'right' }]}>
          {language === 'ar'
            ? 'انقر على الخريطة لتحديد الموقع، أو اسحب العلامة للتعديل. الدائرة الزرقاء تمثل نطاق السياج الجغرافي.'
            : 'Tap on the map to set location, or drag the marker to adjust. The blue circle shows the geofence area.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButton: {
    position: 'absolute',
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
