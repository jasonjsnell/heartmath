//chat gpt sept 21 Catania
const net = require('net');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const xml2js = require('xml2js');

const SERVER_HOST = '127.0.0.1';  // Assuming the HeartMath app is on the same machine
const SERVER_PORT = 20480; //port that HeartMath is sending to
const WEB_PORT = process.env.PORT || 3000;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

// Create a new XML parser
const parser = new xml2js.Parser();

// When a socket.io client connects
io.on('connection', (socket) => {
  
  console.log('Server: Webpage socket.io has connected.');

  // When this server receives XML data from the external app, it'll forward it to the web page
  client.on('data', (data) => {
      //console.log('Server:: received data from client', data.toString());

      parser.parseString(data.toString(), (err, result) => {
        if (err) {
            console.error('Error parsing XML:', err);
        } else {
            socket.emit('heartMathData', result);  // Emitting the parsed data as a JS object
        }
    });
  });
});

app.use('/', express.static('public')); 

httpServer.listen(WEB_PORT, () => {
  console.log(`Server: Started on port ${WEB_PORT}`);
});

// Create a TCP client
const client = new net.Socket();
client.connect(SERVER_PORT, SERVER_HOST, () => {
    console.log(`Server: net socket connected to HeartMath TCP stream on ${SERVER_HOST}:${SERVER_PORT}`);
});

// client.on('data', (data) => {
//     console.log('Server: Data received from HeartMath TCP stream:', data.toString());
//     io.emit('xmlData2', data.toString()); 
// });

client.on('close', () => {
  console.log('Server: net socket connection to HeartMath TCP is now closed');
});