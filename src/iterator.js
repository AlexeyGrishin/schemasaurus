"use strict";

function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function Iterator(schema, callbackConv) {
    if (!schema) throw new Error("schema shall not be null");
    if (typeof schema !== 'object') throw new Error("schema shall be an object");
    if (!Object.keys(attrs).concat(["type"]).some(function(attr) { return schema[attr]; })) {
        schema = {type: "object", properties: schema};
    }
    this.schema = clone(schema);
    this.callbackConv = callbackConv || function(c) { return c; };
}

var types = {};
var attrs = {};


Iterator.prototype.iterate = function(object, callback) {
    if (typeof callback === 'undefined') {
        callback = object;
        object = undefined;
    }
    callback = this.callbackConv(callback);
    if (typeof callback === "undefined") throw new Error("Callback shall be specified");

    var path = [], stack = [];
    var ctx = {
        path: function() { return path;},
        attribute: undefined,
        parent: function(n) { return stack[n || 1]; }
    };
    var c = {
        schemaOnly: typeof object === 'undefined',
        visit: function(schemaNode, objectNode, step) {
            if (step) path.push(step);
            stack.unshift([schemaNode, objectNode]);
            var customVisitor;
            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr) && schemaNode.hasOwnProperty(attr)) {
                    customVisitor = attrs[attr];
                    break;
                }
            }
            if (!customVisitor) {
                callback(schemaNode, objectNode, ctx);
                customVisitor = types[schemaNode.type];
            }
            if (customVisitor) {
                customVisitor(schemaNode, objectNode, c);
            }
            stack.shift();
            if (step) path.pop();
        },
        parent: function(n) {
            n = n || 1;
            return stack[n];
        },
        report: function(attribute) {
            ctx.attribute = attribute;
            callback(stack[0][0], stack[0][1], ctx);
            ctx.attribute = undefined;
        }
    };
    if (Object.defineProperty) {
        Object.keys(c).forEach(function(k) {
            Object.defineProperty(c, k, {editable: false, value: c[k]});
        })
    }

    c.visit(this.schema, object);
    return callback();

};

Iterator.meta = {
    type: function(type, visitor) {
        types[type] = visitor;
    },
    attr: function(attr, visitor) {
        attrs[attr] = visitor;
    },
    plugin: function() {

    }
};

module.exports = Iterator;

