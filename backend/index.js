const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory database (for development)
let users = [];
let drivers = [];
let rides = [];
let ratings = [];
let complaints = [];
let messages = [];

// ==================== REST API Endpoints ====================

app.get('/', (req, res) => {
  res.send('TUYA API is active');
});

// Register/Login User
app.post('/api/auth/user', (req, res) => {
  const { name, phone } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  // Check if user already exists
  let user = users.find(u => u.phone === phone);
  
  if (!user) {
    user = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      phone,
      role: 'passenger',
      createdAt: new Date()
    };
    users.push(user);
  }

  res.json(user);
});

// Register/Login Driver
app.post('/api/auth/driver', (req, res) => {
  const { name, phone, vehicle, plateNumber } = req.body;
  
  if (!name || !phone || !vehicle || !plateNumber) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if driver already exists
  let driver = drivers.find(d => d.phone === phone);
  
  if (!driver) {
    driver = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      phone,
      vehicle,
      plateNumber,
      role: 'driver',
      rating: 5.0,
      totalRides: 0,
      isOnline: false,
      location: null,
      createdAt: new Date()
    };
    drivers.push(driver);
  }

  res.json(driver);
});

// Get all available drivers
app.get('/api/drivers/available', (req, res) => {
  const availableDrivers = drivers.filter(d => d.isOnline);
  res.json(availableDrivers);
});

// Get driver details
app.get('/api/drivers/:id', (req, res) => {
  const driver = drivers.find(d => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }
  res.json(driver);
});

// Get ride history for a user
app.get('/api/rides/user/:userId', (req, res) => {
  const userRides = rides.filter(r => r.passengerId === req.params.userId);
  res.json(userRides);
});

// Get ride history for a driver
app.get('/api/rides/driver/:driverId', (req, res) => {
  const driverRides = rides.filter(r => r.driverId === req.params.driverId);
  res.json(driverRides);
});

// Get all ratings for a driver
app.get('/api/ratings/driver/:driverId', (req, res) => {
  const driverRatings = ratings.filter(r => r.driverId === req.params.driverId);
  res.json(driverRatings);
});

// Submit a rating for a driver
app.post('/api/ratings', (req, res) => {
  const { rideId, driverId, passengerId, rating, comment } = req.body;
  
  if (!rideId || !driverId || !passengerId || rating === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const newRating = {
    id: Math.random().toString(36).substr(2, 9),
    rideId,
    driverId,
    passengerId,
    rating,
    comment: comment || '',
    createdAt: new Date()
  };

  ratings.push(newRating);

  // Update driver's average rating
  const driverRatings = ratings.filter(r => r.driverId === driverId);
  const avgRating = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;
  
  const driver = drivers.find(d => d.id === driverId);
  if (driver) {
    driver.rating = Math.round(avgRating * 10) / 10;
  }

  res.json(newRating);
});

// ==================== Customer Support & Complaints ====================

// Submit a complaint
app.post('/api/complaints', (req, res) => {
  const { userId, rideId, subject, message } = req.body;
  
  if (!userId || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newComplaint = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    rideId: rideId || null,
    subject,
    message,
    status: 'open',
    createdAt: new Date(),
    responses: []
  };

  complaints.push(newComplaint);
  io.emit('new_complaint', newComplaint);

  res.json(newComplaint);
});

// Get all complaints for a user
app.get('/api/complaints/user/:userId', (req, res) => {
  const userComplaints = complaints.filter(c => c.userId === req.params.userId);
  res.json(userComplaints);
});

// Get all complaints (for admin/support)
app.get('/api/complaints', (req, res) => {
  res.json(complaints);
});

// Add response to complaint
app.post('/api/complaints/:complaintId/response', (req, res) => {
  const { message, respondedBy } = req.body;
  
  const complaint = complaints.find(c => c.id === req.params.complaintId);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found' });
  }

  const response = {
    id: Math.random().toString(36).substr(2, 9),
    message,
    respondedBy,
    createdAt: new Date()
  };

  complaint.responses.push(response);
  io.emit('complaint_response', { complaintId: complaint.id, response });

  res.json(response);
});

// ==================== Messages & Chat ====================

// Get messages for a ride
app.get('/api/messages/ride/:rideId', (req, res) => {
  const rideMessages = messages.filter(m => m.rideId === req.params.rideId);
  res.json(rideMessages);
});

