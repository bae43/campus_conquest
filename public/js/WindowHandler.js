WindowHandler = function() {

}

WindowHandler.prototype.setDimensions = function() {
  this.dimensions = {
    height : window.innerHeight,
    width : window.innerWidth
  };
  this.aspect_ratio = this.dimensions.width / this.dimensions.height;
  
  $('#canvas2D, #canvas3D').width(this.dimensions.width - world.control_panel_handler.width);
  $('#canvas2D, #canvas3D').height(this.dimensions.height - world.nav.height);
  
}

WindowHandler.prototype.addWindowResizeListener = function() {
  window.addEventListener('resize', this.onWindowResize, false);
}

WindowHandler.prototype.onWindowResize = function(event) {
  this.setDimensions();
  world.graphics.renderer.setSize(this.dimensions.width - 400, (this.dimensions.height - 40) / this.aspect_ratio);
  world.graphics.camera.updateProjectionMatrix();
}

WindowHandler.prototype.maxWindow = function() {
  window.moveTo(0, 0);

  if (document.all) {
    top.window.resizeTo(screen.availWidth, screen.availHeight);
  } else if (document.layers || document.getElementById) {
    if (top.window.outerHeight < screen.availHeight || top.window.outerWidth < screen.availWidth) {
      top.window.outerHeight = screen.availHeight;
      top.window.outerWidth = screen.availWidth;
    }
  }
}

