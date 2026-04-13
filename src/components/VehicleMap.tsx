import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CarStatus } from '../types';
import { Navigation, Clock, MapPin } from 'lucide-react';
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
  center?: { lat: number; lng: number };
  zoom?: number;
  darkMode?: boolean;
}

// Component to handle map center and zoom updates
const MapUpdater: React.FC<{ center?: { lat: number; lng: number }; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom(), {
        animate: true
      });
    }
  }, [center, zoom, map]);

  return null;
};

export const VehicleMap: React.FC<VehicleMapProps> = ({ 
  vehicles, 
  selectedVehicle, 
  onSelectVehicle,
  center,
  zoom = 12,
  darkMode = false
}) => {
  const { t } = useTranslation();
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Bangkok

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
      
      <MapUpdater center={center} zoom={zoom} />

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
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{t('last_update')}: {format(new Date(vehicle.lastUpdate), 'HH:mm:ss')}</span>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
