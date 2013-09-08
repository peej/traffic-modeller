
var Traffic = {
    tick: 1000,
    vehicleLengthInPixels: 100, // length of one vehicle as drawn on the canvas
    name: null,
    phase: 0,
    verbose: false,
    extend: function (obj) {
        function F() {};
        F.prototype = this;
        var G = new F();
        G.parent = this;
        for (member in obj) {
            G[member] = obj[member];
        }
        return G;
    },
    create: function (props) {
        return this.extend(props);
    }
};

Traffic.init = function (canvas, startNodes, controllers) {
    this.canvas = canvas;
    this.startNodes = startNodes;
    this.controllers = controllers;
};

Traffic.run = function (canvas, startNodes, controllers) {
    var traffic = this;
    this.init(canvas, startNodes, controllers);
    return window.setInterval(function () {
        traffic.step();
    }, this.tick);
};

Traffic.step = function () {
    var context = this.canvas[0].getContext("2d");
    var traffic = this;
    context.clearRect(0, 0, this.canvas.width(), this.canvas.height());
    this.render.nodeRendered = [];
    $.each(this.startNodes, function () {
        traffic.render(this);
        //if (traffic.phase % this.frequency == 0) {
        if (Math.random() > 1 / this.frequency) {
            this.transferVehicle(Traffic.Vehicle.create({
                name: Math.round(Math.random() * 100)
            })); // increment start node
        }
    });
    $.each(this.startNodes, function () {
        this.reset();
    });
    $.each(this.controllers, function () {
        this.next(traffic.phase);
    });
    this.phase++;
};

Traffic.render = function (node) {
    var context = this.canvas[0].getContext("2d");
    node.render(context);
    if (node.paths) {
        $.each(node.paths, function () {
            if (Traffic.render.nodeRendered.indexOf(this) == -1) {
                Traffic.render.nodeRendered.push(this);
                this.render(context);
                Traffic.render(this.end);
                if (this.vehicles.length > 0) {
                    var veh = this.vehicles[0];
                    if (veh.exitPhase <= Traffic.phase) {
                        if (this.end.transferVehicle(veh, this)) {
                            this.removeVehicle();
                        }
                    }
                }
            }
        });
    }
};

Traffic.Node = Traffic.extend({
    
    baseNode: true,
    x: null, y: null, // position of this node
    color: "#0f0",
    busy: false,
    
    create: function (props) {
        var G = this.extend(props);
        G.paths = [];
        return G;
    },

    toString: function () {
        return "Node: " + this.name;
    },

    render: function (canvas) {
        canvas.beginPath();
        canvas.strokeStyle = this.color;
        canvas.fillStyle = this.color;
        canvas.lineWidth = 1;
        canvas.arc(this.x + 10, this.y + 10, 5, 0, 360, false);
        canvas.fill();
        canvas.stroke();

        canvas.fillStyle = "#000";
        canvas.fillText(this.name, this.x + 20, this.y + 14);

    },

    addPath: function (path, priority) {
        if (typeof priority == "number") {
            this.paths.splice(priority, 0, path);
        } else {
            this.paths.push(path);
        }
    },

    hasPath: function (path) {},

    // transfer a vehicle to a path from this node
    transferVehicle: function (veh, fromPath) {
        veh = veh || Traffic.Vehicle.create();
        if (
            typeof this.paths == "undefined" || this.paths.length == 0 || // there are no onward paths (is a dead end)
            this.busy // (is busy with another vehicle)
        ) {
            if (Traffic.verbose) {
                console.log("Vehicle '" + veh.name + "' waiting at '" + this.name + "'");
            }
            this.busy = true;
            if (fromPath) {
                fromPath.blocked();
            }
            this.transferBlocked(veh, fromPath);
            return false;
        } else {
            this.busy = true;
            if (fromPath) {
                fromPath.unblocked();
            }
            return this.transferAllowed(veh, fromPath);
        }
    },

    transferBlocked: function (veh, fromPath) {},

    transferAllowed: function (veh, fromPath) {
        var pathNum = Math.floor(Math.random() * this.paths.length);
        return this.paths[pathNum].addVehicle(veh);
    },

    reset: function () {
        this.busy = false;
        if (this.paths) {
            $.each(this.paths, function () {
                this.end.reset();
            });
        }
    }

});

Traffic.StartNode = Traffic.Node.extend({
    startNode: true,
    frequency: 1,
});

