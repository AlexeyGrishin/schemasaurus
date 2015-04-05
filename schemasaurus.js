(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.schemasaurus = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var base = require('./iterator_base');
var ext = require('./standardExtensions');
var createValidator = require('./v4validator');
var createSelector = require('./selector');


function Iterator(iterator, opts) {
  var it = new base(iterator, opts);
  ext(it);
  var fn = it.iterate.bind(it);
  fn.schema = function(s) {
    it.schema(s);
    return fn;
  };
  return fn;
}

function Validator(options) {
  return Selector(createValidator(options), options);
}

function Selector(selector, options) {
  return Iterator(createSelector(selector), options);
}

module.exports = {
  Iterator: Iterator,
  Selector: Selector,
  Validator: Validator
};

Validator.meta = createValidator.meta;
Iterator.meta = base.meta;

},{"./iterator_base":2,"./selector":3,"./standardExtensions":4,"./v4validator":5}],2:[function(require,module,exports){
"use strict";

function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function IteratorBase(callbackCtor, options) {
    if (typeof callbackCtor !== 'function') throw new Error("callback shall be a function");
    switch (callbackCtor.length) {
        case 0:
            break;
        case 3:
            var cb = callbackCtor;
            callbackCtor = function() { return cb; };
            break;
        default:
            throw new Error("Callback constructor shall have no arguments");
    }
    this._callbackCtor = callbackCtor;
    if (options && options.schema) this._schema = options.schema;
    this.attrs = (options && options.attrs) ? options.attrs : {};
    this.attrs.__proto__ = IteratorBase.prototype.attrs;
    this.types = (options && options.types) ? options.types : {};
    this.types.__proto__ = IteratorBase.prototype.types;

    this._options = options || {};
}



IteratorBase.prototype.schema = function(schema) {
    if (!schema) throw new Error("Schema shall be an object");
    this._schema = clone(schema);
    return this;
};

IteratorBase.prototype.attrs = {};
IteratorBase.prototype.types = {};

function isEmpty(o) { return typeof o === 'undefined' || o == null};

IteratorBase.prototype.iterate = function(schema, object) {
    if (this._schema) {
        object = schema;
        schema = this._schema;
    }

    var self = this;
    function proceed(schemaNode, objectNode, stack, path) {
        var ctx = {
            path: function() { return path;},
            attribute: undefined,
            value: function() { return stack[0][1]},
            parent: function(n) {
                var p = stack[n || 1] || [];
                return {schema: p[0], object: p[1]};
            },
            visit: function(schemaNode, objectNode) {
                if (typeof schemaNode === 'undefined') return;
                if (!Array.isArray(schemaNode))
                    return proceed(schemaNode, objectNode, stack, path);
                else
                    return schemaNode.map(function(s) { return proceed(s, objectNode, stack, path)});
            },

            refbase: []
        };
        var callback = self._callbackCtor();
        if (typeof callback === "undefined") throw new Error("Callback shall be specified");
        var c = {
            schemaOnly: typeof object === 'undefined',
            options: self._options,
            visit: function (schemaNode, objectNode, step) {
                if (schemaNode.$$visited && isEmpty(objectNode)) {
                    //do not go deep - to prevent recursion
                    return;
                }
                Object.defineProperty(schemaNode, "$$visited", {value: true, configurable: true});
                if (schemaNode.id) ctx.refbase.push(schemaNode.id);
                if (step) path.push(step);
                stack.unshift([schemaNode, objectNode]);
                callback(schemaNode, objectNode, ctx);
                var visitors = [];
                var customVisitor, nodeType = schemaNode.type;
                for (var attr in self.attrs) {
                    if (self.attrs.hasOwnProperty(attr) && schemaNode.hasOwnProperty(attr)) {
                        customVisitor = self.attrs[attr];
                        if (typeof customVisitor === 'string') {
                            nodeType = customVisitor;
                            customVisitor = null;
                        }
                        else {
                            visitors.push(customVisitor);
                        }
                    }
                }
                if (customVisitor = self.types[nodeType]) {
                    visitors.push(customVisitor);
                }
                for (var v = 0; v < visitors.length; v++) {
                    visitors[v](schemaNode, objectNode, c, nodeType);
                }
                stack.shift();
                if (step) path.pop();
                if (schemaNode.id) ctx.refbase.pop();
                delete schemaNode.$$visited;
            },
            parent: function (n) {
                n = n || 1;
                return stack[n];
            },
            report: function (attribute) {
                ctx.attribute = attribute;
                callback(stack[0][0], stack[0][1], ctx);
                ctx.attribute = undefined;
            },
            resolveRef: function(ref) {
                function detilde(s) {
                    return s.replace(/~0/g, "~").replace(/~1/g, "/");   //do not know how to parse it other way
                }
                var remLoc = decodeURI(ref).split("#");
                var rem = remLoc[0], loc = remLoc[1].split("/").map(detilde);
                if (rem !== '') throw new Error("Remote refs are not supported for now :(");
                var st = schemaNode;
                for (var i = 0; i < loc.length; i++) {
                    if (loc[i] === '') continue;
                    st = st[loc[i]];
                    if (typeof st === 'undefined')
                        throw new Error("Cannot find ref '" + ref + "' in schema");
                }
                return st;
            }
        };
        if (Object.defineProperty) {
            Object.keys(c).forEach(function (k) {
                Object.defineProperty(c, k, {editable: false, value: c[k]});
            })
        }

        c.visit(schemaNode, objectNode);
        ctx.finished = true;
        ctx.attribute = "finished";
        return callback(null, null, ctx);
    }

    return proceed(schema, object, [], []);

};

Object.defineProperty(IteratorBase.prototype, "meta", {get: function() {
        var self = this;
        return {
            type: function (type, visitor) {
                self.types[type] = visitor;
            },
            attr: function (attr, visitor) {
                self.attrs[attr] = visitor;
            }
        }
    }}
);

IteratorBase.meta = {
    type: function(type, visitor) {
        IteratorBase.prototype.types[type] = visitor;
    },
    attr: function(attr, visitor) {
        IteratorBase.prototype.attrs[attr] = visitor;
    }
};

module.exports = IteratorBase;


},{}],3:[function(require,module,exports){

var attrRe = /(\[(\^?\w+)(=\w+)?\])/g;
var modRe = /:(\w+)$/;

function selectorToCondition(selector) {
    function genAttrCond(attr, value) {
        if (attr[0] == '^') {
            return "!(" + genAttrCond(attr.substring(1), value) + ")";
        }
        return value !== null ? ("schema." + attr + " === " + JSON.stringify(value)) : "typeof schema." + attr + " !== 'undefined'";
    }
    function genModifierCond(mod) {
        return mod ? ("ctx.attribute === " + JSON.stringify(mod)) : "typeof ctx.attribute === 'undefined'";
    }
    function parseValue(valAsStr) {
        if (valAsStr == null) return null;
        var val = parseFloat(valAsStr);
        if (!isNaN(val)) return val;
        if (valAsStr === "true") return true;
        if (valAsStr === "false") return false;
        return valAsStr;
    }

    var conds = [];
    var m;
    while (m = attrRe.exec(selector)) {
        conds.push(genAttrCond(m[2], parseValue(m[3] ? m[3].substring(1) /* remove = from beginning */ : null)));
    }
    m = modRe.exec(selector);
    if (conds.length == 0 && !m) throw new Error("Cannot parse selector `" + selector + "`");
    conds.push(genModifierCond(m ? m[1] : null));


    return "(" + conds.join(" && ") + ")";
}

//[attr=value]*:modifier : function(schema, object, ctx, next)
function selectorsToCallback(selectorsCtor) {
    var selectors = null;
    if (typeof selectorsCtor !== 'function') {
        selectors = selectorsCtor;
        selectorsCtor = function() { return selectors; }
    }
    else {
        selectors = selectorsCtor();
    }

    var singleCond = "if (#1) { stop = true; selectors[#2](schema, object, ctx, next); if (stop) return; };";
    var head = "return function() { var selectors = selectorsCtor(); return function(schema, object, ctx) { if (schema == null) {return selectors.done ? selectors.done() : null}; var stop; function next() { stop = false; };";
    var tail = "}};";

    var code = [head];
    for (var s in selectors) {
        if (selectors.hasOwnProperty(s) && s !== 'done') {
            var cond = selectorToCondition(s);
            code.push(singleCond.replace("#1", cond).replace("#2", "'" + s + "'"));
        }
    }
    code.push(tail);
    var func = Function("selectorsCtor", code.join("\n"));
    return func(selectorsCtor);

}

module.exports = selectorsToCallback;
},{}],4:[function(require,module,exports){
module.exports = function(Iterator) {

    //TODO: probably need to check objectNode type here, so if it is not object - do not go deep. or it shall be ruled by options
    Iterator.meta.type("object", function (schemaNode, objectNode, c) {
        var k;
        if (schemaNode.default && (Array.isArray(schemaNode.default) || typeof schemaNode.default !== 'object')) {
            delete schemaNode.default;
        }
        for (k in schemaNode.properties) {
            if (schemaNode.properties.hasOwnProperty(k)) {
                c.visit(schemaNode.properties[k], objectNode ? objectNode[k] : undefined, k);
            }
        }
        if (objectNode && typeof schemaNode.additionalProperties === 'object') {
            for (k in objectNode) {
                if (objectNode.hasOwnProperty(k)) {
                    if (schemaNode.properties && schemaNode.properties.hasOwnProperty(k)) continue;
                    c.visit(schemaNode.additionalProperties, objectNode ? objectNode[k] : undefined, k);
                }
            }
        }
        c.report("end");
    });

    Iterator.meta.attr("properties", "object");
    Iterator.meta.attr("additionalProperties", "object");

    Iterator.meta.type("array", function (schemaNode, objectNode, c) {
        var items = schemaNode.items || {};
        var i;
        if (schemaNode.default && !Array.isArray(schemaNode.default)) {
            delete schemaNode.default;
        }

        if (Array.isArray(items)) {
            for (i = 0; i < schemaNode.items.length; i++) {
                c.report("start-item");
                c.visit(schemaNode.items[i] , objectNode ? objectNode[i] : undefined, "[" + i + "]");
                c.report("end-item");
            }
            if (typeof schemaNode.additionalItems === 'object') {
                for (i = schemaNode.items.length; i < (objectNode ? objectNode.length : 0); i++) {
                    c.report("start-item");
                    c.visit(schemaNode.additionalItems, objectNode ? objectNode[i] : undefined, "[" + i + "]");
                    c.report("end-item");
                }
            }
        }
        else if (c.schemaOnly) {
            c.report("start-item");
            c.visit(schemaNode.items || {}, null, "[]");
            c.report("end-item");
        }
        else {
            for (i = 0; i < (objectNode ? objectNode.length : 0); i++) {
                c.report("start-item");
                c.visit(schemaNode.items || {}, objectNode[i], "[" + i + "]");
                c.report("end-item");
            }
        }
        c.report("end");
    });

    Iterator.meta.attr("items", "array");
    Iterator.meta.attr("additionalItems", "array");

    Iterator.meta.attr("default", function(schemaNode, objectNode, c, nodeType) {
        var valid, val = schemaNode.default;
        switch (nodeType) {
            case 'boolean':
            case 'string':
            case 'number':
                valid = typeof val === nodeType;
                break;
            case 'null':
                valid = val === null;
                break;
            case 'integer':
                valid = typeof val === 'number' && (val%1 == 0);
                break;
        }
        if (!valid) {
            delete schemaNode.default;
        }
    });

    Iterator.meta.attr("$ref", function(schemaNode, objectNode, c) {
        var ref = schemaNode;
        while (ref.$ref) {
            ref = c.resolveRef(ref.$ref);
        }
        for (var k in ref) {
            if (ref.hasOwnProperty(k)) {
                schemaNode[k] = ref[k];
            }
        }
        delete schemaNode.$ref;
        c.visit(schemaNode, objectNode);
    });
};
},{}],5:[function(require,module,exports){
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
    }
}

