"use strict";

var attrRe = /(\[(\^?[\-_\w]+)(=[\-_\w]+)?\])/g;
var modRe = /:([\-\w]+)$/;

function parseValue(valAsStr) {
    if (valAsStr === null) {
        return null;
    }
    var val = parseFloat(valAsStr);
    if (!isNaN(val)) {
        return val;
    }
    if (valAsStr === "true") {
        return true;
    }
    if (valAsStr === "false") {
        return false;
    }
    return valAsStr;
}

function matchEq(value1, value2) {
    return value1 !== undefined && (value1 === value2 || value2 === undefined);
}

function matchNotEq(value1, value2) {
    return value1 === undefined || (value1 !== value2 && value2 !== undefined);
}

function createMatcher(expr) {
    var ma = modRe.exec(expr), props = [], attr, not, i;
    if (ma) {
        attr = ma[1];
    }
    ma = attrRe.exec(expr);
    while (ma) {
        not = ma[2][0] === '^';
        props.push({
            name: not ? ma[2].substring(1) : ma[2],
            matcher: not ? matchNotEq : matchEq,
            value: ma[3] ? parseValue(ma[3].substring(1)) : undefined
        });
        ma = attrRe.exec(expr);
    }
    return function (schema, att, cb) {
        var sv, found = true;
        if (att !== attr) {
            return false;
        }
        for (i = 0; i < props.length; i = i + 1) {
            sv = schema[props[i].name];
            if (!props[i].matcher(sv, props[i].value)) {
                found = false;
                break;
            }
        }
        if (found) {
            return cb(expr);
        }
    };

}

module.exports = function (expr) {
    if (expr.indexOf(":") !== -1 || expr.indexOf("[") !== -1) {
        return createMatcher(expr);
    }
};