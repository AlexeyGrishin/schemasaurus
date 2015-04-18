"use strict";
var Generator = require('./gen');
var interpolate = require('../interpolate');

function CodeComposer() {
    this.codeLines = [];
    this.labelgen = new Generator('clabel');
}

CodeComposer.prototype = {
    pop: function () {
        this.codeLines.pop();
    },

    code: function (template) {
        this.codeLines.push(interpolate(template).apply(null, [].slice.call(arguments, 1)));
    },

    inline: function (fnInline, varName, stopLabel, allowReturn) {
        var fnbody = fnInline.toString()
                .replace(/^function\s*\([^)]*\)/, "")
                .replace(/_/g, varName),
            label = this.labelgen.next(),
            needLabel = fnbody.indexOf('return') !== -1;
        fnbody = fnbody.replace(/ctx\.stop\(\)/, "break " + stopLabel);
        if (!allowReturn) {
            fnbody = fnbody.replace(/return/g, "break " + label);
        }
        if (needLabel) {
            this.code("%%:{%%}", label, fnbody);
        } else {
            this.code(fnbody);
        }
    }
};

module.exports = CodeComposer;