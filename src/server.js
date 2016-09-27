const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

// determine active port
const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read client html into memory
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`listening on 127.0.0.1: ${port}`);

// pass http server into socketio
const io = socketio(app);

// const targets = {};
const players = {};
let gameState = 0;
let player1Score = 0;
let player2Score = 0;

// join logic, adds users to room1
const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', () => {
    if(true) {
      socket.join('room1');

      let userId;
      let flag = true;
      while (flag) {
        userId = `user${Math.floor(Math.random() * 10000) + 1}`;
        if (players[userId] !== null) {
          flag = false;
        }
      }
      // give a placeholder value
      players[userId] = userId;

      socket.emit('serveUserId', userId);
      // save userId to socket so disconnect can be handled
      socket.userId = userId;

      console.log(`${socket.userId} joined the server...`);

      if (gameState === 0) {
        const keys = Object.keys(players);
        if (keys.length >= 2) {
          // emit to player 1 and 2 that they are active
          io.sockets.in('room1').emit('serveAssignPlayers', { p1: players[keys[0]], p2: players[keys[1]] });

          gameState = 1;
        }
      }
    }
  });
};

// handles requests
const onTargetRequest = (sock) => {
  const socket = sock;
  socket.on('requestDiagnostic', (data) => {
    console.log(`${data}`);
  });
  socket.on('reset', () => {
    io.sockets.in('room1').emit('reset');
    players = {};
    gameState = 0;
    player1Score = 0;
    player2Score = 0;
  });
  socket.on('requestScoring', (data) => {
    // increase score
    if (data.userTeam === data.targetTeam) {
      if (data.userTeam === 'red') {
        player1Score += 10;
      } else {
        player2Score += 10;
      }
    }
    // emit serve remove shape (includes)
    io.sockets.in('room1').emit('serveRemoveTarget', `${data.targetTeam}${data.t}`);
    // emit score
    io.sockets.in('room1').emit('serveScore', { p1: player1Score, p2: player2Score });
    
    if(player1Score >= 100){
      io.sockets.in('room1').emit('serveResults', "Red has won");
      gameState = 3;
    } else if(player2Score >= 100){
      io.sockets.in('room1').emit('serveResults', "Blu has won");
      gameState = 3;
    }
  });
};

// disconnect logic, removes users from room1
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    console.log(`${socket.userId} disconnecting from server...`);

    delete players[socket.userId];

    // leave the room
    socket.leave('room1');
    gameState = 0;
  });
};

// connect logic, attaches events
io.sockets.on('connection', (socket) => {
  console.log('connecting');

  onJoined(socket);
  onTargetRequest(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');

const spawnShapes = () => {
  if (gameState === 1) {
    const time = new Date().getTime();
    io.sockets.in('room1').emit('serveNewTarget', {
      team: 'red',
      t: time,
      x: (Math.random() * 1200) + 80,
      y: (Math.random() * 640) + 80,
    });
    io.sockets.in('room1').emit('serveNewTarget', {
      team: 'blue',
      t: time,
      x: (Math.random() * 1180) + 50,
      y: (Math.random() * 620) + 50,
    });
  }
};

setInterval(spawnShapes, 1500);
