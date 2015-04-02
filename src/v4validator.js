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
        "type.array": gettext("shall be array"),
        "required": gettext("is required")
    }
}

var formats = {};

module.exports = function(gettext_or_msg) {
    if (typeof gettext_or_msg === 'undefined') gettext_or_msg = function(m) { return m;};
    var msgs = typeof gettext_or_msg === 'object' ? gettext_or_msg : messages(gettext_or_msg);


    var errors = [];

    function error(code, ctx, arg, subpath) {
        errors.push({
            code: code,
            message: msgs[code] || arg || (function() {throw new Error("There is no message registered for error '" + code + "'")}()),
            value: ctx.value(),
            arg: arg,
            path: ctx.path().join(".").replace(/\.\[/g, "[") + (subpath ? "." + subpath : "")
        });
    }

    function errorIf(condition) {
        if (condition) error.apply(null, [].slice.call(arguments, 1));
    }

    return {
        /*"[required=true]": function(schema, object, ctx, next) {
            if (typeof object === 'undefined' || object === null) {
                return error("required", ctx);
            }
            next();
        },
        "[^required]": function(schema, object, ctx, next) {
            if (typeof object === 'undefined' || object === null) {
                //thats ok
                return;
            }
            next();
        },*/
        "[type]": function(schema, object, ctx, next) {
            var types = Array.isArray(schema.type) ? schema.type : [schema.type];
            for (var i = 0; i < types.length; i++) {
                switch (types[i]) {
                    case 'null':
                        if (object === null) return next();
                        break;
                    case 'string':
                        if (typeof object === 'string') return next();
                        break;
                    case 'integer':
                        if (typeof object === 'number' && object%1===0) return next();
                        break;
                    case 'number':
                        if (typeof object === 'number') return next();
                        break;
                    case 'boolean':
                        if (typeof object === 'boolean') return next();
                        break;
                    case 'array':
                        if (Array.isArray(object)) return next();
                        break;
                    case 'object':
                        if (typeof object === 'object' && !Array.isArray(object) && object !== null) return next();
                }
            }
            types.forEach(function(type) {
                error("type." + type, ctx);
            })
        },

        //////////////// string

        "[maxLength]": function(schema, object, ctx, next) {
            if (typeof object !== 'string') return next();
            errorIf(object.length > schema.maxLength, "type.string.maxLength", ctx, schema.maxLength);
            next();
        },
        "[minLength]": function(schema, object, ctx, next) {
            if (typeof object !== 'string') return next();
            errorIf(object.length < schema.minLength, "type.string.minLength", ctx, schema.minLength);
            next();
        },
        "[pattern]": function(schema, object, ctx, next) {
            if (typeof object !== 'string') return error("type.string", ctx);
            errorIf(!object.match(schema.pattern), "type.string.pattern", ctx, schema.pattern);
            next();
        },
        "[type=string][format]": function(schema, object, ctx) {
            var fmt = formats[schema.format];
            if (!fmt) throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
            errorIf(!(fmt.regexp instanceof RegExp ? fmt.regexp.test(object) : fmt.test(object, schema)), "type.string.format." + fmt.name, ctx, fmt.message);
        },
        "[type=string][^format]": function() {/*stop*/},

        //////////////// object

        "[properties]": function(schema, object, ctx, next) {
            schema.$keys = Object.keys(schema.properties);
            var required = (schema.required || []).concat(schema.$keys.filter(function(key) {
                return schema.properties[key].required === true;
            }));
            for (var i = 0; i < required.length; i++) {
                errorIf(!object.hasOwnProperty(required[i]), "type.object.required", ctx, null, required[i]);
            }
            next();
        },

        "[additionalProperties=false]": function(schema, object, ctx, next) {
            var schemaKeys = schema.$keys || [];
            for (var k in object) {
                if (object.hasOwnProperty(k)) {
                    errorIf(schemaKeys.indexOf(k) == -1, "type.object.additionalProperties", ctx);
                }
            }
            next();
        },

        ///////////// integer

        "[multipleOf]": function(schema, object, ctx, next) {
            if(typeof object !== 'number') return next();
            var dv = object / schema.multipleOf;
            errorIf((dv|0) !== dv, "type.integer.multipleOf", ctx, schema.multipleOf);
            next();
        },
        "[minimum]": function(schema, object, ctx, next) {
            errorIf(schema.exclusiveMinimum ? object <= schema.minimum : object < schema.minimum, "type.number.minimum" + (schema.exclusiveMinimum ? ".exclusive" : ""), ctx, schema.minimum);
            next();
        },
        "[maximum]": function(schema, object, ctx, next) {
            errorIf(schema.exclusiveMaximum ? object >= schema.maximum : object > schema.maximum, "type.number.maximum" + (schema.exclusiveMaximum ? ".exclusive" : ""), ctx, schema.maximum);
            next();
        },
        done: function() {
            return {valid: errors.length == 0, errors: errors};
        }
    }

};

module.exports.meta = {
    addFormat: function(format) {
        formats[format.name] = format;
    }
};

//TODO: hostname,ip,date-time,uri - look at http://spacetelescope.github.io/understanding-json-schema/reference/string.html
module.exports.meta.addFormat({name: "email", regexp: /^[^@]+@[^@]+$/});