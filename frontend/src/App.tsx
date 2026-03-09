import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://tuya-backend-final.onrender.com');

// ==================== Map Click Handler ====================
function MapClickHandler({ onClick, isSelecting }) {
  useMapEvents({
    click: (e) => {
      if (isSelecting) {
        onClick(e.latlng);
      }
    },
  });
  return null;
}

// ==================== Login Screen ====================
function LoginScreen({ onLoginPassenger, onLoginDriver }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isDriver, setIsDriver] = useState(false);
  const [vehicle, setVehicle] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name || !phone) {
      alert('الرجاء إدخال الاسم ورقم الهاتف');
      return;
    }

    if (isDriver && (!vehicle || !plateNumber)) {
      alert('الرجاء إدخال بيانات المركبة');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isDriver ? '/api/auth/driver' : '/api/auth/user';
      const payload = isDriver
        ? { name, phone, vehicle, plateNumber }
        : { name, phone };

      const response = await fetch(`https://tuya-backend-final.onrender.com${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const user = await response.json();

      if (isDriver) {
        onLoginDriver(user);
      } else {
        onLoginPassenger(user);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('حدث خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <h2 style={styles.title}>TUYA - خدمة التوصيل</h2>
        
        <div style={styles.toggleButtons}>
          <button
            onClick={() => setIsDriver(false)}
            style={{
              ...styles.toggleButton,
              background: !isDriver ? '#fbc02d' : '#ddd',
              color: !isDriver ? '#fff' : '#000',
            }}
          >
            راكب
          </button>
          <button
            onClick={() => setIsDriver(true)}
            style={{
              ...styles.toggleButton,
              background: isDriver ? '#fbc02d' : '#ddd',
              color: isDriver ? '#fff' : '#000',
            }}
          >
            سائق
          </button>
        </div>

        <input
          type="text"
          placeholder="الاسم"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />
        <input
          type="tel"
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={styles.input}
        />

        {isDriver && (
          <>
            <input
              type="text"
              placeholder="نوع المركبة (مثل: تويوتا كامري)"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="رقم لوحة المركبة"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              style={styles.input}
            />
          </>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'جاري التحميل...' : 'دخول'}
        </button>
      </div>
    </div>
  );
}

// ==================== Passenger Screen ====================
function PassengerScreen({ user, onLogout }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [status, setStatus] = useState('idle');
  const [rideInfo, setRideInfo] = useState(null);
  const [price, setPrice] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [mapCenter, setMapCenter] = useState([15.5527, 32.5599]); // Khartoum
  const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'destination'
  const [pickupName, setPickupName] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    socket.on('ride_accepted', (data) => {
      setStatus('accepted');
      setRideInfo(data);
    });

    socket.on('ride_completed', (data) => {
      setStatus('completed');
      setRideInfo(data);
    });

    return () => {
      socket.off('ride_accepted');
      socket.off('ride_completed');
    };
  }, []);

  useEffect(() => {
    if (pickup && destination) {
      const dist = Math.sqrt(
        Math.pow(pickup.lat - destination.lat, 2) +
          Math.pow(pickup.lng - destination.lng, 2)
      ) * 111;
      setPrice(Math.round(dist * 500 + 300));
    }
  }, [pickup, destination]);

  // Get current location automatically
  const handleGetCurrentLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPickup({ lat: latitude, lng: longitude });
          setPickupName(`موقعك الحالي (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setMapCenter([latitude, longitude]);
          setSelectionMode(null);
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('لم نتمكن من الوصول إلى موقعك. الرجاء التحقق من صلاحيات الموقع.');
          setIsGettingLocation(false);
        }
      );
    } else {
      alert('المتصفح الخاص بك لا يدعم الموقع الجغرافي');
      setIsGettingLocation(false);
    }
  };

  // Handle map click for manual location selection
  const handleMapClick = (latlng) => {
    if (selectionMode === 'pickup') {
      setPickup(latlng);
      setPickupName(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
      setSelectionMode(null);
    } else if (selectionMode === 'destination') {
      setDestination(latlng);
      setDestinationName(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
      setSelectionMode(null);
    }
  };

  const handleRequestRide = () => {
    if (pickup && destination) {
      setStatus('requesting');
      socket.emit('request_ride', {
        passengerId: user.id,
        passengerName: user.name,
        passengerPhone: user.phone,
        pickupLocation: pickup,
        dropoffLocation: destination,
        estimatedPrice: price,
      });
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      alert('الرجاء اختيار تقييم');
      return;
    }

    try {
      await fetch('https://tuya-backend-final.onrender.com/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: rideInfo.id,
          driverId: rideInfo.driverId,
          passengerId: user.id,
          rating,
          comment,
        }),
      });

      alert('شكراً لتقييمك!');
      setStatus('idle');
      setRideInfo(null);
      setPickup(null);
      setDestination(null);
      setPickupName('');
      setDestinationName('');
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Rating error:', error);
      alert('حدث خطأ في إرسال التقييم');
    }
  };

  if (status === 'completed') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1>TUYA - خدمة التوصيل</h1>
          <button onClick={onLogout} style={styles.logoutButton}>
            تسجيل خروج
          </button>
        </header>

        <div style={styles.ratingContainer}>
          <h2>قيّم السائق</h2>
          <div style={styles.driverInfo}>
            <p><strong>السائق:</strong> {rideInfo.driver.name}</p>
            <p><strong>المركبة:</strong> {rideInfo.driver.vehicle}</p>
            <p><strong>التقييم الحالي:</strong> ⭐ {rideInfo.driver.rating}</p>
          </div>

          <div style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                style={{
                  ...styles.star,
                  color: star <= rating ? '#fbc02d' : '#ddd',
                }}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            placeholder="أضف تعليق (اختياري)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={styles.textarea}
          />

          <button onClick={handleSubmitRating} style={styles.button}>
            إرسال التقييم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>TUYA - خدمة التوصيل</h1>
        <div>
          <span style={styles.userInfo}>مرحباً: {user.name}</span>
          <button onClick={onLogout} style={styles.logoutButton}>
            تسجيل خروج
          </button>
        </div>
      </header>

      <div style={styles.mainContent}>
        <MapContainer center={mapCenter} zoom={13} style={styles.map}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler
            onClick={handleMapClick}
            isSelecting={selectionMode !== null}
          />
          {pickup && <Marker position={[pickup.lat, pickup.lng]} />}
          {destination && <Marker position={[destination.lat, destination.lng]} />}
        </MapContainer>

        <div style={styles.sidebar}>
          <h3>تفاصيل الرحلة</h3>

          {/* Pickup Location Section */}
          <div style={styles.locationSection}>
            <h4>🚩 نقطة الالتقاط (البداية)</h4>
            {!pickup ? (
              <div>
                <p style={styles.instructionText}>اختر طريقة تحديد موقعك:</p>
                <button
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  style={{
                    ...styles.locationButton,
                    background: '#4caf50',
                  }}
                >
                  {isGettingLocation ? '⏳ جاري التحديد...' : '📍 استخدم موقعي الحالي'}
                </button>
                <button
                  onClick={() => setSelectionMode('pickup')}
                  style={{
                    ...styles.locationButton,
                    background: '#2196f3',
                  }}
                >
                  🗺️ اختر من الخريطة
                </button>
              </div>
            ) : (
              <div>
                <p style={styles.selectedLocation}>✅ {pickupName}</p>
                <button
                  onClick={() => setPickup(null)}
                  style={styles.changeButton}
                >
                  تغيير الموقع
                </button>
              </div>
            )}
            {selectionMode === 'pickup' && (
              <p style={styles.selectingText}>👆 انقر على الخريطة لتحديد موقع الالتقاط</p>
            )}
          </div>

          {/* Destination Location Section */}
          <div style={styles.locationSection}>
            <h4>🏁 نقطة النزول (النهاية)</h4>
            {!destination ? (
              <button
                onClick={() => setSelectionMode('destination')}
                disabled={!pickup}
                style={{
                  ...styles.locationButton,
                  background: '#2196f3',
                  opacity: !pickup ? 0.5 : 1,
                }}
              >
                🗺️ اختر من الخريطة
              </button>
            ) : (
              <div>
                <p style={styles.selectedLocation}>✅ {destinationName}</p>
                <button
                  onClick={() => setDestination(null)}
                  style={styles.changeButton}
                >
                  تغيير الموقع
                </button>
              </div>
            )}
            {selectionMode === 'destination' && (
              <p style={styles.selectingText}>👆 انقر على الخريطة لتحديد موقع النزول</p>
            )}
          </div>

          {/* Price and Ride Request */}
          {pickup && destination && (
            <div style={styles.priceSection}>
              <p style={styles.priceText}>
                <strong>السعر المقدر:</strong> {price} جنيه سوداني
              </p>

              {status === 'idle' && (
                <button
                  onClick={handleRequestRide}
                  style={styles.button}
                >
                  طلب رحلة
                </button>
              )}

              {status === 'requesting' && (
                <div style={styles.statusMessage}>
                  <p>🔄 جاري البحث عن سائق...</p>
                </div>
              )}

              {status === 'accepted' && rideInfo && (
                <div style={styles.driverCard}>
                  <h4>✅ تم قبول الطلب!</h4>
                  <p><strong>السائق:</strong> {rideInfo.driver.name}</p>
                  <p><strong>المركبة:</strong> {rideInfo.driver.vehicle}</p>
                  <p><strong>رقم اللوحة:</strong> {rideInfo.driver.plateNumber}</p>
                  <p><strong>التقييم:</strong> ⭐ {rideInfo.driver.rating}</p>
                  <p><strong>رقم الهاتف:</strong> {rideInfo.driver.phone}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Driver Screen ====================
function DriverScreen({ user, onLogout }) {
  const [isOnline, setIsOnline] = useState(false);
  const [availableRides, setAvailableRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverStats, setDriverStats] = useState({ totalRides: 0, rating: 5.0 });

  useEffect(() => {
    if (isOnline) {
      socket.emit('driver_online', user.id);

      // Get driver location
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
          const { latitude, longitude } = position.coords;
          setDriverLocation({ lat: latitude, lng: longitude });
          socket.emit('driver_location', {
            driverId: user.id,
            lat: latitude,
            lng: longitude,
          });
        });
      }
    } else {
      socket.emit('driver_offline', user.id);
    }

    socket.on('new_ride_available', (ride) => {
      if (!currentRide) {
        setAvailableRides((prev) => [...prev, ride]);
      }
    });

    socket.on('ride_completed', (ride) => {
      if (ride.driverId === user.id) {
        setCurrentRide(null);
        setAvailableRides([]);
      }
    });

    return () => {
      socket.off('new_ride_available');
      socket.off('ride_completed');
    };
  }, [isOnline, user.id, currentRide]);

  const handleAcceptRide = (ride) => {
    socket.emit('accept_ride', { rideId: ride.id, driverId: user.id });
    setCurrentRide(ride);
    setAvailableRides([]);
  };

  const handleCompleteRide = () => {
    if (currentRide) {
      socket.emit('ride_completed', { rideId: currentRide.id });
      setCurrentRide(null);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>TUYA - لوحة السائق</h1>
        <div>
          <span style={styles.userInfo}>السائق: {user.name}</span>
          <button onClick={onLogout} style={styles.logoutButton}>
            تسجيل خروج
          </button>
        </div>
      </header>

      <div style={styles.driverContent}>
        <div style={styles.driverStats}>
          <h3>إحصائياتك</h3>
          <p><strong>الحالة:</strong> {isOnline ? '🟢 متصل' : '🔴 غير متصل'}</p>
          <p><strong>إجمالي الرحلات:</strong> {user.totalRides || 0}</p>
          <p><strong>التقييم:</strong> ⭐ {user.rating}</p>

          <button
            onClick={() => setIsOnline(!isOnline)}
            style={{
              ...styles.button,
              background: isOnline ? '#d32f2f' : '#4caf50',
            }}
          >
            {isOnline ? 'الانتقال للخارج' : 'الانتقال للعمل'}
          </button>
        </div>

        <div style={styles.ridesSection}>
          {!currentRide && availableRides.length > 0 && (
            <div>
              <h3>طلبات متاحة ({availableRides.length})</h3>
              {availableRides.map((ride) => (
                <div key={ride.id} style={styles.rideCard}>
                  <p><strong>الراكب:</strong> {ride.passengerName}</p>
                  <p><strong>رقم الهاتف:</strong> {ride.passengerPhone}</p>
                  <p><strong>السعر:</strong> {ride.estimatedPrice} جنيه</p>
                  <button
                    onClick={() => handleAcceptRide(ride)}
                    style={styles.acceptButton}
                  >
                    قبول الطلب
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentRide && (
            <div style={styles.currentRideCard}>
              <h3>الرحلة الحالية</h3>
              <p><strong>الراكب:</strong> {currentRide.passengerName}</p>
              <p><strong>رقم الهاتف:</strong> {currentRide.passengerPhone}</p>
              <p><strong>السعر:</strong> {currentRide.estimatedPrice} جنيه</p>
              <button
                onClick={handleCompleteRide}
                style={{
                  ...styles.button,
                  background: '#4caf50',
                }}
              >
                إنهاء الرحلة
              </button>
            </div>
          )}

          {!currentRide && availableRides.length === 0 && isOnline && (
            <p style={styles.noRides}>لا توجد طلبات متاحة حالياً</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Main App ====================
function App() {
  const [user, setUser] = useState(null);

  const handleLoginPassenger = (userData) => {
    setUser({ ...userData, role: 'passenger' });
  };

  const handleLoginDriver = (userData) => {
    setUser({ ...userData, role: 'driver' });
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return (
      <LoginScreen
        onLoginPassenger={handleLoginPassenger}
        onLoginDriver={handleLoginDriver}
      />
    );
  }

  if (user.role === 'driver') {
    return <DriverScreen user={user} onLogout={handleLogout} />;
  }

  return <PassengerScreen user={user} onLogout={handleLogout} />;
}

// ==================== Styles ====================
const styles = {
  container: {
    height: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Arial, sans-serif',
    direction: 'rtl',
  },
  header: {
    background: '#fbc02d',
    padding: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#000',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  userInfo: {
    marginRight: '20px',
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: '8px 15px',
    background: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    gap: '10px',
    padding: '10px',
  },
  map: {
    flex: 1,
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  sidebar: {
    width: '350px',
    background: '#fff',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    overflowY: 'auto',
  },
  locationSection: {
    background: '#f9f9f9',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '15px',
    border: '1px solid #e0e0e0',
  },
  instructionText: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '10px',
  },
  locationButton: {
    width: '100%',
    padding: '10px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  selectedLocation: {
    background: '#c8e6c9',
    padding: '8px',
    borderRadius: '4px',
    color: '#2e7d32',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  changeButton: {
    width: '100%',
    padding: '8px',
    background: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  selectingText: {
    background: '#fff3cd',
    padding: '8px',
    borderRadius: '4px',
    color: '#856404',
    fontSize: '12px',
    marginTop: '8px',
  },
  priceSection: {
    background: '#e3f2fd',
    padding: '12px',
    borderRadius: '6px',
    marginTop: '15px',
    border: '2px solid #2196f3',
  },
  priceText: {
    fontSize: '16px',
    color: '#1976d2',
    marginBottom: '10px',
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#fbc02d',
    color: '#000',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  statusMessage: {
    padding: '10px',
    background: '#e3f2fd',
    borderRadius: '5px',
    marginTop: '10px',
    textAlign: 'center',
  },
  driverCard: {
    background: '#f5f5f5',
    padding: '10px',
    borderRadius: '5px',
    marginTop: '10px',
    border: '2px solid #fbc02d',
  },
  ratingContainer: {
    maxWidth: '500px',
    margin: '50px auto',
    padding: '30px',
    background: '#fff',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  driverInfo: {
    background: '#f5f5f5',
    padding: '15px',
    borderRadius: '5px',
    marginBottom: '20px',
  },
  ratingStars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  star: {
    fontSize: '40px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
    marginBottom: '15px',
    fontFamily: 'Arial, sans-serif',
  },
  loginContainer: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #fbc02d 0%, #f57f17 100%)',
  },
  loginBox: {
    background: '#fff',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 5px 20px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  title: {
    color: '#fbc02d',
    marginBottom: '30px',
  },
  toggleButtons: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  toggleButton: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
  },
  driverContent: {
    display: 'flex',
    flex: 1,
    gap: '20px',
    padding: '20px',
  },
  driverStats: {
    width: '300px',
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  ridesSection: {
    flex: 1,
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    overflowY: 'auto',
  },
  rideCard: {
    background: '#f5f5f5',
    padding: '15px',
    borderRadius: '5px',
    marginBottom: '10px',
    border: '1px solid #ddd',
  },
  currentRideCard: {
    background: '#c8e6c9',
    padding: '20px',
    borderRadius: '8px',
    border: '2px solid #4caf50',
  },
  acceptButton: {
    width: '100%',
    padding: '10px',
    background: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px',
    fontWeight: 'bold',
  },
  noRides: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
  },
};

export default App;