Traffic.EndNode = Traffic.Node.extend({

    endNode: true,

    transferVehicle: function (veh, fromPath) { // exit nodes always have room
        return true;
    }
});

Traffic.CrossingNode = Traffic.Node.extend({ // direct crossing from corrisponding entry and exit paths

    crossingNode: true,

    create: function (props) {
        var G = this.extend(props);
        G.paths = [];
        G.entryPaths = [];
        return G;
    },
    
    hasPath: function (path) {
        this.entryPaths.push(path);
    },

    transferAllowed: function (veh, fromPath) {
        var pathNum = this.entryPaths.indexOf(fromPath);
        return this.paths[pathNum].addVehicle(veh);
    }

});

Traffic.ControlledNode = Traffic.Node.extend({
    
    controlledNode: true,
    stage: 0,
    green: true,

    create: function (props) {
        var G = this.extend(props);
        G.paths = [];
        G.entryPaths = [];
        return G;
    },

    hasPath: function (path) {
        this.entryPaths.push(path);
    },

    transferVehicle: function (veh, fromPath) {
        if (this.controller) {
            this.green = (this.controller.stage == this.stage);
        }

        if (this.green) {
            fromPath.unblocked();
            return this.transferAllowed(veh, fromPath);
        } else {
            if (Traffic.verbose) {
                console.log("Vehicle '" + veh.name + "' stopped at red light at node '" + this.name + "'");
            }
            fromPath.blocked();
            this.transferBlocked(veh, fromPath);
            return false;
        }
    },

    render: function (canvas) {

        if (this.green) {
            this.color = "#0f0";
        } else {
            this.color = "#f00";
        }
        this.parent.parent.render.call(this, canvas);

    }
});

Traffic.Path = Traffic.extend({
    
    name: "Un-named",
    start: null, // node that starts this path
    end: null, // node that ends this path
    color: "#00f",

    create: function (props) {
        var G = this.extend(props);
        G.start.addPath(G);
        G.end.hasPath(G);
        G.vehicles = [];
        return G;
    },

    toString: function () {
        return "Path: " + this.name;
    },

    blocked: function () {
        this.color = "#f00";
    },

    unblocked: function () {
        this.color = "#00f";
    },

    render: function (canvas) {
        canvas.beginPath();
        canvas.strokeStyle = this.color;
        canvas.lineWidth = (this.utilisation() / 10) + 1;
        canvas.moveTo(this.start.x + 10, this.start.y + 10);
        canvas.lineTo(this.end.x + 10, this.end.y + 10);
        canvas.stroke();

        var path = this;
        $.each(this.vehicles, function (pos) {
            this.render(canvas, path, pos);
        });
    },

    capacity: function () { // the maximum number of vehicle this path can hold
        //return 2; // should be based on the length of the path
        var x = Math.abs(this.start.x - this.end.x);
        var y = Math.abs(this.start.y - this.end.y);
        var h = Math.round(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) / Traffic.vehicleLengthInPixels);
        this.capacity = function () {
            return h;
        };
        return h;
    },

    utilisation: function () { // how full is this path?
        return (this.vehicles.length / this.capacity()) * 100;
    },

    addVehicle: function (veh) { // add a vehicle to this path
        if (this.vehicles.length < this.capacity()) {
            veh.exitPhase = Traffic.phase + this.capacity();
            this.vehicles.push(veh);
            if (Traffic.verbose) {
                console.log("Vehicle '" + veh.name + "' entered path '" + this.name + "'");
            }
            return true;
        } else if (this.capacity() == 0) { // short node, so push straight through to next path if possible
            return this.endNode.transferVehicle(veh, this);
        } else {
            if (Traffic.verbose) {
                console.log("Vehicle '" + veh.name + "' could not enter path '" + this.name + "'");
            }
            return false;
        }
    },

    removeVehicle: function () { // remove a vehicle from this path
        if (this.vehicles.length > 0) {
            this.vehicles.shift();
            return true;
        } else {
            return false;
        }
    }

});

Traffic.Vehicle = Traffic.extend({

    exitPhase: 0,
    color: "#333",

    render: function (canvas, path, pos) {

    }

});

Traffic.Controller = Traffic.extend({

    timing: 10,
    stages: 2,
    stage: 0,

    create: function (props) {
        var G = this.extend(props);
        return G;
    },

    next: function (phase) {
        this.stage = Math.floor(phase / this.timing) % this.stages;
    }

});