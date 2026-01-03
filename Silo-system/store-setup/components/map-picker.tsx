'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  radiusMeters?: number;
  className?: string;
  isRTL?: boolean;
}

export default function MapPicker({
  latitude,
  longitude,
  onLocationSelect,
  radiusMeters = 100,
  className = '',
  isRTL = false,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Default location (Kuwait City) if no coordinates provided
  const defaultLat = latitude || 29.3759;
  const defaultLng = longitude || 47.9774;

  // Memoized function to add or update marker
  const addOrUpdateMarker = useCallback((L: any, map: any, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      }
    } else {
      const marker = L.marker([lat, lng], {
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onLocationSelect(pos.lat, pos.lng);
        if (circleRef.current) {
          circleRef.current.setLatLng(pos);
        }
      });

      markerRef.current = marker;

      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      circleRef.current = circle;
    }
  }, [onLocationSelect, radiusMeters]);

  useEffect(() => {
    // Prevent double initialization
    if (isInitializedRef.current) return;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      // Check if container already has a map
      if ((mapContainerRef.current as any)._leaflet_id) {
        return;
      }

      isInitializedRef.current = true;

      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      leafletRef.current = L;

      // Fix default marker icon issue with Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 17,
        zoomControl: true,
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add marker if we have coordinates
      if (latitude && longitude) {
        addOrUpdateMarker(L, map, latitude, longitude);
      }

      // Click to place marker
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        addOrUpdateMarker(L, map, lat, lng);
        onLocationSelect(lat, lng);
      });

      mapInstanceRef.current = map;
      setIsLoading(false);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        leafletRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []); // Empty deps - only run once on mount

  // Update circle radius when it changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMeters);
    }
  }, [radiusMeters]);

  // Update marker position when coordinates change externally
  useEffect(() => {
    if (mapInstanceRef.current && leafletRef.current && latitude && longitude) {
      addOrUpdateMarker(leafletRef.current, mapInstanceRef.current, latitude, longitude);
      mapInstanceRef.current.setView([latitude, longitude], 17);
    }
  }, [latitude, longitude, addOrUpdateMarker]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(isRTL ? 'الموقع الجغرافي غير مدعوم في متصفحك' : 'Geolocation is not supported by your browser');
      return;
    }

    // Check if running on localhost without HTTPS
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecure = window.location.protocol === 'https:';

    setGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        if (mapInstanceRef.current && leafletRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
          addOrUpdateMarker(leafletRef.current, mapInstanceRef.current, lat, lng);
        }

        onLocationSelect(lat, lng);
        setGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error.code, error.message);
        setGettingLocation(false);

        // Provide specific error messages based on error code
        let errorMessage = '';
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = isRTL
              ? 'تم رفض الوصول إلى الموقع. يرجى السماح بالوصول إلى الموقع في إعدادات المتصفح.'
              : 'Location access denied. Please allow location access in your browser settings.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = isRTL
              ? 'الموقع غير متاح. تأكد من تفعيل خدمات الموقع على جهازك.'
              : 'Location unavailable. Make sure location services are enabled on your device.';
            break;
          case 3: // TIMEOUT
            errorMessage = isRTL
              ? 'انتهت مهلة طلب الموقع. حاول مرة أخرى.'
              : 'Location request timed out. Please try again.';
            break;
          default:
            if (!isSecure && !isLocalhost) {
              errorMessage = isRTL
                ? 'الموقع الجغرافي يتطلب اتصال HTTPS آمن.'
                : 'Geolocation requires a secure HTTPS connection.';
            } else {
              errorMessage = isRTL
                ? 'تعذر الحصول على موقعك. يمكنك النقر على الخريطة لتحديد الموقع يدوياً.'
                : 'Unable to get your location. You can click on the map to set the location manually.';
            }
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-72 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
        style={{ minHeight: '288px' }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      )}

      {/* Controls */}
      <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} z-[1000] flex flex-col gap-2`}>
        <button
          onClick={getCurrentLocation}
          disabled={gettingLocation || isLoading}
          className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          title={isRTL ? 'الحصول على موقعي الحالي' : 'Get my current location'}
        >
          {gettingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600 dark:text-zinc-400" />
          ) : (
            <Crosshair className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          )}
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          {isRTL
            ? 'انقر على الخريطة لوضع دبوس الموقع، أو اسحب الدبوس لتعديل الموقع. الدائرة الزرقاء تمثل نطاق السياج الجغرافي.'
            : 'Click on the map to place a location pin, or drag the pin to adjust. The blue circle shows the geofence area.'}
        </p>
      </div>
    </div>
  );
}
