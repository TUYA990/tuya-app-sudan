const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http. Middleton.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let rides = [];

app.get('/', (req, res) => {
  res.send('TUYA API is active');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('request_ride', (rideData) => {
    const newRide = {
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      ...rideData
    };
    rides.push(newRide);
    console.log('New ride request:', newRide);
    socket.emit('ride_requested', newRide);
    // Simulate finding a driver
    setTimeout(() => {
      newRide.status = 'accepted';
      newRide.driver = { name: 'Ahmed', vehicle: 'Toyota Camry' };
      io.emit('ride_accepted', newRide);
    }, 5000);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
