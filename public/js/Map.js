/**
 *
 * Map
 *
 * Loads and manages the models displayed in Graphics.js
 *
 * REQUIRES: World.js, Graphics.js
 *
 */

Map = function() {

  this.map_dir = "/rsc/models/map/";
  this.loader = new THREE.JSONLoader();
  
  // id and name for current map loaded
  this.id = undefined;
  this.name = undefined;

  // {<String> id : Region} 
  this.regions = {};

  // {<String> id : GamePiece
  this.game_pieces = {}

  // ids of all game_pieces
  this.piece_ids = []

  // meshes of all selectable pieces
  this.selectable_objects = [];

  // list of geometries for frequently created objects like arrows
  this.geometries = {};

  // Arrow lookup map- <string> start-id : {<string> end-id : Arrow}
  this.arrows = {};

  this.scale = 15;
  this.show_edges = false;

  this.colors = {
    current : 0xffc038,
    connected : 0x18cd00,
    included : 0x544aaaa,
    excluded : 0xcc6666,
    edge : 0x00ff33,
    highlight : 0xffff00,
  };
}

Map.prototype = {
    
  // TODO dynamically load different maps
  loadMapFile : function(filename) {
    $.ajax({
      url : "/rsc/maps/" + filename,
    }).done( function(data) {
      this.id = data.id;
      this.name = data.name;
     
      $.each(data.regions, function(id, r) {
        this.regions[id] = new Region(id, r.name, r.connected, r.value);
      }.bind(this));

      $.each(data.pieces, function(id, piece_data) {
        this.piece_ids.push(id);
        // pushes to this.game_pieces
        this.loadPiece({id: id, connected: piece_data});
      }.bind(this));
      
      if (world.graphics.complex_geometry == true) {
        this.loadGround();
      }

    }.bind(this));
  },

  loadPiece : function(piece_data) {
    var piece_id = piece_data.id;
    var name = piece_data.name;
// XXX
    var connected =  piece_data.connected;

    // model is not in this game
    if (!world.state_handler.current.state[piece_id]) {
      console.log(piece_id + ' not included in this map');
      return;
    }

    this.loader.load(this.map_dir + "buildings/" + piece_id + "/" + piece_id + ".js", function(geometry) {

      geometry.computeMorphNormals();

      var material = new THREE.MeshLambertMaterial({
        blending : THREE.FlatShading,
      });

      var mesh = new THREE.Mesh(geometry, material);
      
      this.game_pieces[piece_id] = new GamePiece(this, piece_id, name, mesh, connected);
      
      this.selectable_objects.push(mesh);
      mesh.computeCenter();

      mesh.name = piece_id;
      world.graphics.scene.add(mesh);

    }.bind(this));
  },

  loadGround : function() {
    this.loader.load(this.map_dir + "ground/ground.js", function(geometry) {

      var material = new THREE.MeshLambertMaterial({
        map : THREE.ImageUtils.loadTexture(this.map_dir + "ground/ground.png"),
        shading : THREE.SmoothShading,
      });

      var mesh = new THREE.Mesh(geometry, material);
      mesh.name = "ground";
 
      mesh.scale.set(this.scale, this.scale, this.scale);
      mesh.position.y = 0;
      try {
        world.graphics.scene.add(mesh);
      } catch(err) {
        console.log(err.stack);
      }
    }.bind(this));
  },

  addEdge : function(id1, id2) {
    var sorted = [id1, id2].sort();

    // check to see if it already exists
    var edge = this.edges[sorted[0] + sorted[1]];
    if (edge) {
      if (edge.parent) {
        return;
      } else {
        world.graphics.scene.add(edge);
      }
    }

    var mesh1 = this.game_pieces[id1].mesh;
    var mesh2 = this.game_pieces[id2].mesh;

    var geo = new THREE.Geometry();
    geo.vertices.push(new THREE.Vector3(mesh2.center.x, 2 * mesh2.center.y + 5, mesh2.center.z));
    geo.vertices.push(new THREE.Vector3(mesh1.center.x, 2 * mesh1.center.y + 5, mesh1.center.z));

    var mat = new THREE.LineBasicMaterial({
      color : this.colors.edge,
    });

    var line = new THREE.Line(geo, mat);
    this.edges[sorted[0] + sorted[1]] = line;
    
    line.name = sorted[0] + "--" + sorted[1];
    world.graphics.scene.add(line);
  },
  getEdge : function(id1, id2) {
    var sorted = [id1, id2].sort();
    return this.edges[sorted[0] + sorted[1]];
  },
  removeEdge : function(id1, id2) {
    var sorted = [id1, id2].sort();
    world.graphics.scene.remove(this.edges[sorted[0] + sorted[1]]);
  },
  toggleEdges : function() {
    if(!this.show_edges){
      this.addEdges();
    } else{
      this.removeEdges();
    }
    this.show_edges = !this.show_edges;
  },
  addEdges : function() {
    this.edges = {};
    $.each(this.game_pieces, function(piece_id, piece) {
      var connections = piece.connected;
      for (var i = 0; i < connections.length; i++) {
        this.addEdge(piece_id, connections[i]);
      }
    }.bind(this));

  },
  removeEdges : function() {
    $.each(this.game_pieces, function(piece_id, piece) {
      var connections = piece.connected;
      for (var i = 0; i < connections.length; i++) {
        this.removeEdge(piece_id, connections[i]);
      }
    }.bind(this));
  },
  
  /**
   * Loads all models not associated with the specific map
   */
  loadGeometries : function() {
    this.loadArrowGeometry();
  },

  loadArrowGeometry : function() {
    this.loader.load("../rsc/models/map/arrow/arrow.js", function(geometry) {

      geometry.computeMorphNormals();
      this.geometries.arrow = geometry;
    }.bind(this));

  },

  // gets an arrow from start_id to end_id.
  // creates one if one doesn't exist
  getArrow : function(start_id, end_id) {
    if (this.arrows[start_id] && this.arrows[start_id][end_id]) {
      return this.arrows[start_id][end_id];
    } else {
      return new Arrow(start_id, end_id);
    }
  },
  removeAllArrows : function() {
    for (var start in this.arrows) {
      for (var end in this.arrows[start]) {
        var arrow = this.arrows[start][end];
        world.graphics.scene.remove(arrow.mesh);
        delete arrow;
      }
    }
    this.arrows = {};
  },
  newExplosion : function(center) {
    var explosion = new Explosion(center);
    world.graphics.animation_handler.addAnimation(explosion, explosion.update);
  }
}

