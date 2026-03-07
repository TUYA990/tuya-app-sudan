import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import io from 'socket.io-client';

// Use a relative address or the public URL if possible
const socket = io('https://4000-indslolhcjso963gwvxk2-af8742ef.sg1.manus.computer');

function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => onClick(e.latlng),
  });
  return null;
}

function App() {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [status, setStatus] = useState('idle');
  const [rideInfo, setRideInfo] = useState(null);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    socket.on('ride_accepted', (data) => {
      setStatus('accepted');
      setRideInfo(data);
    });
  }, []);

  useEffect(() => {
    if (pickup && destination) {
        // Simple distance calculation
        const dist = Math.sqrt(Math.pow(pickup.lat - destination.lat, 2) + Math.pow(pickup.lng - destination.lng, 2)) * 111;
        setPrice(Math.round(dist * 500 + 300)); // 300 base + 500 per km
    }
  }, [pickup, destination]);

  const handleRequestRide = () => {
    if (pickup && destination) {
      setStatus('requesting');
      socket.emit('request_ride', { pickup, destination, price });
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fbc02d', padding: '10px', textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>TUYA - خدمة التوصيل</h1>
      </header>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[15.5007, 32.5599]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onClick={(latlng) => {
            if (!pickup) setPickup(latlng);
            else if (!destination) setDestination(latlng);
          }} />
          {pickup && <Marker position={pickup}><Popup>موقع الانطلاق</Popup></Marker>}
          {destination && <Marker position={destination}><Popup>الوجهة</Popup></Marker>}
        </MapContainer>

        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 1000, background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.2)' }}>
          {status === 'idle' && (
            <div>
              {!pickup && <p>حدد موقع البداية على الخريطة</p>}
              {pickup && !destination && <p>حدد وجهتك الآن</p>}
              {pickup && destination && (
                <div>
                  <p>التكلفة المقدرة: <b>{price} جنيه سوداني</b></p>
                  <button onClick={handleRequestRide} style={{ width: '100%', padding: '10px', background: 'black', color: 'white', border: 'none', borderRadius: '5px' }}>تأكيد الطلب</button>
                </div>
              )}
            </div>
          )}
          {status === 'requesting' && <p>جاري البحث عن سائق...</p>}
          {status === 'accepted' && (
            <div>
              <h3>تم العثور على سائق!</h3>
              <p><b>الاسم:</b> {rideInfo.driver.name}</p>
              <p><b>السيارة:</b> {rideInfo.driver.vehicle}</p>
              <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '10px', background: '#ccc', border: 'none', borderRadius: '5px' }}>إلغاء</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
