"use strict";
var Generator = require('./gen');
var interpolate = require('../interpolate');

function CodeComposer() {
    this.codeLines = [];
    this.labelgen = new Generator('clabel');
}


function prettifyCode(codeLines) {
    var offset = "", step = "  ", line, idx, openBrace, closeBrace;
    for (idx = 0; idx < codeLines.length; idx = idx + 1) {
        line = codeLines[idx].trim();
        openBrace = line.indexOf("{") !== -1;
        closeBrace = line.indexOf("}") !== -1;
        if (closeBrace && !openBrace) {
            offset = offset.substring(0, offset.length - step.length);
        }
        line = offset + line;
        if (openBrace && !closeBrace) {
            offset = offset + step;
        }
        codeLines[idx] = line;
    }
    return codeLines;
}

CodeComposer.prototype = {
    pop: function () {
        this.codeLines.pop();
    },

    code: function (template) {
        this.codeLines.push(interpolate(template).apply(null, [].slice.call(arguments, 1)));
    },

    prettify: function () {
        return prettifyCode(this.codeLines);
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