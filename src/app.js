/* @flow */

import type { Socket, Player, PlayerID, App, AppID, RoomID } from './types';

import path from 'path';

const roomApps: { [RoomID]: App } = {}; //0-9999 corresponding to room id

function joinApp(roomID: RoomID, player: Player) {
  roomApps[roomID].players[player.id] = player;
  roomApps[roomID].joined(player.id, player.name, player.role);
}

function leaveApp(roomID: RoomID, playerID: PlayerID) {
  if (roomApps[roomID]) {
    const player = roomApps[roomID].players[playerID];
    delete roomApps[roomID].players[playerID];
    roomApps[roomID].left(playerID, player.name, player.role);
  }
}

function quitApp(roomID: RoomID) {
  if (roomApps[roomID]) {
    roomApps[roomID].quit();
    delete roomApps[roomID];
  }
}

function dataRetrieved(roomID: RoomID, playerID: PlayerID, eventName: string, data: any) {
  roomApps[roomID].execute(eventName, playerID, data);
}

module.exports = (sockets: { [PlayerID]: Socket }, appsDir: string) => {
  function send(socketId: PlayerID, eventName: string, data: any) {
    sockets[socketId].emit('data-app-server', eventName, data);
  }

  function createRoomApp(players: { [PlayerID]: Player }): App {
    return {
      players, //{ID: { name: NAME, role: ROLE }}

      ons: {},

      on: function(eventName, callback) {
        this.ons[eventName] = callback;
      },

      emit: (socketId: PlayerID, eventName, ...data) => {
        send(socketId, eventName, data);
      },

      emitAll: (eventName, ...data) => {
        Object.keys(players).forEach(id => send(id, eventName, data));
      },

      execute: function(eventName, socketId, data) {
        this.ons[eventName].apply(this.ons[eventName], [socketId, ...data]);
      },

      joined: function(id, name, role) {
        // Overloaded by app
        console.log(id + ', ' + name + ' joined, role: ' + role);
      },

      left: function(id, name, role) {
        // Overloaded by app
        console.log(id + ', ' + name + ' left, role: ' + role);
      },

      onload: function() {
        // Overloaded by app
        console.log('onload');
      },

      connect: function(id) {
        // Overloaded by app
        return [];
      },

      quit: function() {
        // Overloaded by app
        console.log('quit');
      }
    };
  }

  function selectApp(roomID: RoomID, appPath: string, players: Player[]) {
    const playerObj: { [PlayerID]: Player } = players.reduce(
      (acc, val) => Object.assign(acc, { [val.id.toString()]: val }),
      {}
    );
    const app = createRoomApp(playerObj);
    app.on('_onload', (socketID: PlayerID) => {
      const names = players.map(p => p.name || '');
      const data = app.connect(socketID);
      app.emit(socketID, '_connected', names, data);
    });

    // Create new instance of server.js, not singleton
    const newApp: App = new (require(path.join(appsDir, appPath)))(app);
    newApp.onload();
    roomApps[roomID] = newApp;
  }

  return {
    joinApp,
    selectApp,
    leaveApp,
    quitApp,
    dataRetrieved
  };
};
