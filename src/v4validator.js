"use strict";

function messages(gettext) {
    return {
        "type.string": gettext("shall be a string"),
        "type.null": gettext("shall be null"),
        "type.string.minLength": gettext("shall have length at least %d"),
        "type.string.maxLength": gettext("shall have length no more than %d"),
        "type.string.pattern": gettext("shall match pattern %s"),
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

function isObject(o) {
    return typeof o === 'object' && !Array.isArray(o) && o !== null;
}

function fillDefaultFormats(formats) {
    formats.email = formats.email || {
        regexp: /^[^@]+@[^@]+$/,
        message: "shall be valid email"
    };
    formats["date-time"] = formats["date-time"] || {
        regexp: /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-[0-9]{2}[tT ]\d{2}:\d{2}:\d{2}(\.\d+)?([zZ]|[+-]\d{2}:\d{2})$/,
        message: "shall be valid date"
    };
    formats.ipv4 = formats.ipv4 || {
        regexp: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        message: "shall be valid ipv4 address"
    };
    formats.ipv6 = formats.ipv6 || {
        regexp: /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/,
        message: "shall be valid ipv6 address"
    };
    formats.uri = formats.uri || {
        regexp:  /^[a-zA-Z][a-zA-Z0-9+-.]*:[^\s]*$/,
        message: "shall be valid URI"
    };
    formats.hostname = formats.hostname || {
        regexp:  /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$/,
        message: "shall be valid host name"
    };
}

function V4Validator(options) {
    this.options = options || {};
    if (!this.options.messages) {
        this.options.messages = messages(this.options.gettext || function (s) { return s; });
    }
    this.formats = this.options.formats || {};
    fillDefaultFormats(this.formats);
    this.errors = [];
    this.res = {
        valid: true,
        errors: this.errors
    };
}

V4Validator.prototype = {
    toComparable: function (o) {
        return typeof o === 'object' ? JSON.stringify(o) : o;
    },
    error: function (code, ctx, arg, subpath) {
        this.errors.push({
            code: code,
            message: this.options.messages[code] || arg || (function () {throw new Error("There is no message registered for error '" + code + "'"); }()),
            value: ctx.self,
            arg: arg,
            path: ctx.path.join(".") + (subpath ? "." + subpath : "")
        });
    },
    errorIf: function (condition, code, ctx, arg, subpath) {
        if (condition) {
            this.errors.push({
                code: code,
                message: this.options.messages[code] || arg || (function () {throw new Error("There is no message registered for error '" + code + "'"); }()),
                value: ctx.self,
                arg: arg,
                path: ctx.path.join(".") + (subpath ? "." + subpath : "")
            });
        }
    },
    copyErrors: function (anotherErrors) {
        this.errors.splice.apply(this.errors, [this.errors.length, 0].concat(anotherErrors));
    },
    "[^required]": {prepare: function (s, ctx) {
        if (!ctx.parent) return null;
        return {inline: "if (_ === undefined) ctx.stop()"};
    }},
    "[type=string]": {inline: function (_, ctx) {
        if(typeof _ !== 'string') this.error('type.string', ctx);
    }},
    "[type=number]": {inline: function (_, ctx) {
        if(typeof _ !== 'number') this.error('type.number', ctx);
    }},
    "[type=integer]": {inline: function (_, ctx) {
        if((typeof _ !== 'number') || (_ % 1 !== 0)) this.error('type.integer', ctx);
    }},
    "[type=null]": {inline: function (_, ctx) {
        if(_ !== null) this.error('type.null', ctx);
    }},
    "[type=boolean]": {inline: function (_, ctx) {
        if(typeof _ !== 'boolean') this.error('type.boolean', ctx);
    }},
    "[type=array]": {inline: function (_, ctx) {
        if(!Array.isArray(_)) this.error('type.array', ctx);
    }},
    "[type=object]": {inline: function (_, ctx) {
        if(Array.isArray(_) || typeof _ !== 'object' || _ === null) this.error('type.object', ctx);
    }},
    "[type]": function (schema) {
        if (Array.isArray(schema.type)) {
            var fns = [];
            for (var i = 0; i < schema.type.length; i++) {
                fns.push(this["[type=" + schema.type[i] + "]"].inline);
            }
            return function (s, o, ctx) {
                var old = this.errors;
                var newErrs = [];
                this.errors = newErrs;
                for (var i = 0; i < fns.length; i++) {
                    fns[i].call(this, o, ctx);
                }

                this.errors = old;
                if (newErrs.length === fns.length) {
                    this.copyErrors(newErrs);
                }

            }
        }
    },

    //////////////// dependencies

    "[dependencies]": function (schema, ctx) {
        var prop, icode = [], dep, fnName;

        for (prop in schema.dependencies) {
            if (schema.dependencies.hasOwnProperty(prop)) {
                dep = schema.dependencies[prop];
                if (Array.isArray(dep)) {
                    dep = {required: dep};
                }
                fnName = 'dep' + prop;
                ctx.compile(dep, fnName);

                icode.push("if (_.hasOwnProperty('" + prop + "')) {");
                icode.push("var res = ctx." + fnName + "(_);");
                icode.push("if (!res.valid) { this.error('dependency', ctx, " + JSON.stringify(schema.dependencies[prop]) + "); this.copyErrors(res.errors); }");
                icode.push("}");
            }
        }
        return {inline: icode.join("\n")}
    },

    //////////////// combining

    "[allOf]": {inline: function (_, ctx) {
        for (var i = 0; i < ctx.allOf.length; i++) {
            var res = ctx.allOf[i](_);

            if (!res.valid) {
                this.error("allOf", ctx);
                this.copyErrors(res.errors);
            }
        }
    }},

    "[anyOf]": {inline: function (_, ctx) {
        var allErrors = [], res;
        for (var i = 0; i < ctx.anyOf.length; i++) {
            res = ctx.anyOf[i](_);
            allErrors = allErrors.concat(res.errors);
            if (res.valid) break;
        }
        if (!res.valid) {
            this.error("anyOf", ctx);
            this.copyErrors(allErrors);
        }
    }},

    "[oneOf]": {inline: function (_, ctx) {
        var count = 0, allErrors = [], res;
        for (var i = 0; i < ctx.oneOf.length; i++) {
            res = ctx.oneOf[i](_);
            allErrors = allErrors.concat(res.errors);
            if (res.valid) count++;
        }
        if (count === 0) {
            this.error("oneOf.zero", ctx);
            this.copyErrors(allErrors);
        } else if (count !== 1) {
            this.error("oneOf", ctx);
        }

    }},

    "[not]": {inline: function (_, ctx) {
        var res = ctx.not(_);
        if (res.valid) {
            this.error("not", ctx);
        }
    }},


    ///////////////// enum
    "[enum]": function (schema) {
        this.$enums = this.$enums || [];
        var $enum = {};
        for (var i = 0; i < schema.enum.length; i++) {
            var e = schema.enum[i];
            $enum[this.toComparable(e)] = 1;
        }
        this.$enums.push($enum);
        return {inline: "if(!this.$enums[" + (this.$enums.length-1) + "][this.toComparable(_)]) this.error('type.enum', ctx, " + JSON.stringify(schema.enum) + ")"};
    },

    //////////////// string

    "[maxLength]": function (schema) {
        return {inline: "if (typeof _ === 'string' && _.length > " + schema.maxLength + ") this.error('type.string.maxLength', ctx, " + schema.maxLength + ")"}
    },
    "[minLength]": function (schema) {
        return {inline: "if (typeof _ === 'string' && _.length < " + schema.minLength + ") this.error('type.string.minLength', ctx, " + schema.minLength + ")"}
    },
    "[pattern]": function (schema) {
        return {inline: "if (typeof _ === 'string' && !_.match(/" + schema.pattern + "/)) this.error('type.string.pattern', ctx, " + JSON.stringify(schema.pattern) + ")"}
    },
    "[format]": function (schema) {
        var fmt = this.formats[schema.format];
        if (!fmt) {
            throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
        }
        return {inline: "if (typeof _ === 'string' && !_.match(" + fmt.regexp + ")) this.error('type.string.format." + schema.format + "', ctx, " + JSON.stringify(fmt.message) + ")"}
    },

    ////////////////// array

    "[additionalItem=false]": {inline: function (_, ctx) {
        this.error("type.array.additionalItems", ctx);
    }},

    "[minItems]": function (schema) {
        return {
            inline: "if(Array.isArray(_) && _.length < " + schema.minItems + ") this.error('type.array.minItems', ctx)"
        }
    },

    "[maxItems]": function (schema) {
        return {
            inline: "if(Array.isArray(_) && _.length > " + schema.maxItems + ") this.error('type.array.maxItems', ctx)"
        }
    },

    "[uniqueItems]": {inline: function (_, ctx) {
        if (!Array.isArray(_)) {
            return;
        }

        var its = {}, i, o;
        for (i = 0; i < _.length; i = i + 1) {
            o = this.toComparable(_[i]);
            this.errorIf(its[o], "type.array.uniqueItems", ctx, _[i]);
            its[o] = true;
        }
    }},

    ///////////////// object
    "[required][^properties]": function (schema) {
        var reqs = schema.required;
        if (Array.isArray(reqs)) {
            return function (s, o, ctx) {
                if (!isObject(o)) return;
                var i;
                for (i = 0; i < reqs.length; i++) {
                    this.errorIf(!o.hasOwnProperty(reqs[i]), "type.object.required", ctx, null, reqs[i]);
                }
            }
        }
    },

    "[properties]": function (schema) {
        schema.$keys = Object.keys(schema.properties);
        var reqs = (schema.required || []).concat(schema.$keys.filter(function (key) {
            return schema.properties[key].required === true;
        }));
        if (reqs.length > 0) {
            return function (s, o, ctx) {
                if (!isObject(o)) return;
                var i;
                for (i = 0; i < reqs.length; i++) {
                    this.errorIf(!o.hasOwnProperty(reqs[i]), "type.object.required", ctx, null, reqs[i]);
                }
            }
        }
    },

    "[maxProperties]": function (schema) {
        var count = schema.maxProperties;
        return {inline: "if (typeof _ === 'object') this.errorIf(Object.keys(_).length > " + count + ", 'type.object.maxProperties', ctx, " + count + ")"}
    },

    "[minProperties]": function (schema) {
        var count = schema.minProperties;
        return {inline: "if (typeof _ === 'object') this.errorIf(Object.keys(_).length < " + count + ", 'type.object.minProperties', ctx, " + count + ")"}
    },

    "[additionalProperty=false]": {inline: function (_, ctx) {
        this.error("type.object.additionalProperties", ctx);
    }},

    ///////////////// number
    "[multipleOf]": function (schema) {
        return {inline: "if (typeof _ === 'number' ) this.errorIf((_ / " + schema.multipleOf + ") % 1 !== 0, 'type.integer.multipleOf', ctx, " + schema.multipleOf + ")" }
    },
    "[minimum]": function (schema) {
        return {inline: "this.errorIf(_ " + (schema.exclusiveMinimum ? "<=" : "<") + schema.minimum + ", 'type.number.minimum" + (schema.exclusiveMinimum ? ".exclusive" : "") + "', ctx, " + schema.minimum + ")"}
    },
    "[maximum]": function (schema) {
        return {inline: "this.errorIf(_ " + (schema.exclusiveMaximum ? ">=" : ">") + schema.maximum + ", 'type.number.maximum" + (schema.exclusiveMaximum ? ".exclusive" : "") + "', ctx, " + schema.maximum + ")"}
    },

    ///////////////// result

    done: {inline: function () {
        this.res.valid = this.errors.length === 0;
        return this.res;
    }},

    clone: function () {
        var v = new V4Validator(this.options);
        v.$enums = this.$enums;
        return v;
    },

    reset: function () {
        this.errors = this.res.errors = [];
        this.res.valid = true;
    }

};

V4Validator.factory = function (options) {
    return function () {
        return new V4Validator(options);
    }
};


module.exports = V4Validator;