Region = function(id, name, pieces, value) {
  this.id = id;
  this.name = name;
  this.pieces = pieces;
  this.value = value;
}

GamePiece = function(map, id, name, mesh, connected) {

  this.id = id;
  this.name = name;
  this.mesh = mesh;
  this.connected = connected;

  mesh.game_piece = this;

  this.setTeam();

  mesh.scale.set(map.scale, map.scale, map.scale);
  mesh.position.y = 0;
}


// @team_number : int
GamePiece.prototype = {
  /**
   * updates materials to match owner in current state
   */
  setTeam : function() {
    var team_number = world.state_handler.current.state[this.id].team;
    if (team_number > world.state_handler.team_order.length) {
      console.error("set piece to invalid team");
    }
    var new_material = this.mesh.material;
    var new_color = world.state_handler.getTeamColorFromIndex(team_number);
    new_material.color.copy(new THREE.Color(new_color));
    this.mesh.material = new_material;
    this.team = team_number;
  },

  highlight : function() {
    $('#current-selection').text(this.id);

    // this.mesh.material.color.copy(new THREE.Color(1,1,1));
    // return;
    //
    // this.mesh.material.color.r = (this.mesh.material.color.r + 1) / 2;
    // this.mesh.material.color.g = (this.mesh.material.color.g + 1) / 2;
    // this.mesh.material.color.b = (this.mesh.material.color.b + 1) / 2;
    //
    // // keep color after moving mouse off of piece
    //
    // return;
    //
    // this.mesh.material.color.r ^=1;
    // this.mesh.material.color.g ^=1;
    // this.mesh.material.color.b ^=1;
    // return;

    var outline_amount = 0.1;

    var color = TEAM_DATA[world.state_handler.team_order[this.team]].colors.secondary;

    var outlineMaterial = new THREE.MeshBasicMaterial({
      color : color ^ 0xffffff,
      side : THREE.BackSide
    });
    var outlineMesh = new THREE.Mesh(this.mesh.geometry, outlineMaterial);
    this.highlighted_mesh = outlineMesh;

    // push the center so scaling keeps mesh centered on building
    // only needed because geometry center is not world center
    var distance = outlineMesh.position.distanceTo(this.mesh.center);
    outlineMesh.position.copy(this.mesh.center).multiplyScalar(-outline_amount);

    outlineMesh.scale.multiplyScalar(world.map.scale * (1 + outline_amount));
    world.graphics.scene.add(outlineMesh);

  },

  unhighlight : function() {
    $('#current-selection').text('');
    world.graphics.scene.remove(this.highlighted_mesh);
    return;

    // this.mesh.material.color.copy(TEAM_DATA[world.state_handler.team_order[this.team]].colors.primary);
    // return;
    // this.mesh.material.color.r = (this.mesh.material.color.r * 2) - 1;
    // this.mesh.material.color.g = (this.mesh.material.color.g * 2) - 1;
    // this.mesh.material.color.b = (this.mesh.material.color.b * 2) - 1;
    // return;
    //
    // this.mesh.material.color.r ^=1;
    // this.mesh.material.color.g ^=1;
    // this.mesh.material.color.b ^=1;
    // return;
    //
    // world.graphics.scene.remove(this.highlightedMesh);

  }
}

