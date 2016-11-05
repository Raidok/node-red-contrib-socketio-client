module.exports = function(RED) {

    "use strict";
    function socketioClientNode(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);
        var node = this;
        // Store local copies of the node configuration (as defined in the .html)
        node.host = config.host;
        node.path = config.path;
        node.wholemsg = (config.wholemsg === "true");
        node.closing = false;
        node._inputNodes = [];    // collection of nodes that want to receive events

        function initConn(){
            var socket = require('socket.io-client')(node.host, { path: node.path, multiplex:false });
            node.server = socket; // keep for closing
            handle(socket);
        }

        function handle(socket) {

          // Socket

          socket.on('wiiscale-weight', function(data){
              node.emit('ready', 'measuring');
              var msg;
              if (this.wholemsg) {
                      msg = { payload:data };
              } else {
                  msg = {
                      payload: data.totalWeight
                  };
              }
              for (var i = 0; i < node._inputNodes.length; i++) {
                  node._inputNodes[i].send(msg);
              }
          });

          socket.on('wiiscale-status', function(data) {
              switch(data.status) {
                  case "SYNC":
                      break;

                  case "NO DEVICE FOUND":
                      node.emit('closed');
                      break;

                  case "CONNECTING":
                      break;

                  case "CONNECTED":
                      break;

                  case "DISCONNECTED":
                      node.emit('closed');
                      break;

                  case "READY":
                      node.emit('ready', 'ready to measure');
                      break;

                  case "MEASURING":
                      break;

                  case "DONE":
                      node.emit('not ready', 'not ready yet...');
                      break;

                  case "NO PREVIOUS STATUS":
                      break;
              }
          });

        }

        initConn();

        node.on("close", function(){
            node.server.close();
        });
    }
    RED.nodes.registerType("socketio-client",socketioClientNode);

    socketioClientNode.prototype.registerInputNode = function(/*Node*/handler) {
        this._inputNodes.push(handler);
    };

    socketioClientNode.prototype.broadcast = function(channel, data){
        this.server.emit(channel, data);
    };
    function socketioInNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.allChannels = config.allChannels;
        node.channel = config.channel;
        this.serverConfig = RED.nodes.getNode(config.client);
        if (this.serverConfig) {
            this.serverConfig.registerInputNode(this);
            this.serverConfig.on('not ready', function(text) { node.status({fill:"yellow",shape:"dot",text:text||'not ready'}); });
            this.serverConfig.on('ready', function(text) { node.status({fill:"green",shape:"dot",text:text||"ready"}); });
            this.serverConfig.on('err', function() { node.status({fill:"red",shape:"ring",text:"error"}); });
            this.serverConfig.on('closed', function() { node.status({fill:"red",shape:"ring",text:"disconnected"}); });
        } else {
            this.error("Missing server configuration");
        }
    }
    RED.nodes.registerType("wii-scale",socketioInNode);
};
