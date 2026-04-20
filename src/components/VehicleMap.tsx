import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CarStatus } from '../types';
import { Navigation, Clock, MapPin, History } from 'lucide-react';
import { format } from 'date-fns';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface VehicleMapProps {
  vehicles: CarStatus[];
  selectedVehicle?: CarStatus | null;
  onSelectVehicle?: (vehicle: CarStatus) => void;
  onViewHistory?: (vehicle: CarStatus) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  darkMode?: boolean;
}

// Component to handle map center and zoom updates
const MapUpdater: React.FC<{ 
  center?: { lat: number; lng: number }; 
  zoom?: number;
  selectedId?: string;
}> = ({ center, zoom, selectedId }) => {
  const map = useMap();
  const lastSelectedIdRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    if (center) {
      const isNewSelection = selectedId !== lastSelectedIdRef.current;
      
      // If it's a new vehicle selection, we "fly to" it with the requested zoom
      if (isNewSelection) {
        lastSelectedIdRef.current = selectedId;
        map.setView([center.lat, center.lng], zoom || map.getZoom(), {
          animate: true,
          duration: 1
        });
      } else {
        // If it's the same vehicle moving, we only update the center 
        // IF the vehicle has moved significantly
        // and we KEEP the current user's zoom level
        const currentCenter = map.getCenter();
        const dist = Math.sqrt(
          Math.pow(currentCenter.lat - center.lat, 2) + 
          Math.pow(currentCenter.lng - center.lng, 2)
        );
        
        // Only auto-follow if the user is already "relatively" close to the vehicle (approx 2km)
        // to avoid snapping back if they panned away to look at another area
        if (dist < 0.02) {
          map.panTo([center.lat, center.lng], {
            animate: true,
            duration: 0.5
          });
        }
      }
    } else {
      lastSelectedIdRef.current = undefined;
    }
  }, [center, zoom, map, selectedId]);

  return null;
};

export const VehicleMap: React.FC<VehicleMapProps> = ({ 
  vehicles, 
  selectedVehicle, 
  onSelectVehicle,
  onViewHistory,
  center,
  zoom = 12,
  darkMode = false
}) => {
  const { t } = useTranslation();
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Bangkok
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  return (
    <MapContainer 
      center={center ? [center.lat, center.lng] : defaultCenter} 
      zoom={zoom} 
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        attribution={darkMode ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        url={darkMode ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      
      <MapUpdater 
        center={center} 
        zoom={zoom} 
        selectedId={selectedVehicle?.carNumber} 
      />

      {vehicles.map((vehicle) => (
        <Marker 
          key={vehicle.carNumber} 
          position={[vehicle.lat, vehicle.lng]}
          eventHandlers={{
            click: () => onSelectVehicle?.(vehicle)
          }}
        >
          <Popup className="custom-popup">
            <div className="p-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">{vehicle.carNumber}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                   vehicle.status === 'online' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
                }`}>
                  {vehicle.status === 'online' ? t('online') : t('offline')}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Navigation className="w-3 h-3 text-slate-400" />
                  <span className="font-medium">{t('speed')}: {vehicle.speed} km/h</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{vehicle.address}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 border-b border-slate-100 pb-2">
                  <Clock className="w-3 h-3" />
                  <span>{t('last_update')}: {format(new Date(vehicle.lastUpdate), 'HH:mm:ss')}</span>
                </div>

                {isAdmin && onViewHistory && (
                  <button
                    onClick={() => onViewHistory(vehicle)}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-200 transition-colors mt-2"
                  >
                    <History className="w-3.5 h-3.5" />
                    {t('trip_history', 'ประวัติการเดินทาง')}
                  </button>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
