/**
 * World [GLOBAL VAR]
 * main class for managing all components running a game
 * contains settings, and components that run every thing
 * used to tie all other components together
 * @param {string} id
 */
World = function(campus, id) {
  this.campus = campus;
  this.loadTeamData();
 
 this.id = id;
  this.map = undefined;
  this.state_handler = undefined;
  this.control_panel_handler = undefined;
  this.client_listeners = undefined;
  this.graphics = undefined;
  this.window_handler = undefined;
  this.notifier = undefined;
  this.sound_handler = undefined;
  this.override_controller = undefined;
  this.nav = {
    height : 50
  };

}

World.prototype = {
  connectToSocket : function(socket, client_data) {
    this.state_handler.connectToSocket(socket);
    this.control_panel_handler.connectToSocket(socket);
    socket.emit(CONSTANTS.IO.JOIN_GAME, client_data);
  },
  loadWorld : function(options) {
    has_ground = options.has_ground || false;

    this.state_handler.freshPull(function(state){
      this.state_handler.setState(state);
      this.map.loadMapFile("map.json", function(piece_ids) {
        $.each(piece_ids, function(k, v) {
          $('select.pieces').append('<option value='+v+'>'+v+'</option>');
        });
        $.each(world.state_handler.team_order, function(k, v) {
          $('select.teams').append('<option value='+k+'>'+v+'</option>');
        });
      });
      this.map.loadGeometries();
      //this.control_panel_handler.updateTextFields(init_data);
    }.bind(this));
  },
  loadTeamData : function () {
   $.get('rsc/campuses/' + this.campus + '/team_data.json', function(data) {
     this.team_data = data;
     // parse all hex colors from strings
     for (var team in data) {
       var colors = data[team].colors;
       for (var key in colors) {
         colors[key] = parseInt(colors[key]);
       }
     }
   }.bind(this));
  },
  setMe : function(data) {
    this.me = data;
    this.control_panel_handler.updateTextFields(data);
  },
  setMap : function(map) {
    this.map = map;
  },
  setStateHandler : function(state_handler) {
    this.state_handler = state_handler;
  },
  setControlPanel : function(control_panel) {
    this.control_panel = control_panel;
  },
  setClientListeners : function(client_listeners) {
    this.client_listeners = client_listeners;
  },
  setGraphics : function(graphics) {
    this.graphics = graphics;
  },
  setWindowHandler : function(window_handler) {
    this.window_handler = window_handler;
  },
  setControlPanelHandler : function(control_panel_handler) {
    this.control_panel_handler = control_panel_handler;
  },
  setNotifier : function(notifier) {
    this.notifier = notifier;
  },
  setSoundHandler : function(sound_handler) {
    this.sound_handler = sound_handler;
  },
  setOverrideController : function(override_controller) {
    this.override_controller = override_controller;
  },
}
