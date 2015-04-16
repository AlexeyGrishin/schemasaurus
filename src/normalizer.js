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
    "[type]": function (schema, object, ctx, next) {
        if (object === null || object === undefined) return;
        switch (schema.type) {
            case 'null':
                ctx.replace(null);
                break;
            case 'string':
                ctx.replace(object.toString());
                break;
            case 'integer':
                ctx.replace(parseInt(object));
                break;
            case 'number':
                ctx.replace(parseFloat(object));
                break;
            case 'boolean':
                var isTrue = ['true', 'on'].indexOf(object.toLowerCase()) != -1;
                var isFalse = ['false', 'off'].indexOf(object.toLowerCase()) != -1;
                ctx.replace(isTrue ? true: (isFalse ? false : !!object));
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

Normalizer.factory = function() {
    return new Normalizer();
};
module.exports = Normalizer;