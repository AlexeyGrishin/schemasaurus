"use strict";
function messages(gettext) {
    return {
        "type.string": gettext("shall be a string"),
        "type.null": gettext("shall be null"),
        "type.string.minLength": gettext("shall have length at least %d"),
        "type.string.maxLength": gettext("shall have length no more than %d"),
        "type.string.pattern": gettext("shall match pattern %s"),
        "type.string.format.email": gettext("is not a valid e-mail"),
        "type.integer": gettext("shall be an integer"),
        "type.integer.multipleOf": gettext("shall be multiple of %d"),
        "type.number": gettext("shall be a number"),
        "type.number.minimum": gettext("shall be >= %d"),
        "type.number.minimum.exclusive": gettext("shall be > %d"),
        "type.number.maximum": gettext("shall be <= %d"),
        "type.number.maximum.exclusive": gettext("shall be < %d"),
        "type.boolean": gettext("shall be boolean"),
        "type.object": gettext("shall be object"),
        "type.object.required": gettext("is required"),
        "type.object.additionalProperties": gettext("shall not have additional properties"),
        "type.object.minProperties": gettext("shall have at least %d properties"),
        "type.object.maxProperties": gettext("shall have no more than %d properties"),
        "type.array": gettext("shall be array"),
        "type.array.additionalItems": gettext("shall not have additional items"),
        "type.array.minItems": gettext("shall have at least %d items"),
        "type.array.maxItems": gettext("shall have no more %d items"),
        "type.array.uniqueItems": gettext("shall have unique items"),
        "type.enum": gettext("shall be one of values %s"),
        "required": gettext("is required"),
        "dependency": gettext("does not meet additional requirements for %s"),
        "not": gettext("does not meet 'not' requirement"),
        "oneOf": gettext("does not meet exactly one requirement"),
        "oneOf.zero": gettext("does not meet any requirement"),
        "allOf": gettext("does not meet all requirements"),
        "anyOf": gettext("does not meet any requirement")
    };
}

var formats = {};

function isObject(o) {
    return typeof o === 'object' && !Array.isArray(o) && o !== null;
}