/*
 * Generates an arrow between two buildings
 *
 * id1- string id of start building
 * id2- string id of end building
 * strength- thickness of arrow
 */
Arrow = function(id1, id2) {

  var start_mesh = world.map.game_pieces[id1].mesh;
  var end_mesh = world.map.game_pieces[id2].mesh;

  // the id of the piece the arrow originates
  this.start = id1;

  // id of piece ends at
  this.end = id2;

  if (!world.map.arrows[id1]) {
    world.map.arrows[id1] = {};
  }
  world.map.arrows[id1][id2] = this;

  // units this arrow represents
  this.units = 0;

  var p1 = start_mesh.center;
  var p2 = end_mesh.center;

  var scale = world.map.scale;

  // find arrow polar coords
  var mag = Math.sqrt(Math.pow((p2.x - p1.x), 2) + Math.pow((p2.z - p1.z), 2));
  var theta = -(Math.atan((p2.z - p1.z) / (p2.x - p1.x)));

  //correct for atan range
  if (p2.x > p1.x) {
    theta += Math.PI;
  }

  //get mesh object
  var x, z;
  var geometry = world.map.geometries.arrow;

  material = new THREE.MeshLambertMaterial({
    color : 0xff0000,
    shading : THREE.SmoothShading
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.name = id1 + "=>" + id2;
  this.mesh = mesh;


  mesh.scale.set(mag - .5 * (scale), .1 * mag, this.units * scale + .5);

  mesh.position.x = start_mesh.center.x;
  mesh.position.z = start_mesh.center.z;
  mesh.position.y = 15;
  mesh.rotation.y = theta;

  x = mesh.position.x;
  z = mesh.position.z;

  // get center for displaying text at this point
  this.center = new THREE.Vector3(x - mag * Math.cos(theta) / 2, .015 * mag + 5, z + mag * Math.sin(theta) / 2);

  // don't add to scene until units > 0
  if (this.units !== 0) {
    this.mesh.scale.z = this.units * world.map.scale + .5;
    world.graphics.scene.add(this.mesh);
  }

}
Arrow.prototype = {
  setUnits : function(u) {
    var prev_units = this.units;
    this.units = u;

    if (this.mesh) {
      this.mesh.scale.z = Math.min(300, u * world.map.scale);
    }

    // remove
    if (u === 0 && this.mesh) {
      world.graphics.scene.remove(this.mesh);
      return;
    }
    // add back
    else if (prev_units === 0 && u !== 0 && this.mesh) {
      world.graphics.scene.add(this.mesh);
    }

  }
}

Explosion = function(center) {
  //////////////settings/////////
  this.points = undefined;  
  this.point_count= 500;
  this.dirs = [];
  this.lifetime = 12;

  // only used on init
  var objectSize = 3;
  var movementSpeed = 7;
  var colors = [0xFFFFFF];

  var geometry = new THREE.Geometry();
 
  for (i = 0; i < this.point_count; i ++) { 
    geometry.vertices.push( center.clone() );
    this.dirs.push({x:(Math.random() * movementSpeed)-(movementSpeed/2),y:(Math.random() * movementSpeed)-(movementSpeed/2),z:(Math.random() * movementSpeed)-(movementSpeed/2)});
  }
  var material = new THREE.PointsMaterial( { size: objectSize,  color: colors[Math.round(Math.random() * colors.length)] });
  this.points = new THREE.Points( geometry, material );
  
  this.status = true;
  
  this.xDir = (Math.random() * movementSpeed)-(movementSpeed/2);
  this.yDir = (Math.random() * movementSpeed)-(movementSpeed/2);
  this.zDir = (Math.random() * movementSpeed)-(movementSpeed/2);
  
  world.graphics.scene.add(this.points); 
}

Explosion.prototype = {
 update: function() {
    if (this.status == true){
      var pCount = this.point_count;
      while(pCount--) {
        var particle =  this.points.geometry.vertices[pCount];
        particle.y += this.dirs[pCount].y;
        particle.x += this.dirs[pCount].x;
        particle.z += this.dirs[pCount].z;
      }
      this.points.geometry.verticesNeedUpdate = true;
      this.lifetime--;
      if(this.lifetime < 0){
        world.graphics.scene.remove(this.points);
        this.status == false;
      }
    }
  },
}

THREE.Mesh.prototype.computeCenter = function() {
  var sumx = 0;
  var sumy = 0;
  var sumz = 0;
  var counter = 0;
  var verts = this.geometry.vertices;
  for (index in verts) {
    sumx += verts[index].x;
    sumy += verts[index].y;
    sumz += verts[index].z;
    counter++;
  }
  var map = world.map;
  this.center =  new THREE.Vector3(map.scale * sumx / counter, map.scale * sumy / counter, map.scale * sumz / counter);
}
