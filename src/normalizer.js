"use strict";

function Normalizer() {

}

function notDefined(o) {
    return o === null || o === undefined;
}

Normalizer.prototype = {
    "[default]": function (schema, object, ctx) {
        if (notDefined(object)) {
            ctx.replace(schema.default);
        }
    },
    "[properties]": function (schema, object, ctx) {
        if (ctx.parent && notDefined(object)) {
            ctx.replace({});
        }
    },
    "[additionalProperty]": function (schema, object, ctx) {
        ctx.remove();
    },
    "[type]": function (schema, object, ctx) {
        var isTrue, isFalse;
        if (notDefined(object)) {
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