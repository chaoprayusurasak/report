import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon with theme color
const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

function FlyToLocation({ position }) {
  const map = useMap();
  if (position) {
    map.flyTo(position, 16, { duration: 1.5 });
  }
  return null;
}

export default function MapPicker({ position, setPosition }) {
  const [locating, setLocating] = useState(false);

  // Default center: Sriracha/Chaophraya Surasak, Chonburi, Thailand
  const defaultCenter = [13.1500, 100.9800];
  const defaultZoom = 13;

  const handleLocationSelect = useCallback((latlng) => {
    setPosition({ lat: latlng.lat, lng: latlng.lng });
  }, [setPosition]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        alert('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS หรือคลิกเลือกบนแผนที่');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClearLocation = () => {
    setPosition(null);
  };

  return (
    <div className="form-group">
      <label className="form-label">📍 ตำแหน่งบนแผนที่ <span className="required">*</span></label>
      <p className="form-hint">คลิกบนแผนที่เพื่อเลือกตำแหน่งที่ต้องการแจ้ง หรือใช้ตำแหน่งปัจจุบัน</p>

      <div className="map-controls">
        <button
          type="button"
          className={`map-btn ${locating ? 'active' : ''}`}
          onClick={handleUseCurrentLocation}
          disabled={locating}
          id="btn-current-location"
        >
          {locating ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(85,187,176,0.3)', borderTopColor: '#55bbb0' }}></span>
              กำลังค้นหา...
            </>
          ) : (
            <>📍 ใช้ตำแหน่งปัจจุบัน</>
          )}
        </button>
        {position && (
          <button
            type="button"
            className="map-btn"
            onClick={handleClearLocation}
            id="btn-clear-location"
          >
            ✕ ล้างตำแหน่ง
          </button>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          center={position ? [position.lat, position.lng] : defaultCenter}
          zoom={position ? 16 : defaultZoom}
          scrollWheelZoom={true}
          style={{ height: '300px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ClickHandler onLocationSelect={handleLocationSelect} />
          {position && (
            <>
              <Marker position={[position.lat, position.lng]} icon={customIcon} />
              <FlyToLocation position={[position.lat, position.lng]} />
            </>
          )}
        </MapContainer>
      </div>

      {position && (
        <p className="map-coords">
          📌 พิกัด: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
