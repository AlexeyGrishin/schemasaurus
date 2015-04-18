"use strict";

function Shared() {
    this.innerFns = [];
    this.schemas = [];
}

Shared.prototype = {
    inner: function (fn) {
        this.innerFns.push(fn);
        return "innerFns[" + (this.innerFns.length - 1) + "]";
    },
    schema: function (s) {
        this.schemas.push(s);
        return "schemas[" + (this.schemas.length - 1) + "]";
    }
};

module.exports = Shared;