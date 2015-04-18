"use strict";

function Generator(prefix) {
    this.i = 0;
    this.prefix = prefix;
    this.generated = [];
}

Generator.prototype = {
    next: function () {
        this.i = this.i + 1;
        var nv = this.prefix + this.i;
        this.generated.push(nv);
        return nv;
    }
};

module.exports = Generator;