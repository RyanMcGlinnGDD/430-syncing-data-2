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

const players = {};
let gameState = 0;
let player1 = { userId: -1, score: 0 };
let player2 = { userId: -1, score: 0 };

// join logic, adds users to room1
const onJoined = (sock) => {
  const socket = sock;

  // catches join requests that fire when users initialize
  socket.on('join', () => {
    socket.join('room1');

    // assign a player ID
    let userId;
    let flag = true;
    while (flag) {
      userId = `user${Math.floor(Math.random() * 10000) + 1}`;
      if (players[userId] !== null) {
        flag = false;
      }
    }
    // give a value denoting participation status
    players[userId] = { team: 'spectator' };

    socket.emit('serveUserId', userId);
    // save userId to socket so disconnect can be handled
    socket.userId = userId;
  });

  // catches game join requests that fire when users click the join button
  socket.on('requestJoinGame', (data) => {
    // serveAssignPlayer1
    if (player1.userId === -1) {
      player1.userId = data;
      socket.emit('serveAssignPlayer1');
    } else if (player2.userId === -1) {
      player2.userId = data;
      socket.emit('serveAssignPlayer2');
      // start the round
      gameState = 1;
    } else {
      socket.emit('serveRejectJoin');
    }
  });
};

// resets the round
const resetRound = () => {
  gameState = 0;
  player1 = { userId: -1, score: 0 };
  player2 = { userId: -1, score: 0 };
  io.sockets.in('room1').emit('serveScore', { p1: 0, p2: 0 });
};

// handles requests
const onTargetRequest = (sock) => {
  const socket = sock;
  socket.on('requestDiagnostic', (data) => {
    console.log(`${data}`);
  });
  socket.on('requestScoring', (data) => {
    // increase score
    if (data.userTeam === data.targetTeam) {
      if (data.userTeam === 'red') {
        player1.score += Math.floor(data.size);
      } else {
        player2.score += Math.floor(data.size);
      }
    } else if (data.userTeam !== data.targetTeam) {
      if (data.userTeam === 'red') {
        player1.score -= 25;
      } else {
        player2.score -= 25;
      }
    }
    // emit serve remove shape (includes)
    io.sockets.in('room1').emit('serveRemoveTarget', `${data.targetTeam}${data.t}`);
    // emit score
    io.sockets.in('room1').emit('serveScore', { p1: player1.score, p2: player2.score });

    // check to see if anyone has scored more than the max points threshold
    if (player1.score >= 1000) {
      io.sockets.in('room1').emit('serveResults', 'Red has won');
      gameState = 0;
      resetRound();
    } else if (player2.score >= 1000) {
      io.sockets.in('room1').emit('serveResults', 'Blu has won');
      gameState = 0;
      resetRound();
    }
  });
};


// disconnect logic, removes users from room1
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    console.log(`${socket.userId} disconnecting from server...`);

    // check and see if the player leaving is either of the active players
    if (gameState === 1) {
      if (player1.userId === socket.userId || player2.userId === socket.userId) {
        // serveEndByDisconnect
        io.sockets.in('room1').emit('serveEndByDisconnect');
        resetRound();
      }
    }

    delete players[socket.userId];

    // leave the room
    socket.leave('room1');
  });
};


// attaches events
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