function doValidate(msgs, formts) {
    var errors = [];

    function error(code, ctx, arg, subpath) {
        errors.push({
            code: code,
            message: msgs[code] || arg || (function () {throw new Error("There is no message registered for error '" + code + "'"); }()),
            value: ctx.value(),
            arg: arg,
            path: ctx.path().join(".").replace(/\.\[/g, "[") + (subpath ? "." + subpath : "")
        });
    }

    function errorIf(condition) {
        if (condition) {
            error.apply(null, [].slice.call(arguments, 1));
        }
    }

    function copyErrors(anotherErrors) {
        errors.splice.apply(errors, [errors.length, 0].concat(anotherErrors));
    }


    function toComparable(o) {
        return typeof o === 'object' ? JSON.stringify(o) : o;
    }

    return {
        "[^required]": function (schema, object, ctx, next) {
            var parent = ctx.parent().schema;
            if (parent && (object === undefined)) {
                //thats ok
                return;
            }
            next();
        },
        "[type]": function (schema, object, ctx, next) {
            var types = Array.isArray(schema.type) ? schema.type : [schema.type], i;
            for (i = 0; i < types.length; i = i + 1) {
                switch (types[i]) {
                case 'null':
                    if (object === null) {
                        return next();
                    }
                    break;
                case 'string':
                    if (typeof object === 'string') {
                        return next();
                    }
                    break;
                case 'integer':
                    if (typeof object === 'number' && object % 1 === 0) {
                        return next();
                    }
                    break;
                case 'number':
                    if (typeof object === 'number') {
                        return next();
                    }
                    break;
                case 'boolean':
                    if (typeof object === 'boolean') {
                        return next();
                    }
                    break;
                case 'array':
                    if (Array.isArray(object)) {
                        return next();
                    }
                    break;
                case 'object':
                    if (isObject(object)) {
                        return next();
                    }
                    break;
                }
            }
            types.forEach(function (type) {
                error("type." + type, ctx);
            });
        },

        //////////////// dependencies
        "[dependencies]": function (schema, object, ctx, next) {
            var prop, dep, res;
            for (prop in schema.dependencies) {
                if (schema.dependencies.hasOwnProperty(prop)) {
                    dep = schema.dependencies[prop];
                    if (Array.isArray(dep)) {
                        dep = {required: dep};
                    }
                    if (object.hasOwnProperty(prop)) {
                        res = ctx.visit(dep, object);
                        if (!res.valid) {
                            error("dependency", ctx, prop);
                            copyErrors(res.errors);
                        }
                    }
                }
            }
            next();
        },

        //////////////// combining

        "[allOf]": function (schema, object, ctx, next) {
            ctx.visit(schema.allOf, object).forEach(function (res) {
                if (!res.valid) {
                    error("allOf", ctx);
                    copyErrors(res.errors);
                }
            });
            next();
        },
        "[anyOf]": function (schema, object, ctx, next) {
            var allErrors = [],
                res = ctx.visit(schema.anyOf, object).some(function (res) {
                    allErrors = allErrors.concat(res.errors);
                    return res.valid;
                });
            if (!res) {
                error("anyOf", ctx);
                copyErrors(allErrors);
            }
            next();
        },
        "[oneOf]": function (schema, object, ctx, next) {
            var count = 0, allErrors = [];
            ctx.visit(schema.oneOf, object).forEach(function (res) {
                allErrors = allErrors.concat(res.errors);
                if (res.valid) {
                    count = count + 1;
                }
            });
            if (count === 0) {
                error("oneOf.zero", ctx);
                copyErrors(allErrors);
            } else if (count !== 1) {
                error("oneOf", ctx);
            }
            next();
        },

        "[not]": function (schema, object, ctx, next) {
            var res = ctx.visit(schema.not, object);
            if (res.valid) {
                error("not", ctx);
            }
            next();
        },

        //////////////// enum

        "[enum]": function (schema, object, ctx, next) {
            var val = toComparable(object), vals;
            schema.$$enum = schema.$$enum || schema.enum.map(toComparable);
            vals = schema.$$enum;
            errorIf(vals.indexOf(val) === -1, "type.enum", ctx, schema.enum);
            next();
        },

        //////////////// string

        "[maxLength]": function (schema, object, ctx, next) {
            if (typeof object !== 'string') {
                return next();
            }
            errorIf(object.length > schema.maxLength, "type.string.maxLength", ctx, schema.maxLength);
            next();
        },
        "[minLength]": function (schema, object, ctx, next) {
            if (typeof object !== 'string') {
                return next();
            }
            errorIf(object.length < schema.minLength, "type.string.minLength", ctx, schema.minLength);
            next();
        },
        "[pattern]": function (schema, object, ctx, next) {
            if (typeof object !== 'string') {
                return next();
            }
            errorIf(!object.match(schema.pattern), "type.string.pattern", ctx, schema.pattern);
            next();
        },
        "[type=string][format]": function (schema, object, ctx) {
            var fmt = formts[schema.format];
            if (!fmt) {
                throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
            }
            //noinspection JSLint
            errorIf(!((fmt.regexp instanceof RegExp) ? fmt.regexp.test(object) : fmt.test(object, schema)), "type.string.format." + fmt.name, ctx, fmt.message);
        },
        "[type=string][^format]": function () //noinspection JSLint
        {/*stop*/},

        //////////////// array

        "[additionalItems=false]": function (schema, object, ctx, next) {
            if (!Array.isArray(object)) {
                return next();
            }
            errorIf(schema.items && object.length > schema.items.length, "type.array.additionalItems", ctx);
            next();
        },

        "[minItems]": function (schema, object, ctx, next) {
            if (!Array.isArray(object)) {
                return next();
            }
            errorIf(object.length < schema.minItems, "type.array.minItems", ctx);
            next();
        },

        "[maxItems]": function (schema, object, ctx, next) {
            if (!Array.isArray(object)) {
                return next();
            }

            errorIf(object.length > schema.maxItems, "type.array.maxItems", ctx);
            next();
        },

        "[uniqueItems]":  function (schema, object, ctx, next) {
            if (!Array.isArray(object)) {
                return next();
            }

            var its = {}, i, o;
            for (i = 0; i < object.length; i = i + 1) {
                o = toComparable(object[i]);
                errorIf(its[o], "type.array.uniqueItems", ctx, object[i]);
                its[o] = true;
            }
            next();
        },

        //////////////// object

        "[required][^properties]": function (schema, object, ctx, next) {
            if (!isObject(object)) {
                return next();
            }
            var i;
            for (i = 0; i < schema.required.length; i = i + 1) {
                errorIf(!object.hasOwnProperty(schema.required[i]), "type.object.required", ctx, null, schema.required[i]);
            }
            next();

        },
        "[properties]": function (schema, object, ctx, next) {
            if (!isObject(object)) {
                return next();
            }
            schema.$keys = Object.keys(schema.properties);
            var required = (schema.required || []).concat(schema.$keys.filter(function (key) {
                return schema.properties[key].required === true;
            })), i;
            for (i = 0; i < required.length; i = i + 1) {
                errorIf(!object.hasOwnProperty(required[i]), "type.object.required", ctx, null, required[i]);
            }
            next();
        },

        "[maxProperties]": function (schema, object, ctx, next) {
            if (!isObject(object)) {
                return next();
            }
            errorIf(Object.keys(object).length > schema.maxProperties, "type.object.maxProperties", ctx, schema.maxProperties);
            next();
        },

        "[minProperties]": function (schema, object, ctx, next) {
            if (!isObject(object)) {
                return next();
            }
            errorIf(Object.keys(object).length < schema.minProperties, "type.object.minProperties", ctx, schema.minProperties);
            next();
        },

        "[additionalAllowed=true]": function () {
            /* just skip*/
        },

        "[additionalAllowed=false]": function (schema, object, ctx, next) {
            error("type.object.additionalProperties", ctx);
            next();
        },

        ///////////// integer

        "[multipleOf]": function (schema, object, ctx, next) {
            if (typeof object !== 'number') {
                return next();
            }
            var dv = object / schema.multipleOf;
            errorIf((dv % 1) !== 0, "type.integer.multipleOf", ctx, schema.multipleOf);
            next();
        },
        "[minimum]": function (schema, object, ctx, next) {
            errorIf(schema.exclusiveMinimum ? object <= schema.minimum : object < schema.minimum, "type.number.minimum" + (schema.exclusiveMinimum ? ".exclusive" : ""), ctx, schema.minimum);
            next();
        },
        "[maximum]": function (schema, object, ctx, next) {
            errorIf(schema.exclusiveMaximum ? object >= schema.maximum : object > schema.maximum, "type.number.maximum" + (schema.exclusiveMaximum ? ".exclusive" : ""), ctx, schema.maximum);
            next();
        },
        done: function () {
            return {valid: errors.length === 0, errors: errors};
        }
    };

}


module.exports = function (options) {
    if (options === undefined) {
        options = {};
    }
    var msgs = options.messages || messages(options.gettext || function (m) { return m; }),
        formts = {},
        fi;

    if (options.formats) {
        for (fi = 0; fi < options.formats.length; fi = fi + 1) {
            formts[options.formats[fi].name] = options.formats[fi];
        }
    }
    for (fi in formats) {
        if (formats.hasOwnProperty(fi)) {
            formts[fi] = formats[fi];
        }
    }

    return doValidate.bind(null, msgs, formts);
};

module.exports.meta = {
    addFormat: function (format) {
        formats[format.name] = format;
    }
};

//TODO: hostname,ip,date-time,uri - look at http://spacetelescope.github.io/understanding-json-schema/reference/string.html
module.exports.meta.addFormat({name: "email", regexp: /^[^@]+@[^@]+$/});