"use strict";
/*
  if (!isdefined(object.intProp) object.intProp = schema.intProp.default;
  if (object.arrProp) {
    //for each, etc.
  }
 */
module.exports = function (schemaTop, objectTop) {
    return {
        "[default]": function (schema, object, ctx, next) {
            if (object === null || object === undefined) {
                ctx.replace(schema.default);
            }
            next();
        },
        "[additionalAllowed]": function (schema, object, ctx, next) {
            ctx.remove();
            next();
        },
        "[type]": function (schema, object, ctx, next) {
            if (object === null || object === undefined) return next();
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
            next();
        },
        done: function () {
            return objectTop;
        }
    };
};