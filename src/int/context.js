"use strict";

function CurrentObject(path) {
    this.path = path ? path.slice() : [];
    this.stack = new Array(100);
    this.si = 0;
    this.parent = null;
    this.property = null;
    this.self = null;
}

CurrentObject.prototype = {
    reset: function (path, self) {
        if (path) {
            this.path = path.slice();
        }
        this.self = self;
    },
    replace: function (newVal) {
        if (!this.parent) {
            throw new Error("Cannot replace top-level object. Check in your iterator that `ctx.parent` is defined");
        }
        this.parent[this.property] = newVal;
        this.replaced = true;
    },
    wasReplaced: function () {
        var val = this.replaced;
        this.replaced = false;
        return val;
    },
    replacement: function () {
        return this.parent[this.property];
    },
    remove: function () {
        delete this.parent[this.property];
    },
    push: function (prop, parent, self) {
        this.path.push(prop);
        this.stack[this.si] = [prop, parent, self];
        this.si = this.si + 1;
        this.property = prop;
        this.parent = parent;
        this.self = self;
    },
    stop: function () {
        this.stopped = true;
    },
    isStopped: function () {
        if (this.stopped) {
            this.stopped = false;
            return true;
        }
        return false;
    },
    pop: function () {
        this.si = this.si - 1;
        this.path.pop();
        var last = this.stack[this.si];
        if (last) {
            this.parent = last[0];
            this.property = last[1];
            this.self = last[2];
        }
    }
};

module.exports = CurrentObject;