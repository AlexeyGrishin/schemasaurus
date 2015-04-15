(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.schemasaurus = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

function CurrentObject(path) {
    this.path = path ? path.slice() : [];
    this.stack = new Array(100);
    this.si = 0;
    this.parent = null;
    this.property = null;
    this.self = null;
}

CurrentObject.prototype = {
    reset: function (path, self) {
        this.path = path ? path.slice() : [];
        this.self = self;
    },
    replace: function (newVal) {
        this.parent[this.property] = newVal;
    },
    remove: function () {
        delete this.parent[this.property];
    },
    push: function (prop, parent, self) {
        this.path.push(prop);
        this.stack[this.si] = [prop, parent, self];
        this.si = this.si + 1;
        this.property = prop;
        this.parent = parent;
        this.self = self;
    },
    stop: function () {
        this.stopped = true;
    },
    isStopped: function () {
        if (this.stopped) {
            this.stopped = false;
            return true;
        }
        return false;
    },
    pop: function () {
        this.si = this.si - 1;
        this.path.pop();
        var last = this.stack[this.si];
        if (last) {
            this.parent = last[0];
            this.property = last[1];
            this.self = last[2];
        }
    }
};
var Context = CurrentObject;


function defaultLoader() {
    throw new Error("Remote refs are not supported for now :(");
}

function detilde(s) {
    return s.replace(/~0/g, "~").replace(/~1/g, "/");   //do not know how to parse it other way
}

function resolveRef(loader, schemaNode, ref) {
    var remLoc = decodeURI(ref).split("#"), rem = remLoc[0], loc = remLoc[1].split("/").map(detilde), st = schemaNode, i;
    if (rem !== '') {
        st = loader(rem);
    }
    for (i = 0; i < loc.length; i = i + 1) {
        if (loc[i] === '') {
            //noinspection JSLint
            continue;
        }
        st = st[loc[i]];
        if (st === undefined) {
            throw new Error("Cannot find ref '" + ref + "' in schema");
        }
    }
    return st;
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

var attrRe = /(\[(\^?\w+)(=\w+)?\])/g;
var modRe = /:([-\w]+)$/;

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

function convertMatcher(expr, selector) {
    if (expr.indexOf(":") !== -1 || expr.indexOf("[") !== -1) {
        var ma = modRe.exec(expr), props = [], attr, not, i, match;
        if (ma) {
            attr = ma[1];
        }
        ma = attrRe.exec(expr);
        while (ma) {
            not = ma[2][0] === '^';
            props.push({
                name: not ? ma[2].substring(1) : ma[2],
                not: not,
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
                if (props[i].not) {
                    match = (sv === undefined || (sv !== props[i].value && props[i].value !== undefined));
                } else {
                    match = (sv !== undefined && (sv === props[i].value || props[i].value === undefined));
                }
                if (!match) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return cb(selector[expr], expr);
            }
        };
    }
}

function compile(userSchema, selectorCtor, options, path) {
    if (!selectorCtor || typeof selectorCtor !== 'function') {
        throw new Error("selectorCtor shall be a function");
    }
    options = options || {};
    options.ignoreAdditionalItems = options.ignoreAdditionalItems === undefined ? false : options.ignoreAdditionalItems;

    var code = [],
        schema = userSchema,
        selector = selectorCtor(),
        vars = [],
        fnin,
        fnout,
        matchers,
        labelCount = 0,
        label,
        schemas = [],
        ctx = new Context(path),
        schemaRoot = schema,
        innerFns = [];

    function matchFns(schema, att, cb) {
        var i, m, ma;
        if (!matchers) {
            matchers = [];
            //noinspection JSLint
            for (m in selector) {
                //noinspection JSUnfilteredForInLoop
                ma = convertMatcher(m, selector);
                if (ma) {
                    matchers.push(ma);
                }
            }
        }
        for (i = 0; i < matchers.length; i = i + 1) {
            matchers[i](schema, att, cb);
        }
    }

    function createVar() {
        var newvar = "i" + vars.length;
        vars.push(newvar);
        return newvar;
    }

    function addFn(fn, name, varName, schema, stopLabel) {
        var fnbody, k, useinner = false, allowReturn = !stopLabel;
        if (fn.prepare || fn.length === 1 || fn.length === 2) {
            fn = (fn.prepare || fn).call(selector, schema, ctx);
            useinner = true;
        }
        if (!fn) {
            return;
        }

        function addDirectCall(fn, schemaNr, dontUseInner) {
            if (!dontUseInner) {
                innerFns.push(fn);
            }
            var callBody = [];
            if (allowReturn) {
                callBody.push("return");
            }
            callBody.push(dontUseInner ? "this['" + name + "'](" : "innerFns[" + (innerFns.length - 1) + "].call(this,");
            if (schemaNr !== undefined) {
                callBody.push('schemas[' + schemaNr + '], ');
            }
            callBody.push(varName + ", ctx)");
            code.push(callBody.join(" "));
            if (stopLabel) {
                code.push("if (ctx.isStopped()) break " + stopLabel);
            }
        }


        code.push("//call " + name);
        if (fn.inline) {

            if (typeof fn.inline === 'function' && options.noinline) {
                addDirectCall(fn.inline);
            } else {
                label = "label" + labelCount++;
                fnbody = fn.inline.toString()
                    .replace(/^function\s*\([^)]*\)/, "")
                    .replace(/_/g, varName);

                var needLabel = fnbody.indexOf('return') !== -1;
                if (stopLabel) {
                    fnbody = fnbody.replace(/ctx.stop\(\)/, "break " + stopLabel);
                }
                if (!allowReturn) {
                    fnbody = fnbody.replace(/return/g, "break " + label);
                }
                for (k in fn) {
                    if (fn.hasOwnProperty(k) && k !== 'inline') {
                        fnbody = fnbody.replace(new RegExp(k, "g"), JSON.stringify(fn[k]));
                    }
                }
                code = code.concat((needLabel ? (label + ":{" + fnbody + "}") : fnbody).split(/[\n\r]+/));
            }
        } else if (useinner) {
            schemas.push(schema);
            addDirectCall(fn, schemas.length - 1);
        } else {
            schemas.push(schema);
            addDirectCall(fn, schemas.length - 1, true);
        }
    }

    ctx.compile = function (subschema, newFnName) {
        if (Array.isArray(subschema)) {
            innerFns.push(ctx[newFnName] = subschema.map(function (s) {
                return compile(s, selectorCtor, options);
            }));
        } else {
            innerFns.push(ctx[newFnName] = compile(subschema, selectorCtor, options, ctx.path.slice()));
        }
        code.push("ctx." + newFnName + " = innerFns[" + (innerFns.length - 1) + "]");
    };

    function step(schema, varName, opts) {
        var i, k, perAttribute;
        opts = opts || {};

        function callback(attr) {
            var noCodeAdded = code.length + 1, clabel = "label" + labelCount++;
            code.push(clabel + ": {");
            matchFns(schema, attr, function (s, name) {
                addFn(s, name, varName, schema, clabel);
            });
            if (code.length === noCodeAdded) {
                code.pop();
            } else {
                code.push("}");
            }
        }

        function withOptions(schemaPath, path, attr) {
            return {parent: varName, parentSchema: schema, schemaPath: schemaPath, path: path || JSON.stringify(schemaPath), attr: attr};
        }
        function processAdditional(schemaProp, cbProp, idxvar, newvar) {
            var stubSchema = {};
            stubSchema[cbProp] = false;
            if (schema[schemaProp] === false) {
                step(stubSchema, newvar, withOptions("*", idxvar));
            } else if (typeof schema[schemaProp] === 'object') {
                step(schema[schemaProp], newvar, withOptions("*", idxvar));
            } else {
                stubSchema[cbProp] = "allowed";
                step(stubSchema, newvar, withOptions("*", idxvar));
            }
        }

        function stepProperties() {
            var propsVar, idxvar, newvar;
            if (!options.ignoreAdditionalItems) {
                propsVar = createVar();
                code.push(propsVar + " = {}");
            }
            for (k in schema.properties) {
                if (schema.properties.hasOwnProperty(k)) {
                    newvar = createVar();
                    code.push(newvar + " = " + varName + " ? " + varName + "." + k + " : undefined");
                    if (!options.ignoreAdditionalItems) {
                        code.push(propsVar + "." + k + " = true");
                    }
                    step(schema.properties[k], newvar, withOptions(k));
                }
            }
            if (!options.ignoreAdditionalItems) {
                idxvar = createVar();
                code.push("if (typeof " + varName + " === 'object' && !Array.isArray(" + varName + ")) for (" + idxvar + " in " + varName + ") if (" + varName + ".hasOwnProperty(" + idxvar + ")) {");
                newvar = createVar();
                code.push(newvar + " = " + varName + "[" + idxvar + "]");
                for (k in (schema.patternProperties || {})) {
                    if (schema.patternProperties.hasOwnProperty(k)) {
                        code.push("if (/" + k + "/.test(" + idxvar + ")) {");
                        step(schema.patternProperties[k], newvar, withOptions(k, idxvar));
                        code.push(propsVar + "[" + idxvar + "] = true");
                        code.push("}");
                    }
                }
                code.push("if (!" + propsVar + "[" + idxvar + "]) {");
                processAdditional("additionalProperties", "additionalProperty", idxvar, newvar);
                code.push("}");
                code.push("}");
            }
        }

        function stepItems() {
            var idxvar, newvar;
            if (!Array.isArray(schema.items)) {
                idxvar = createVar();
                code.push("for (" + idxvar + " = 0; " + idxvar + " < (" + varName + " ? " + varName + ".length : 0); " + idxvar + "++) {");
                newvar = createVar();
                code.push(newvar + " = " + varName + "[" + idxvar + "]");
                step(schema.items, newvar, withOptions("[]", idxvar, "item"));
                code.push("}");
                if (!options.ignoreSchemaOnly) {
                    code.push("if (schemaOnly) {");
                    step(schema.items, 'nil', withOptions("[]", null, "item"));
                    code.push("}");
                }
            } else {
                for (k = 0; k < schema.items.length; k = k + 1) {
                    newvar = createVar();
                    code.push(newvar + " = " + varName + " ? " + varName + "[" + k + "] : undefined");
                    step(schema.items[k], newvar, withOptions(k));
                }
                if (!options.ignoreAdditionalItems) {
                    idxvar = createVar();
                    code.push("for (" + idxvar + " = " + schema.items.length + "; " + idxvar + " < (" + varName + " ? " + varName + ".length : 0); " + idxvar + "++) {");
                    newvar = createVar();
                    code.push(newvar + " = " + varName + "[" + idxvar + "]");
                    processAdditional("additionalItems", "additionalItem", idxvar, newvar);
                    code.push("}");
                }
            }
        }

        if (schema.$$visited) {
            //TODO: this is solution only for root recursion - to pass official suite :)
            code.push("if (" + varName + " !== undefined) self(" + varName + ",ctx.path);");
            return;
        }
        Object.defineProperty(schema, "$$visited", {value: true, enumerable: false, configurable: true});

        if (schema.$ref) {
            step(resolveRef(options.loader || defaultLoader, schemaRoot, schema.$ref), varName, opts);
            return;
        }

        if (opts.path) {
            code.push("ctx.push(" + opts.path + ", " + opts.parent + "," + varName + ")");
            ctx.push(opts.schemaPath, opts.parentSchema, schema);
        }

        ["oneOf", "anyOf", "allOf", "not"].forEach(function (inner) {
            if (schema[inner]) {
                ctx.compile(schema[inner], inner);
            }
        });

        if (opts.attr) {
            callback(opts.attr);
        }
        callback("start");
        callback();


        perAttribute = [
            ["properties", "additionalProperties", "patternProperties", stepProperties],
            ["items", "additionalItems", stepItems]
        ];
        for (i = 0; i < perAttribute.length; i++) {
            for (k = 0; k < perAttribute[i].length - 1; k++) {
                if (schema[perAttribute[i][k]]) {
                    perAttribute[i].pop()();
                    break;
                }
            }
        }

        callback("end");
        if (opts.attr) {
            callback(opts.attr + "-end");
        }
        if (opts.path) {
            code.push("ctx.pop();");
            ctx.pop();
        }
        delete schema.$$visited;
    }

    step(schema, "val");
    if (selector.done) {
        addFn(selector.done, "done", "val", schema, null, true);
    }

    var fnbody = prettifyCode(code).map(function (line) {
        return "{};".indexOf(line[line.length - 1]) === -1 ? line + ";" : line;
    }).join("\n");
    fnbody = ["var self; selector._f = function(val, path) { var nil = undefined, schemaOnly = val === undefined"]
        .concat(vars).join(",") + ";\nctx.reset(path, val);" +
            fnbody +
            "}; self = function (val, path) {" + (selector.reset ? "selector.reset();" : "") + " return selector._f(val, path) }; self.fn = selector._f; return self; ";
    try {
        fnout = new Function("selector", "schemas", "innerFns", "ctx", fnbody);
    } catch (e) {
        console.error(fnbody);
        throw e;
    }
    var co = new CurrentObject();
    var so = (selector.clone ? selector.clone() : selectorCtor());
    fnin = fnout(so, schemas, innerFns, co);

    return fnin;
}



module.exports = compile;

},{}],2:[function(require,module,exports){
"use strict";
var compile = require('./compiler');
var Validator = require('./v4validator');
var Normalizer = require('./normalizer');

module.exports = {
    Validator: Validator,
    Normalizer: Normalizer,
    compile: compile,

    newIterator: compile,

    newValidator: function (schema, voptions) {
        return compile(schema, Validator.factory(voptions), voptions);
    },
    newNormalizer: function (schema) {
        return compile(schema, Normalizer.factory);
    }
};

},{"./compiler":1,"./normalizer":4,"./v4validator":5}],3:[function(require,module,exports){
"use strict";

module.exports = function messages(gettext) {
    return {
        "string": gettext("shall be a string"),
        "null": gettext("shall be null"),
        "minLength": gettext("shall have length at least %d"),
        "maxLength": gettext("shall have length no more than %d"),
        "pattern": gettext("shall match pattern %s"),
        "integer": gettext("shall be an integer"),
        "multipleOf": gettext("shall be multiple of %d"),
        "number": gettext("shall be a number"),
        "minimum": gettext("shall be >= %d"),
        "minimum.exclusive": gettext("shall be > %d"),
        "maximum": gettext("shall be <= %d"),
        "maximum.exclusive": gettext("shall be < %d"),
        "boolean": gettext("shall be boolean"),
        "object": gettext("shall be object"),
        "additionalProperties": gettext("shall not have additional properties"),
        "minProperties": gettext("shall have at least %d properties"),
        "maxProperties": gettext("shall have no more than %d properties"),
        "array": gettext("shall be array"),
        "additionalItems": gettext("shall not have additional items"),
        "minItems": gettext("shall have at least %d items"),
        "maxItems": gettext("shall have no more %d items"),
        "uniqueItems": gettext("shall have unique items"),
        "enum": gettext("shall be one of values %s"),
        "required": gettext("is required"),
        "dependency": gettext("does not meet additional requirements for %s"),
        "not": gettext("does not meet 'not' requirement"),
        "oneOf": gettext("does not meet exactly one requirement"),
        "oneOf.zero": gettext("does not meet any requirement"),
        "allOf": gettext("does not meet all requirements"),
        "anyOf": gettext("does not meet any requirement"),
        "custom": gettext("is not valid")
    };
}

},{}],4:[function(require,module,exports){
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
    done: {inline: "return _"}
};

Normalizer.factory = function() {
    return new Normalizer();
};
module.exports = Normalizer;
},{}],5:[function(require,module,exports){
"use strict";
var messages = require('./messages');

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
    if (!this.options.gettext) {
        this.options.gettext = function (s) { return s; };
    }
    if (!this.options.messages) {
        this.options.messages = messages(this.options.gettext);
    }
    this.custom = this.options.custom || {};
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
    error: function (code, ctx, arg) {
        var msg = this.$cm ? this.options.gettext(this.$cm[code]) : this.options.messages[code] || arg || (function () {throw new Error("There is no message registered for error '" + code + "'"); }());
        delete this.$cm;
        this.errors.push({
            code: code,
            message: msg,
            value: ctx.self,
            arg: arg,
            path: ctx.path.slice()
        });
    },
    copyErrors: function (anotherErrors) {
        this.errors.splice.apply(this.errors, [this.errors.length, 0].concat(anotherErrors));
    },

    "[messages]": function (s) {
        this.$messages = this.$messages || [];
        this.$messages.push(s.messages);
        return {inline: "this.$cm = this.$messages[" + (this.$messages.length - 1) + "]"};
    },

    ////////////// type & common


    "[^required]": {prepare: function (s, ctx) {
        if (!ctx.parent) {
            return null;
        }
        return {inline: "if (_ === undefined) ctx.stop()"};
    }},
    "[type=string]": {inline: function (_, ctx) {
        if (typeof _ !== 'string') {
            this.error('string', ctx);
        }
    }},
    "[type=number]": {inline: function (_, ctx) {
        if (typeof _ !== 'number') {
            this.error('number', ctx);
        }
    }},
    "[type=integer]": {inline: function (_, ctx) {
        if ((typeof _ !== 'number') || (_ % 1 !== 0)) {
            this.error('integer', ctx);
        }
    }},
    "[type=null]": {inline: function (_, ctx) {
        if (_ !== null) {
            this.error('null', ctx);
        }
    }},
    "[type=boolean]": {inline: function (_, ctx) {
        if (typeof _ !== 'boolean') {
            this.error('boolean', ctx);
        }
    }},
    "[type=array]": {inline: function (_, ctx) {
        if (!Array.isArray(_)) {
            this.error('array', ctx);
        }
    }},
    "[type=object]": {inline: function (_, ctx) {
        if (Array.isArray(_) || typeof _ !== 'object' || _ === null) {
            this.error('object', ctx);
        }
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
            var res = ctx.allOf[i](_, ctx.path);

            if (!res.valid) {
                this.error("allOf", ctx);
                this.copyErrors(res.errors);
            }
        }
    }},

    "[anyOf]": {inline: function (_, ctx) {
        var allErrors = [], res;
        for (var i = 0; i < ctx.anyOf.length; i++) {
            res = ctx.anyOf[i](_, ctx.path);
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
            res = ctx.oneOf[i](_, ctx.path);
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
        var res = ctx.not(_, ctx.path);
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
        return {inline: "if(!this.$enums[" + (this.$enums.length-1) + "][this.toComparable(_)]) this.error('enum', ctx, " + JSON.stringify(schema.enum) + ")"};
    },

    //////////////// string

    "xLength": function (op, count, code) {
        return {inline: "if (typeof _ === 'string' && _.length " + op + count + ") this.error('" + code + "', ctx, " + count + ")"}
    },

    "[maxLength]": function (schema) {
        return this.xLength(">", schema.maxLength, 'maxLength');
    },
    "[minLength]": function (schema) {
        return this.xLength("<", schema.minLength, 'minLength');
    },
    "[pattern]": function (schema) {
        return {inline: "if (typeof _ === 'string' && !_.match(/" + schema.pattern + "/)) this.error('pattern', ctx, " + JSON.stringify(schema.pattern) + ")"}
    },
    "[format]": function (schema) {
        var fmt = this.formats[schema.format];
        if (!fmt) {
            throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
        }
        return {inline: "if (typeof _ === 'string' && !_.match(" + fmt.regexp + ")) this.error('format." + schema.format + "', ctx, " + JSON.stringify(fmt.message) + ")"}
    },

    ////////////////// array

    "[additionalItem=false]": {inline: function (_, ctx) {
        this.error("additionalItems", ctx);
    }},

    "xItems": function (op, count, code) {
        return {
            inline: "if(Array.isArray(_) && _.length " + op + count + ") this.error('" + code + "', ctx)"
        }
    },

    "[minItems]": function (schema) {
        return this.xItems("<", schema.minItems, "minItems");
    },

    "[maxItems]": function (schema) {
        return this.xItems(">", schema.maxItems, "maxItems");
    },

    "[uniqueItems]": {inline: function (_, ctx) {
        if (!Array.isArray(_)) {
            return;
        }

        var its = {}, i, o;
        for (i = 0; i < _.length; i = i + 1) {
            o = this.toComparable(_[i]);
            if (its[o]) {
                this.error("uniqueItems", ctx, _[i]);
            }
            its[o] = true;
        }
    }},

    processRequired: function(reqs) {
        if (Array.isArray(reqs)) {
            return function (s, o, ctx) {
                if (!isObject(o)) return;
                var i;
                for (i = 0; i < reqs.length; i++) {
                    if (!o.hasOwnProperty(reqs[i])) {
                        this.error("required", ctx, null, reqs[i]);
                    }

                }
            }
        }
    },

    ///////////////// object
    "[required][^properties]": function (schema) {
        return this.processRequired(schema.required);

    },

    "[properties]": function (schema) {
        var $keys = Object.keys(schema.properties);
        var reqs = (schema.required || []).concat($keys.filter(function (key) {
            return schema.properties[key].required === true;
        }));
        return this.processRequired(reqs);
    },

    "xProperties": function (op, count, code) {
        return {inline: "if (typeof _ === 'object' && Object.keys(_).length " + op + " " + count + ") this.error('" + code + "', ctx, " + count + ")"};
    },

    "[maxProperties]": function (schema) {
        return this.xProperties(">", schema.maxProperties, 'maxProperties');
    },

    "[minProperties]": function (schema) {
        return this.xProperties("<", schema.minProperties, 'minProperties');
    },

    "[additionalProperty=false]": {inline: function (_, ctx) {
        this.error("additionalProperties", ctx);
    }},

    ///////////////// number
    "[multipleOf]": function (schema) {
        return {inline: "if (typeof _ === 'number' && (_ / " + schema.multipleOf + ") % 1 !== 0) this.error('multipleOf', ctx, " + schema.multipleOf + ")" }
    },

    "ximum": function (op, excl, count, code) {
        return {inline: "if (_ " + op +  (excl ? "=" : "") + count + ") this.error('" + code + (excl ? ".exclusive" : "") + "', ctx, " + count + ")"}
    },
    "[minimum]": function (schema) {
        return this.ximum("<", schema.exclusiveMinimum, schema.minimum, 'minimum');
    },
    "[maximum]": function (schema) {
        return this.ximum(">", schema.exclusiveMaximum, schema.maximum, 'maximum');
    },

    ///////////////// custom
    "[conform]": function (schema, ctx) {
        this.$custom = this.$custom || [];
        if (typeof schema.conform === 'function') {
            this.$custom.push(schema.conform);
            return {inline: "if (!this.$custom[" + (this.$custom.length - 1) + "](_, ctx)) this.error('custom', ctx)"}
        }
        else {
            var inlines = [];
            for (var k in schema.conform) {
                if (schema.conform.hasOwnProperty(k)) {
                    var fn = this.custom[k];
                    var args = schema.conform[k].map(JSON.stringify).concat([""]).join(',');
                    this.$custom.push(fn);
                    inlines.push("if (!this.$custom[" + (this.$custom.length - 1) + "](_, " + args + " ctx)) this.error('custom." + k + "', ctx, this.options.messages.custom)");
                }
            }
            return {inline: inlines.join('\n')};
        }
    },

    ///////////////// result

    done: {inline: function () {
        this.res.valid = this.errors.length === 0;
        return this.res;
    }},

    clone: function () {
        var v = new V4Validator(this.options);
        v.$enums = this.$enums;
        v.$custom = this.$custom;
        v.$messages = this.$messages;
        return v;
    },

    reset: function () {
        this.errors = this.res.errors = [];
        this.res.valid = true;
        delete this.$cm;
    }

};

V4Validator.factory = function (options) {
    return function () {
        return new V4Validator(options);
    }
};


module.exports = V4Validator;
},{"./messages":3}]},{},[2])(2)
});