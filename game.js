/*
 Requires a Game was already created with api.js and records exist in DB
 */

var api = require('./api.js');
function Game(state, io, db) {

  this.id = state.id;
  this.io = io;
  this.db = db;

  this.stage = state.stage;

  // ordering of teams, e.g. ["eng","ilr", ...]
  this.team_order = state.team_order;
  this.current_team_index = state.current_team;

  // players[team_id] returns player socket list
  this.teams = {};
  this.turn = state.turn;
  this.state = state.state;

  // all move data for this turn
  // gets built as players contribute their moves
  this.all_move_data = [];
}

Game.prototype = {
  addTeam : function(id) {
    this.team_count += 1;
    this.teams[id] = [];
  },
  addPlayer : function(socket, team_id) {

    // subscribe the player to updates to the room

    socket.join(this.id);
    console.log('player joined game ' + this.id);

    if (!( team_id in this.teams)) {
      this.addTeam(team_id);
    }

    this.teams[team_id].push(socket);

    switch(this.stage) {
      case 'grab':
        this.initGrabStage(socket);
        break;
      case 'reinforcement':
        this.initReinforcementStage(socket);
        break;
      case 'orders':
        this.initOrdersStage(socket);
        break;
    }
  },

  initGrabStage : function(socket) {
    // handle selecting buildings
    socket.on('grab move', function(move_data) {

      if (this.current_team_index != move_data.team_index || this.state[move_data.piece].team != -1) {
        console.log('invalid move data', move_data);
        return false;
      }

      console.log("game " + this.id + " update " + move_data.piece + " to team " + move_data.team_id);

      this.nextTeamIndex();
      this.turn++;

      var query_string = 'UPDATE "state"."' + this.id + '" SET team =\'' + move_data.team_index + '\', player =\'Bryce\' WHERE  piece_name = \'' + move_data.piece + '\'';

      // update server  state
      this.state[move_data.piece].team = move_data.team_index;

      this.db.query(query_string);
      var query_string = 'UPDATE global.games SET turn = ' + this.turn + ', cur_team = ' + this.current_team_index + ' WHERE id = \'' + this.id + '\'';

      this.db.query(query_string);
      move_data.current_team = this.current_team_index;
      move_data.turn = this.turn;
      move_data.stage = this.stage;

      this.io.to(this.id).emit('grab update', move_data);
      this.db.query('SELECT EXISTS(SELECT 1 FROM state.' + this.id + ' WHERE -1=team)', function(err, result) {

        // END OF STAGE
        if (!result) {
          console.log(result);
          var query_string = 'UPDATE global.games SET stage = \'reinforcement\'WHERE id = \'' + this.id + '\'';

          this.db.query(query_string);
          this.io.to(this.id).emit('stage update', {
            stage : 'reinforcement',
            reinforcements : 20
          });
        }
      }.bind(this));
    }.bind(this));
  },
  initReinforcementStage : function(socket) {

    console.log('initReinforcementStage() called');

    socket.on('reinforcement move', function(move_data) {
      console.log('received reinforcement move', move_data);
      var team = move_data.meta.team_index;
      var coms = move_data.commands;

      //var reinforcements_remaining = api.getReinforcementsFromState(this.state,team);
      // XXX TODO remove later,only temp
      var reinforcements_remaining = 3;

      for (var i = 0; i < coms.length; i++) {
        var com = coms[i];
        var piece = this.state[com.id];

        // make sure you own the piece and have enough to add
        if (piece.team === team && reinforcements_remaining - com.units >= 0) {
          piece.units += com.units;
          reinforcements_remaining -= com.units;

          this.db.query('UPDATE state."' + this.id + '" SET units=' + piece.units + ' WHERE piece_name=\'' + coms[i].id + '\'', function(err, result) {
            if (err) {
              console.error('ERROR cannot update state in initReinforcementStage()');
            }
          });
        }
      }
      this.db.query('UPDATE teams."' + this.id + '" SET waiting_on=FALSE WHERE id=\'' + move_data.meta.team + '\'', function(err, result) {

        if (err) {
          console.error('ERR GAME.JS UPDATING WAITING_ON');
        }

        // append validated moves
        this.all_move_data = this.all_move_data.concat(move_data.commands);

        // who are we waiting on still?
        this.db.query('SELECT index FROM teams."' + this.id + '" WHERE waiting_on=TRUE', function(err, result) {

          if (err) {
            console.error('ERROR: query checking teams still waiting on returned error')
          }

          // someone left
          if (result.rows.length > 0) {
            var waiting_on = new Array(result.rows.length);
            for (var i = 0; i < result.rows.length; i++) {
              waiting_on[i] = result.rows[i].index;
            }
            console.log('still waiting on:', waiting_on);

            this.io.to(this.id).emit('waiting-on update', waiting_on);

            // no one left
          } else {
            console.log('no one is left!!', this.all_move_data);
            this.io.to(this.id).emit('reinforcement update', this.all_move_data);
            this.all_move_data = [];

            // set to orders stage
            this.db.query('UPDATE global.games SET stage = \'orders\'WHERE id = \'' + this.id + '\'', function(err, result) {
              if (err) {
                console.error('ERROR: cannot switch to orders stage');
              }
            });
            
            //reset waiting_on list
            this.db.query('UPDATE teams.' + this.id + ' SET waiting_on=TRUE', function(err, result) {
              if (err) {
                console.error('ERROR could not reset waiting_on=TRUE in initOrdersStage')
              }
            });

            this.initOrdersStage(socket);
          }
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },
  initOrdersStage : function(socket) {
    console.log('initOrdersStage called');

    socket.on('orders move', function(move_data) {
      console.log('received orders move', move_data);

      var team_index = move_data.team_index;

      // check move is valid
      for (var start in move_data.commands) {
        var total = 0;
        for (var end in move_data.commands[start]) {
          total += move_data.commands[start][end];
        }

        // invalid move
        if (total >= this.state[start]) {
          console.log('INVALID MOVE, (total sent, total possible)', total, this.state[start]);
          return;
        }
      }

      this.all_move_data[move_data.team_index] = move_data.commands;

      // mark as moved
      this.db.query('UPDATE teams."' + this.id + '" SET waiting_on=FALSE WHERE id=\'' + move_data.team_id + '\'', function(err, result) {

        if (err) {
          console.error('ERR GAME.JS UPDATING WAITING_ON');
        }

        console.log('received orders', move_data);

        // who are we waiting on still?
        this.db.query('SELECT index FROM teams."' + this.id + '" WHERE waiting_on=TRUE', function(err, result) {

          if (err) {
            console.error('ERROR: query checking teams still waiting on returned error')
          }

          // someone left
          if (result.rows.length > 0) {
            var waiting_on = new Array(result.rows.length);
            for (var i = 0; i < result.rows.length; i++) {
              waiting_on[i] = result.rows[i].index;
            }
            console.log('still waiting on:', waiting_on);

            this.io.to(this.id).emit('waiting-on update', waiting_on);

            // no one left
          } else {
            console.log('no one is left!!', this.all_move_data);
            this.io.to(this.id).emit('orders update', this.all_move_data);
            this.all_move_data = [];

            // set up for orders stage
            // XXX RET
            this.db.query('UPDATE global.games SET stage = \'reinforcement\' WHERE id = \'' + this.id + '\'', function(err, result) {
              if (err) {
                console.log('ERROR: cannot switch to reinforcement stage');
              }
            });

            //reset waiting_on list
            this.db.query('UPDATE teams.' + this.id + ' SET waiting_on=TRUE', function(err, result) {
              if (err) {
                console.error('ERROR could not reset waiting_on=TRUE in initOrdersStage')
              }
            });

            this.initReinforcementStage(socket);
          }

        }.bind(this));
      }.bind(this));
    }.bind(this));
  },

  nextTeamIndex : function() {
    this.current_team_index = (this.current_team_index + 1) % this.team_order.length;
    return this.current_team_index;
  },
}

module.exports = Game;
