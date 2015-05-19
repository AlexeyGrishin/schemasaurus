"use strict";

function Normalizer() {

}

Normalizer.prototype = {
    "[default]": function (schema, object, ctx) {
        if (object === null || object === undefined) {
            ctx.replace(schema.default);
        }
    },
    "[additionalProperty]": function (schema, object, ctx) {
        ctx.remove();
    },
    "[type]": function (schema, object, ctx) {
        var isTrue, isFalse;
        if (object === null || object === undefined) {
            return;
        }
        switch (schema.type) {
        case 'null':
            ctx.replace(null);
            break;
        case 'string':
            ctx.replace(object.toString());
            break;
        case 'integer':
            ctx.replace(parseInt(object, 10));
            break;
        case 'number':
            ctx.replace(parseFloat(object));
            break;
        case 'boolean':
            isTrue = object === true || ['true', 'on'].indexOf(object.toString().toLowerCase()) !== -1;
            isFalse = object === false || ['false', 'off'].indexOf(object.toString().toLowerCase()) !== -1;
            ctx.replace(isTrue ? true : (isFalse ? false : !!object));
            break;
        case 'array':
            if (!Array.isArray(object)) {
                ctx.replace([object]);
            }
            break;
        case 'object':
            break;
        }
    },
    end: {inline: "return _"}
};

Normalizer.factory = function () {
    return new Normalizer();
};
module.exports = Normalizer;