// Send a message
app.post('/api/messages', (req, res) => {
  const { rideId, senderId, senderName, message } = req.body;
  
  if (!rideId || !senderId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newMessage = {
    id: Math.random().toString(36).substr(2, 9),
    rideId,
    senderId,
    senderName,
    message,
    timestamp: new Date()
  };

  messages.push(newMessage);
  io.emit('new_message', newMessage);

  res.json(newMessage);
});

// ==================== Ride Cancellation ====================

// Cancel a ride
app.post('/api/rides/:rideId/cancel', (req, res) => {
  const { cancelledBy, reason } = req.body;
  
  const ride = rides.find(r => r.id === req.params.rideId);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  if (ride.status === 'completed' || ride.status === 'cancelled') {
    return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled ride' });
  }

  ride.status = 'cancelled';
  ride.cancelledBy = cancelledBy;
  ride.cancelReason = reason || 'No reason provided';
  ride.cancelledAt = new Date();

  const driver = drivers.find(d => d.id === ride.driverId);
  if (driver) {
    driver.currentRide = null;
  }

  io.emit('ride_cancelled', ride);

  res.json(ride);
});

// ==================== Socket.IO Events ====================

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Driver goes online
  socket.on('driver_online', (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      driver.isOnline = true;
      driver.socketId = socket.id;
      console.log(`Driver ${driver.name} is now online`);
      io.emit('driver_status_changed', { driverId, isOnline: true });
    }
  });

  // Driver goes offline
  socket.on('driver_offline', (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      driver.isOnline = false;
      driver.socketId = null;
      console.log(`Driver ${driver.name} is now offline`);
      io.emit('driver_status_changed', { driverId, isOnline: false });
    }
  });

  // Driver updates location
  socket.on('driver_location', (data) => {
    const { driverId, lat, lng } = data;
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      driver.location = { lat, lng };
      io.emit('driver_location_updated', { driverId, location: { lat, lng } });
    }
  });

  // Passenger requests a ride
  socket.on('request_ride', (rideData) => {
    const newRide = {
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      passengerId: rideData.passengerId,
      passengerName: rideData.passengerName,
      passengerPhone: rideData.passengerPhone,
      pickupLocation: rideData.pickupLocation,
      dropoffLocation: rideData.dropoffLocation,
      estimatedPrice: rideData.estimatedPrice,
      driverId: null,
      driver: null,
      createdAt: new Date(),
      acceptedAt: null,
      completedAt: null,
      cancelledAt: null,
      ...rideData
    };

    rides.push(newRide);
    console.log('New ride request:', newRide);

    // Notify all online drivers
    io.emit('new_ride_available', newRide);

    // Emit to the passenger
    socket.emit('ride_requested', newRide);

    // Simulate finding a driver after 3 seconds
    setTimeout(() => {
      const availableDriver = drivers.find(d => d.isOnline && !d.currentRide);
      if (availableDriver) {
        newRide.status = 'accepted';
        newRide.driverId = availableDriver.id;
        newRide.driver = {
          id: availableDriver.id,
          name: availableDriver.name,
          vehicle: availableDriver.vehicle,
          plateNumber: availableDriver.plateNumber,
          rating: availableDriver.rating,
          phone: availableDriver.phone
        };
        newRide.acceptedAt = new Date();
        availableDriver.currentRide = newRide.id;

        io.emit('ride_accepted', newRide);
        console.log(`Ride ${newRide.id} accepted by driver ${availableDriver.name}`);
      }
    }, 3000);
  });

  // Driver accepts a ride
  socket.on('accept_ride', (data) => {
    const { rideId, driverId } = data;
    const ride = rides.find(r => r.id === rideId);
    const driver = drivers.find(d => d.id === driverId);

    if (ride && driver) {
      ride.status = 'accepted';
      ride.driverId = driverId;
      ride.driver = {
        id: driver.id,
        name: driver.name,
        vehicle: driver.vehicle,
        plateNumber: driver.plateNumber,
        rating: driver.rating,
        phone: driver.phone
      };
      ride.acceptedAt = new Date();
      driver.currentRide = rideId;

      io.emit('ride_accepted', ride);
      console.log(`Ride ${rideId} accepted by driver ${driver.name}`);
    }
  });

  // Ride completed
  socket.on('ride_completed', (data) => {
    const { rideId } = data;
    const ride = rides.find(r => r.id === rideId);

    if (ride) {
      ride.status = 'completed';
      ride.completedAt = new Date();

      const driver = drivers.find(d => d.id === ride.driverId);
      if (driver) {
        driver.currentRide = null;
        driver.totalRides = (driver.totalRides || 0) + 1;
      }

      io.emit('ride_completed', ride);
      console.log(`Ride ${rideId} completed`);
    }
  });

  // Ride cancelled
  socket.on('ride_cancelled', (data) => {
    const { rideId, cancelledBy, reason } = data;
    const ride = rides.find(r => r.id === rideId);

    if (ride) {
      ride.status = 'cancelled';
      ride.cancelledBy = cancelledBy;
      ride.cancelReason = reason || 'No reason provided';
      ride.cancelledAt = new Date();

      const driver = drivers.find(d => d.id === ride.driverId);
      if (driver) {
        driver.currentRide = null;
      }

      io.emit('ride_cancelled', ride);
      console.log(`Ride ${rideId} cancelled by ${cancelledBy}`);
    }
  });

  // Chat message
  socket.on('send_message', (data) => {
    const { rideId, senderId, senderName, message } = data;
    const messageData = {
      id: Math.random().toString(36).substr(2, 9),
      rideId,
      senderId,
      senderName,
      message,
      timestamp: new Date()
    };

    messages.push(messageData);
    io.emit('new_message', messageData);
    console.log(`Message in ride ${rideId}: ${message}`);
  });

  // Submit complaint
  socket.on('submit_complaint', (data) => {
    const { userId, rideId, subject, message } = data;
    const complaint = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      rideId: rideId || null,
      subject,
      message,
      status: 'open',
      createdAt: new Date(),
      responses: []
    };

    complaints.push(complaint);
    io.emit('new_complaint', complaint);
    console.log(`New complaint from user ${userId}: ${subject}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Mark driver as offline if they disconnect
    const driver = drivers.find(d => d.socketId === socket.id);
    if (driver) {
      driver.isOnline = false;
      driver.socketId = null;
      io.emit('driver_status_changed', { driverId: driver.id, isOnline: false });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`TUYA Server is running on port ${PORT}`);
});