var formats = {};

function isObject(o) {
    return typeof o === 'object' && !Array.isArray(o) && o !== null;
}

module.exports = function(options) {
    if (typeof options === 'undefined') options = {} ;
    var msgs = options.messages || messages(options.gettext || function(m) { return m;});

    var formts = {};
    if (options.formats) {
        for (var i = 0; i < options.formats.length; i++) {
            formts[options.formats[i].name] = options.formats[i];
        }
    }
    formts.__proto__ = formats;

    return function() {
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

        function copyErrors(anotherErrors) {
            errors.splice.apply(errors, [errors.length, 0].concat(anotherErrors));
        }


        function toComparable(o) {
            return typeof o === 'object' ? JSON.stringify(o) : o;
        }

        return {
            "[^required]": function(schema, object, ctx, next) {
                var parent = ctx.parent().schema;
                //TODO: here need to understand is parent object or not.
                if (parent /*&& parent.type === 'object'*/ && (typeof object === 'undefined' || object === null)) {
                    //thats ok
                    return;
                }
                next();
            },
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
                            if (isObject(object)) return next();
                    }
                }
                types.forEach(function(type) {
                    error("type." + type, ctx);
                })
            },

            //////////////// dependencies
            "[dependencies]": function(schema, object, ctx, next) {
                for (var prop in schema.dependencies) {
                    if (schema.dependencies.hasOwnProperty(prop)) {
                        var dep = schema.dependencies[prop];
                        if (Array.isArray(dep)) {
                            dep = {required: dep};
                        }
                        if (object.hasOwnProperty(prop)) {
                            var res = ctx.visit(dep, object);
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

            "[allOf]": function(schema, object, ctx, next) {
                ctx.visit(schema.allOf, object).forEach(function(res) {
                    if (!res.valid) {
                        error("allOf", ctx);
                        copyErrors(res.errors);
                    }
                });
                next();
            },
            "[anyOf]": function(schema, object, ctx, next) {
                var allErrors = [];
                var res = ctx.visit(schema.anyOf, object).some(function(res) {
                    allErrors = allErrors.concat(res.errors);
                    return res.valid;
                });
                if (!res) {
                    error("anyOf", ctx);
                    copyErrors(allErrors);
                }
                next();
            },
            "[oneOf]": function(schema, object, ctx, next) {
                var count = 0;
                var allErrors = [];
                ctx.visit(schema.oneOf, object).forEach(function(res) {
                    allErrors = allErrors.concat(res.errors);
                    if (res.valid) count++;
                });
                if (count === 0) {
                    error("oneOf.zero", ctx);
                    copyErrors(allErrors);
                }
                else if (count != 1) {
                    error("oneOf", ctx);
                }
                next();
            },

            "[not]": function(schema, object, ctx, next) {
                var res = ctx.visit(schema.not, object);
                if (res.valid) {
                    error("not", ctx);
                    //TODO: propagate "errors"
                }
                next();
            },

            //////////////// enum

            "[enum]": function(schema, object, ctx, next) {
                var val = toComparable(object),
                    vals = schema.$$enum = schema.$$enum || schema.enum.map(toComparable);
                errorIf(vals.indexOf(val) == -1, "type.enum", ctx, schema.enum);
                next();
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
                if (typeof object !== 'string') return next();
                errorIf(!object.match(schema.pattern), "type.string.pattern", ctx, schema.pattern);
                next();
            },
            "[type=string][format]": function(schema, object, ctx) {
                var fmt = formts[schema.format];
                if (!fmt) throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
                errorIf(!(fmt.regexp instanceof RegExp ? fmt.regexp.test(object) : fmt.test(object, schema)), "type.string.format." + fmt.name, ctx, fmt.message);
            },
            "[type=string][^format]": function() {/*stop*/},

            //////////////// array

            "[additionalItems=false]": function(schema, object, ctx, next) {
                if (!Array.isArray(object)) return next();
                errorIf(schema.items && object.length > schema.items.length, "type.array.additionalItems", ctx);
                next();
            },

            "[minItems]": function(schema, object, ctx, next) {
                if (!Array.isArray(object)) return next();
                errorIf(object.length < schema.minItems, "type.array.minItems", ctx);
                next();
            },

            "[maxItems]": function(schema, object, ctx, next) {
                if (!Array.isArray(object)) return next();
                errorIf(object.length > schema.maxItems, "type.array.maxItems", ctx);
                next();
            },

            "[uniqueItems]":  function(schema, object, ctx, next) {
                if (!Array.isArray(object)) return next();
                var its = {};
                for (var i = 0; i < object.length; i++) {
                    var o = toComparable(object[i]);
                    errorIf(its[o], "type.array.uniqueItems", ctx, object[i]);
                    its[o] = true;
                }
                next();
            },

            //////////////// object

            "[required][^properties]": function(schema, object, ctx, next) {
                if (!isObject(object)) return next();
                for (var i = 0; i < schema.required.length; i++) {
                    errorIf(!object.hasOwnProperty(schema.required[i]), "type.object.required", ctx, null, schema.required[i]);
                }
                next();

            },
            "[properties]": function(schema, object, ctx, next) {
                if (!isObject(object)) return next();
                schema.$keys = Object.keys(schema.properties);
                var required = (schema.required || []).concat(schema.$keys.filter(function(key) {
                    return schema.properties[key].required === true;
                }));
                for (var i = 0; i < required.length; i++) {
                    errorIf(!object.hasOwnProperty(required[i]), "type.object.required", ctx, null, required[i]);
                }
                next();
            },

            "[maxProperties]": function(schema, object, ctx, next) {
                if (!isObject(object)) return next();
                errorIf(Object.keys(object).length > schema.maxProperties, "type.object.maxProperties", ctx, schema.maxProperties) ;
                next();
            },

            "[minProperties]": function(schema, object, ctx, next) {
                if (!isObject(object)) return next();
                errorIf(Object.keys(object).length < schema.minProperties, "type.object.minProperties", ctx, schema.minProperties);
                next();
            },

            "[additionalProperties=false]": function(schema, object, ctx, next) {
                if (!isObject(object)) return next();
                var schemaKeys = schema.$keys || [];
                for (var k in object) {
                    if (object.hasOwnProperty(k)) {
                        errorIf(schemaKeys.indexOf(k) == -1, "type.object.additionalProperties", ctx, k);
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

    }


};

module.exports.meta = {
    addFormat: function(format) {
        formats[format.name] = format;
    }
};

//TODO: hostname,ip,date-time,uri - look at http://spacetelescope.github.io/understanding-json-schema/reference/string.html
module.exports.meta.addFormat({name: "email", regexp: /^[^@]+@[^@]+$/});
},{}]},{},[1])(1)
});