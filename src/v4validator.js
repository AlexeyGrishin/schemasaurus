function messages(gettext) {
    return {
        "type.string": gettext("shall be a string"),
        "type.string.minLength": gettext("shall have length at least %d"),
        "type.string.maxLength": gettext("shall have length no more than %d"),
        "type.string.pattern": gettext("shall match pattern %s"),
        "type.string.format.email": gettext("is not a valid e-mail"),
        "type.integer": gettext("shall be an integer"),
        "type.integer.multipleOf": gettext("shall be multiple of %d"),
        "type.number": gettext("shall be a number"),
        "type.number.minimum": gettext("shall be >= %d"),
        "type.number.maximum": gettext("shall be <= %d"),
        "type.boolean": gettext("shall be boolean"),
        "required": gettext("is required")
    }
}

var formats = {};

module.exports = function(gettext_or_msg) {
    if (typeof gettext_or_msg === 'undefined') gettext_or_msg = function(m) { return m;};
    var msgs = typeof gettext_or_msg === 'object' ? gettext_or_msg : messages(gettext_or_msg);


    var errors = [];

    function error(code, ctx, arg) {
        errors.push({
            code: code,
            message: msgs[code] || arg || (function() {throw new Error("There is no message registered for error '" + code + "'")}()),
            value: ctx.value(),
            arg: arg,
            path: ctx.path().join(".").replace(/\.\[/g, "[")
        });
    }

    function errorIf(condition) {
        if (condition) error.apply(null, [].slice.call(arguments, 1));
    }

    return {
        "[required=true]": function(schema, object, ctx, next) {
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
        },
        "[type=string]": function(schema, object, ctx, next) {
            errorIf(typeof object !== 'string', "type.string", ctx);
            if (schema.minLength) {
                errorIf(object.length < schema.minLength, "type.string.minLength", ctx, schema.minLength);
            }
            if (schema.maxLength) {
                errorIf(object.length > schema.maxLength, "type.string.maxLength", ctx, schema.maxLength);
            }
            if (schema.pattern) {
                errorIf(!object.match(schema.pattern), "type.string.pattern", ctx, schema.pattern);
            }
            next();
        },
        "[type=string][format=email]": function(schema, object, ctx) {
            errorIf(!object.match(/^[^@]+@[^@]+$/), "type.string.format.email", ctx);
        },
        //TODO: hostname,ip,date-time,uri - look at http://spacetelescope.github.io/understanding-json-schema/reference/string.html
        "[type=string][format]": function(schema, object, ctx) {
            var fmt = formats[schema.format];
            if (!fmt) throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
            errorIf(!(fmt.regexp instanceof RegExp ? fmt.regexp.test(object) : fmt.test(object, schema)), "type.string.format." + fmt.name, ctx, fmt.message);
        },
        "[type=string][^format]": function() {/*stop*/},
        "[multipleOf]": function(schema, object, ctx, next) {
            errorIf(object % schema.multipleOf !== 0, "type.integer.multipleOf", ctx, schema.multipleOf);
            next();
        },
        "[type=integer]": function(schema, object, ctx, next) {
            errorIf(typeof object !== 'number' || object%1!=0, "type.integer", ctx);
        },
        "[type=number]": function(schema, object, ctx, next) {
            errorIf(typeof object !== 'number', "type.number", ctx);
            errorIf(typeof schema.minimum !== 'undefined' && object < schema.minimum, "type.number.minimum", ctx, schema.minimum);
            errorIf(typeof schema.maximum !== 'undefined' && object > schema.maximum, "type.number.maximum", ctx, schema.maximum);
            //TODO: exclusiveMinimum and exclusiveMaximum
        },
        "[type=boolean]": function(schema, object, ctx, next) {
            errorIf(typeof object !== 'boolean', "type.boolean", ctx);
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