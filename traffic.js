
var Traffic = {
    tick: 1000,
    vehicleLengthInPixels: 50, // length of one vehicle as drawn on the canvas
    name: null,
    phase: 0,
    extend: function (obj) {
        function F() {};
        F.prototype = this;
        var G = new F();
        for (member in obj) {
            G[member] = obj[member];
        }
        return G;
    },
    create: function (props) {
        return this.extend(props);
    }
};

Traffic.run = function (canvas, startNodes) {
    var context = canvas[0].getContext("2d");
    return window.setInterval(function () {
    //return window.setTimeout(function () {
        context.clearRect(0, 0, canvas.width(), canvas.height());
        Traffic.render.nodeRendered = [];
        $.each(startNodes, function () {
            Traffic.render(canvas, this);
            if (Traffic.phase % this.frequency == 0) {
                this.addVehicle({
                    name: "from " + this.name
                }); // increment start node
            }
        });
        $.each(startNodes, function () {
            this.reset();
        });
        Traffic.phase++;
    }, Traffic.tick);
};

Traffic.render = function (canvas, node) {
    var context = canvas[0].getContext("2d");
    node.render(context);
    if (node.paths) {
        $.each(node.paths, function () {
            if (Traffic.render.nodeRendered.indexOf(this) == -1) {
                Traffic.render.nodeRendered.push(this);
                this.render(context);
                Traffic.render(canvas, this.endNode);
                if (this.vehicles.length > 0) {
                    var veh = this.vehicles[0];
                    if (veh.exitPhase <= Traffic.phase) {
                        if (this.endNode.addVehicle(veh, this)) {
                            this.removeVehicle();
                        }
                    }
                }
            }
        });
    }
};

Traffic.Node = Traffic.extend({
    
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
        canvas.arc(this.x, this.y, 5, 0, 360, false);
        canvas.fill();
        canvas.stroke();
    },

    addPath: function (path) {
        this.paths.push(path);
    },

    addVehicle: function (veh, fromPath) { // add a vehicle to a path from this node
        veh = veh || Traffic.Vehicle.create();
        fromPath = fromPath || {};
        if (
            typeof this.paths == "undefined" || this.paths.length == 0 || // there are no onward paths (is a dead end)
            this.busy // (is busy with another vehicle)
        ) {
            console.log("Vehicle '" + veh.name + "' waiting at '" + this.name + "'");
            this.busy = true;
            fromPath.color = "#f00";
            return false;
        } else {
            this.busy = true;
            fromPath.color = "#00f";
            var pathNum = Math.floor(Math.random() * this.paths.length);
            return this.paths[pathNum].addVehicle(veh);
        }
    },

    reset: function () {
        this.busy = false;
        if (this.paths) {
            $.each(this.paths, function () {
                this.endNode.reset();
            });
        }
    }

});

Traffic.StartNode = Traffic.Node.extend({
    frequency: 1,
});

Traffic.EndNode = Traffic.Node.extend({
    addVehicle: function (veh, fromPath) { // exit nodes always have room
        console.log("Vehicle '" + veh.name + "' exits from node '" + this.name + "'");
        return true;
    }
});

Traffic.Path = Traffic.extend({
    
    startNode: null, // node that starts this path
    endNode: null, // node that ends this path
    color: "#00f",

    create: function (startNode, endNode) {
        var G = this.extend({
            startNode: startNode,
            endNode: endNode
        });
        startNode.addPath(G);
        G.vehicles = [];
        return G;
    },

    toString: function () {
        return "Path: " + this.name;
    },

    render: function (canvas) {
        canvas.beginPath();
        canvas.strokeStyle = this.color;
        canvas.lineWidth = (this.utilisation() / 10) + 1;
        canvas.moveTo(this.startNode.x, this.startNode.y);
        canvas.lineTo(this.endNode.x, this.endNode.y);
        canvas.stroke();
    },

    capacity: function () { // the maximum number of vehicle this path can hold
        //return 2; // should be based on the length of the path
        var x = Math.abs(this.startNode.x - this.endNode.x);
        var y = Math.abs(this.startNode.y - this.endNode.y);
        var h = Math.ceil(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) / Traffic.vehicleLengthInPixels);
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
            return true;
        } else {
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
    exitPhase: 0
});