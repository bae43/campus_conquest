function initGame(data) {
  $('#game-window').show();
  $('#signin-pane').hide();
  $('#game-window').show();

  if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
    return;
  }

  world = new World(data.game_id);
  if (data.game_id != "") {
    socket = io();
    var socket_listeners = new SocketListeners(socket);
    socket_listeners.initListeners();
    // requires id, team
    socket.emit('join game', data);
  }

  var map = new Map();
  var state = new StateHandler();
  var client_listeners = new ClientListeners();
  var graphics = new Graphics();
  var control_panel_handler = new ControlPanelHandler();
  var window_handler = new WindowHandler();

  world.setMap(map);
  world.setStateHandler(state);
  world.setClientListeners(client_listeners);
  world.setGraphics(graphics);
  world.setWindowHandler(window_handler);
  world.setControlPanelHandler(control_panel_handler);

  window_handler.setDimensions();
  control_panel_handler.addListeners();
  client_listeners.addListeners();

  world.graphics.init();
  world.loadWorld({has_ground : false});
  world.control_panel_handler.updatePanelPlayerData(data);
  world.graphics.animate();

}

