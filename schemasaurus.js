(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.schemasaurus = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var CurrentObject = require('./int/context');
var Context = CurrentObject;
var Generator = require('./int/gen');
var Shared = require('./int/shared');
var SchemaPartProcessor = require('./int/processor');
var CodeComposer = require('./int/code');
var resolveRef = require('./int/references');
var createMatcher = require('./int/matchers');

function toFactory(Ctor) {
    if (Object.keys(Ctor.prototype).length !== 0) {
        return function () { return new Ctor(); };
    }
    return Ctor;
}

function SchemaPart(schema, varName, next) {
    this.schema = schema;
    this.varName = varName;
    this.next = next;
}

function Compiler(userSchema, selectorCtor, options, path) {
    if (!selectorCtor || typeof selectorCtor !== 'function') {
        throw new Error("selectorCtor shall be a function");
    }
    this.schemaRoot = userSchema;
    this.selectorCtor = toFactory(selectorCtor);
    this.options = options || {};
    this.options.ignoreAdditionalItems = this.options.ignoreAdditionalItems === undefined ? false : this.options.ignoreAdditionalItems;
    this.ctx = new Context(path);
    this.codeComposer = new CodeComposer();
    this.shared = new Shared();
    this.gen = new Generator("var");
    this.processor = new SchemaPartProcessor(this.gen, this.codeComposer, this.options);

    this.selector = this.selectorCtor();
    this.prepareMatchers();
    this.prepareContext();

}




Compiler.prototype = {
    code: function () {
        this.codeComposer.code.apply(this.codeComposer, arguments);
    },

    subCompile: function (s, path) {
        return new Compiler(s, this.selectorCtor, this.options, path).compile();
    },

    prepareContext: function () {
        this.ctx.compile = function (subschema, newFnName) {
            var ins;
            if (Array.isArray(subschema)) {
                this.ctx[newFnName] = subschema.map(function (s) {
                    return this.subCompile(s);
                }.bind(this));
            } else {
                this.ctx[newFnName] = this.subCompile(subschema, this.ctx.path.slice());
            }
            ins = this.shared.inner(this.ctx[newFnName]);
            this.code("ctx.%% = %%", newFnName, ins);
        }.bind(this);
    },

    prepareMatchers: function () {
        var m, ma;
        this.matchers = [];
        //noinspection JSLint
        for (m in this.selector) {
            //noinspection JSUnfilteredForInLoop
            ma = createMatcher(m);
            if (ma) {
                this.matchers.push(ma);
            }
        }
    },

    callback: function (schemaPart, attr) {
        var i, self = this, clabel = this.gen.next(), matched = false;
        this.code("%%: {", clabel);

        function onMatch(name) {
            matched = true;
            self.addFn(name, schemaPart, clabel);
        }
        for (i = 0; i < this.matchers.length; i++) {
            this.matchers[i](schemaPart.schema, attr, onMatch);
        }
        if (!matched) {
            this.codeComposer.pop();
        } else {
            this.code("}");
        }
    },

    addFn: function (name, schemaPart, stopLabel) {
        var fn = this.selector[name];
        this.code("//call %%", name);
        if (fn.prepare) {
            this.addFn2(fn.prepare(schemaPart.schema, this.ctx), schemaPart, null, stopLabel);
        } else if (fn.length === 1 || fn.length === 2) {
            this.addFn2(fn.call(this.selector, schemaPart.schema, this.ctx), schemaPart, null, stopLabel);
        } else {
            this.addFn2(fn, schemaPart, name, stopLabel);
        }
    },

    addFn2: function (fn, schemaPart, directCallName, stopLabel) {
        if (fn === undefined || fn === null) {
            return;
        }
        if (typeof fn.inline === 'function' && this.options.noinline) {
            this.code("this['%%'].inline.call(this, %%, ctx)", directCallName, schemaPart.varName);
        } else if (fn.inline) {
            this.codeComposer.inline(fn.inline, schemaPart.varName, stopLabel);
            return; //to skip checking stop
        } else if (directCallName) {
            this.code("this['%%'](%%, %%, ctx)", directCallName, this.shared.schema(schemaPart.schema), schemaPart.varName);
        } else {
            this.code("%%.call(this, %%, %%, ctx)", this.shared.inner(fn), this.shared.schema(schemaPart.schema), schemaPart.varName);
        }
        this.code("if (ctx.wasReplaced()) %% = ctx.replacement()", schemaPart.varName);
        this.code("if (ctx.isStopped()) break %%", stopLabel);
    },

    step: function (schema, varName, opts) {
        if (schema.$$visited) {
            //TODO: this is solution only for root recursion - to pass official suite :)
            this.code("if (%% !== undefined) self(%%,ctx.path);", varName, varName);
            return;
        }
        Object.defineProperty(schema, "$$visited", {value: true, enumerable: false, configurable: true});
        if (schema.$ref) {
            return this.step(resolveRef(this.options.loader, this.schemaRoot, schema.$ref), varName, opts);
        }
        this.stepProcess(new SchemaPart(schema, varName, function (cldSchema, cldVarName, sProp, prop, attr) {
            this.ctx.push(sProp, schema, cldSchema);
            this.code("ctx.push(%%, %%, %%)", prop || JSON.stringify(sProp), varName, cldVarName);
            this.step(cldSchema, cldVarName, {attr: attr});
            this.ctx.pop();
            this.code("ctx.pop()");
        }.bind(this)), opts);
        delete schema.$$visited;

    },

    stepProcess: function (schemaPart, opts) {
        var callback = this.callback.bind(this, schemaPart);

        this.processAggregate(schemaPart.schema);

        if (opts && opts.attr) {
            callback(opts.attr);
        }
        callback("start");
        callback();

        this.processor.execute(schemaPart);

        callback("end");
        if (opts && opts.attr) {
            callback(opts.attr + "-end");
        }
    },

    processAggregate: function (schema) {
        ["oneOf", "anyOf", "allOf", "not"].forEach(function (inner) {
            if (schema[inner]) {
                this.ctx.compile(schema[inner], inner);
            }
        }.bind(this));
    },

    addEnd: function () {
        var end = this.selector.end;
        if (end) {
            if (end.inline && !this.options.noinline) {
                this.codeComposer.inline(end.inline, "val", null, true);
            } else {
                this.codeComposer.code("return this.%%", end.inline ? "end.inline.call(this)" : "end()");
            }
        }
    },

    compile: function () {
        var fnbody, fnout;
        this.step(this.schemaRoot, "val");
        this.addEnd();
        fnbody = this.codeComposer.prettify().map(function (line) {
            return "{};".indexOf(line[line.length - 1]) === -1 ? line + ";" : line;
        }).join("\n");
        fnbody = ["var self; selector._f = function(val, path) { var nil = undefined, schemaOnly = val === undefined"]
            .concat(this.gen.generated).join(",") + ";\nctx.reset(path, val);" +
            fnbody + "}; self = function (val, path) {" + (this.selector.begin ? "selector.begin();" : "") + " return selector._f(val, path) }; self.fn = selector._f; return self; ";
        try {
            fnout = new Function("selector", "schemas", "innerFns", "ctx", fnbody);
        } catch (e) {
            console.error(fnbody);
            throw e;
        }
        return fnout(this.selector, this.shared.schemas, this.shared.innerFns, new CurrentObject());
    }
};


function compile(userSchema, selectorCtor, options, path) {
    return new Compiler(userSchema, selectorCtor, options, path).compile();
}

module.exports = compile;

},{"./int/code":2,"./int/context":3,"./int/gen":4,"./int/matchers":5,"./int/processor":6,"./int/references":7,"./int/shared":8}],2:[function(require,module,exports){
"use strict";
var Generator = require('./gen');
var interpolate = require('../interpolate');

function CodeComposer() {
    this.codeLines = [];
    this.labelgen = new Generator('clabel');
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

CodeComposer.prototype = {
    pop: function () {
        this.codeLines.pop();
    },

    code: function (template) {
        this.codeLines.push(interpolate(template).apply(null, [].slice.call(arguments, 1)));
    },

    prettify: function () {
        return prettifyCode(this.codeLines);
    },

    inline: function (fnInline, varName, stopLabel, allowReturn) {
        var fnbody = fnInline.toString()
                .replace(/^function\s*\([^)]*\)/, "")
                .replace(/_/g, varName),
            label = this.labelgen.next(),
            needLabel = fnbody.indexOf('return') !== -1;
        fnbody = fnbody.replace(/ctx\.stop\(\)/, "break " + stopLabel);
        if (!allowReturn) {
            fnbody = fnbody.replace(/return/g, "break " + label);
        }
        if (needLabel) {
            this.code("%%:{%%}", label, fnbody);
        } else {
            this.code(fnbody);
        }
    }
};

module.exports = CodeComposer;
},{"../interpolate":9,"./gen":4}],3:[function(require,module,exports){
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
        this.replaced = true;
    },
    wasReplaced: function () {
        var val = this.replaced;
        this.replaced = false;
        return val;
    },
    replacement: function () {
        return this.parent[this.property];
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

module.exports = CurrentObject;
},{}],4:[function(require,module,exports){
"use strict";

function Generator(prefix) {
    this.i = 0;
    this.prefix = prefix;
    this.generated = [];
}

Generator.prototype = {
    next: function () {
        this.i = this.i + 1;
        var nv = this.prefix + this.i;
        this.generated.push(nv);
        return nv;
    }
};

module.exports = Generator;
},{}],5:[function(require,module,exports){
"use strict";

var attrRe = /(\[(\^?[\-_\w]+)(=[\-_\w]+)?\])/g;
var modRe = /:([\-\w]+)$/;

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

function matchEq(value1, value2) {
    return value1 !== undefined && (value1 === value2 || value2 === undefined);
}

function matchNotEq(value1, value2) {
    return value1 === undefined || (value1 !== value2 && value2 !== undefined);
}

function createMatcher(expr) {
    var ma = modRe.exec(expr), props = [], attr, not, i;
    if (ma) {
        attr = ma[1];
    }
    ma = attrRe.exec(expr);
    while (ma) {
        not = ma[2][0] === '^';
        props.push({
            name: not ? ma[2].substring(1) : ma[2],
            matcher: not ? matchNotEq : matchEq,
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
            if (!props[i].matcher(sv, props[i].value)) {
                found = false;
                break;
            }
        }
        if (found) {
            return cb(expr);
        }
    };

}

module.exports = function (expr) {
    if (expr.indexOf(":") !== -1 || expr.indexOf("[") !== -1) {
        return createMatcher(expr);
    }
};
},{}],6:[function(require,module,exports){
"use strict";
var Generator = require('./gen');

function SchemaPartProcessor(vargen, codeComposer, options) {
    this.vargen = vargen;
    this.labelgen = new Generator('label');
    this.codeComposer = codeComposer;
    this.options = options;
}


SchemaPartProcessor.prototype = {

    processors: ['processItems', 'processProperties'],

    execute: function (step) {
        this.processors.forEach(function (p) {
            this[p](step);
        }.bind(this));
    },

    createVar: function () {
        return this.vargen.next();
    },

    code: function () {
        this.codeComposer.code.apply(this.codeComposer, arguments);
    }
};

SchemaPartProcessor.prototype.processItems = function (step) {
    if (!step.schema.items && !step.schema.additionalItems) {
        return;
    }
    var idxvar, newvar, k;
    if (!Array.isArray(step.schema.items)) {
        idxvar = this.createVar();
        this.codeComposer.code("for (%% = 0; %%  < (%% ? %%.length : 0); %%++) {", idxvar, idxvar, step.varName, step.varName, idxvar);
        newvar = this.createVar();
        this.codeComposer.code("%% = %%[%%]", newvar, step.varName, idxvar);
        step.next(step.schema.items, newvar, "[]", idxvar, "item");
        this.code("}");
        if (!this.options.ignoreSchemaOnly) {
            this.code("if (schemaOnly) {");
            step.next(step.schema.items, 'nil', "[]", undefined, "item");
            this.code("}");
        }
    } else {
        for (k = 0; k < step.schema.items.length; k = k + 1) {
            newvar = this.createVar();
            this.code("%% = %% ? %%[%%] : undefined", newvar, step.varName, step.varName, k);
            step.next(step.schema.items[k], newvar, k);
        }
        if (!this.options.ignoreAdditionalItems) {
            idxvar = this.createVar();
            this.code("for (%% = %%; %% < (%% ? %%.length : 0); %%++) {", idxvar, step.schema.items.length, idxvar, step.varName, step.varName, idxvar);
            newvar = this.createVar();
            this.code("%% = %%[%%]", newvar, step.varName, idxvar);
            this.processAdditional(step, "additionalItems", "additionalItem", idxvar, newvar);
            this.code("}");
        }
    }

};

SchemaPartProcessor.prototype.processProperties = function (step) {
    if (!step.schema.properties && !step.schema.additionalProperties && !step.schema.patternProperties) {
        return;
    }
    var propsVar, newvar, k;
    if (!this.options.ignoreAdditionalItems) {
        propsVar = this.createVar();
        this.code("%% = {}", propsVar);
    }
    for (k in step.schema.properties) {
        if (step.schema.properties.hasOwnProperty(k)) {
            newvar = this.createVar();
            this.code("%% = %% ? %%.%% : undefined", newvar, step.varName, step.varName, k);
            if (!this.options.ignoreAdditionalItems) {
                this.code("%%.%% = true", propsVar, k);
            }
            step.next(step.schema.properties[k], newvar, k);
        }
    }
    if (!this.options.ignoreAdditionalItems) {
        this.processAdditionalProperties(step, propsVar);
    }
};

SchemaPartProcessor.prototype.processAdditionalProperties = function (step, propsVar) {
    var idxvar, newvar, k, patternProperties;
    idxvar = this.createVar();
    newvar = this.createVar();
    this.code("if (typeof %% === 'object' && !Array.isArray(%%)) for (%% in %%) if (%%.hasOwnProperty(%%)) {",
        step.varName, step.varName, idxvar, step.varName, step.varName, idxvar
        );
    this.code("%% = %%[%%]", newvar, step.varName, idxvar);
    patternProperties = step.schema.patternProperties || {};
    for (k in patternProperties) {
        if (patternProperties.hasOwnProperty(k)) {
            this.code("if (/%%/.test(%%)) {", k, idxvar);
            step.next(step.schema.patternProperties[k], newvar, k, idxvar);
            this.code("%%[%%] = true", propsVar, idxvar);
            this.code("}");
        }
    }
    this.code("if (!%%[%%]) {", propsVar, idxvar);
    this.processAdditional(step, "additionalProperties", "additionalProperty", idxvar, newvar);
    this.code("}");
    this.code("}");
};

SchemaPartProcessor.prototype.processAdditional = function (step, schemaProp, cbProp, idxvar, newvar) {
    var stubSchema = {};
    stubSchema[cbProp] = false;
    if (step.schema[schemaProp] === false) {
        step.next(stubSchema, newvar, "*", idxvar);
    } else if (typeof step.schema[schemaProp] === 'object') {
        step.next(step.schema[schemaProp], newvar, "*", idxvar);
    } else {
        stubSchema[cbProp] = "allowed";
        step.next(stubSchema, newvar, "*", idxvar);
    }
};


module.exports = SchemaPartProcessor;
},{"./gen":4}],7:[function(require,module,exports){
"use strict";

function defaultLoader() {
    throw new Error("Remote refs are not supported for now :(");
}

function detilde(s) {
    return s.replace(/~0/g, "~").replace(/~1/g, "/");   //do not know how to parse it other way
}

function resolveRef(loader, schemaNode, ref) {
    var remLoc = decodeURI(ref).split("#"), rem = remLoc[0], loc = remLoc[1].split("/").map(detilde), st = schemaNode, i;
    if (rem !== '') {
        st = (loader || defaultLoader)(rem);
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

module.exports = resolveRef;
},{}],8:[function(require,module,exports){
"use strict";

function Shared() {
    this.innerFns = [];
    this.schemas = [];
}

Shared.prototype = {
    inner: function (fn) {
        this.innerFns.push(fn);
        return "innerFns[" + (this.innerFns.length - 1) + "]";
    },
    schema: function (s) {
        this.schemas.push(s);
        return "schemas[" + (this.schemas.length - 1) + "]";
    }
};

module.exports = Shared;
},{}],9:[function(require,module,exports){
"use strict";

var compiled = {};

function interpolate(template) {
    if (compiled[template]) {
        return compiled[template];
    }
    var list = template.split("%%"),
        code = "return " + ["list[0]", "a", "list[1]", "b", "list[2]", "c", "list[3]", "d", "list[4]", "e", "list[5]", "f", "list[6]", "g", "list[7]"].slice(0, list.length * 2 - 1).join("+"),
        fn = (new Function("list", "return function(a,b,c,d,e,f,g){" + code + "};"))(list);
    compiled[template] = fn;
    return fn;
}
module.exports =  interpolate;

},{}],10:[function(require,module,exports){
"use strict";
var compile = require('./compiler');
var Validator = require('./v4validator');
var Normalizer = require('./normalizer');
var extend = require('./validator_extend');

extend(Validator);

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

},{"./compiler":1,"./normalizer":12,"./v4validator":13,"./validator_extend":14}],11:[function(require,module,exports){
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
};

},{}],12:[function(require,module,exports){
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
            isTrue = ['true', 'on'].indexOf(object.toLowerCase()) !== -1;
            isFalse = ['false', 'off'].indexOf(object.toLowerCase()) !== -1;
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
},{}],13:[function(require,module,exports){
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
        regexp: /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-[0-9]{2}[tT ]\d{2}:\d{2}:\d{2}(\.\d+)?([zZ]|[+\-]\d{2}:\d{2})$/,
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

function nonUnicodeLength(str) {
    return str.length;
}

function V4Validator(options) {
    this.options = options || {};
    if (!this.options.gettext) {
        this.options.gettext = function (s) { return s; };
    }
    if (!this.options.messages) {
        this.options.messages = messages(this.options.gettext);
    }
    this.options.custom = this.custom = this.options.custom || {};
    this.options.formats = this.formats = this.options.formats || {};
    this.options.strLength = this.strLength = this.options.strLength || nonUnicodeLength;
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
    error: function (code, ctx, arg, pathReplacement) {
        var msg = (this.$cm && this.$cm[code]) ? this.options.gettext(this.$cm[code]) : this.options.messages[code] || arg || (function () {throw new Error("There is no message registered for error '" + code + "'"); }());
        this.$cm = undefined;
        this.errors.push({
            code: code,
            message: msg,
            value: ctx.self,
            arg: arg,
            path: pathReplacement || ctx.path.slice()
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

    "[messages]:end": {inline: "this.$cm = undefined;"},

    ////////////// type & common


    "[^required]": {prepare: function (s, ctx) {
        if (!ctx.parent) {
            return null;
        }
        return {inline: "if (_ === undefined) ctx.stop()"};
    }},
    "[required]": {inline: "if (_ === undefined) ctx.stop()"},
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
            var fns = [], i;
            for (i = 0; i < schema.type.length; i++) {
                fns.push(this["[type=" + schema.type[i] + "]"].inline);
            }
            return function (s, o, ctx) {
                var old = this.errors,
                    newErrs = [];
                this.errors = newErrs;
                for (i = 0; i < fns.length; i++) {
                    fns[i].call(this, o, ctx);
                }

                this.errors = old;
                if (newErrs.length === fns.length) {
                    this.copyErrors(newErrs);
                }

            };
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
        return {inline: icode.join("\n")};
    },

    //////////////// combining

    "[allOf]": {inline: function (_, ctx) {
        var i, res;
        for (i = 0; i < ctx.allOf.length; i++) {
            res = ctx.allOf[i](_, ctx.path);

            if (!res.valid) {
                this.error("allOf", ctx);
                this.copyErrors(res.errors);
            }
        }
    }},

    "[anyOf]": {inline: function (_, ctx) {
        var allErrors = [], res, i;
        for (i = 0; i < ctx.anyOf.length; i++) {
            res = ctx.anyOf[i](_, ctx.path);
            allErrors = allErrors.concat(res.errors);
            if (res.valid) {
                break;
            }
        }
        if (!res.valid) {
            this.error("anyOf", ctx);
            this.copyErrors(allErrors);
        }
    }},

    "[oneOf]": {inline: function (_, ctx) {
        var count = 0, allErrors = [], res, i;
        for (i = 0; i < ctx.oneOf.length; i++) {
            res = ctx.oneOf[i](_, ctx.path);
            allErrors = allErrors.concat(res.errors);
            if (res.valid) {
                count++;
            }
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
        var $enum = {}, i, e;
        for (i = 0; i < schema.enum.length; i++) {
            e = schema.enum[i];
            $enum[this.toComparable(e)] = 1;
        }
        this.$enums.push($enum);
        return {inline: "if(!this.$enums[" + (this.$enums.length - 1) + "][this.toComparable(_)]) this.error('enum', ctx, " + JSON.stringify(schema.enum) + ")"};
    },

    //////////////// string

    "xLength": function (op, count, code) {
        return {inline: "if (typeof _ === 'string' && this.strLength(_) " + op + count + ") this.error('" + code + "', ctx, " + count + ")"};
    },

    "[maxLength]": function (schema) {
        return this.xLength(">", schema.maxLength, 'maxLength');
    },
    "[minLength]": function (schema) {
        return this.xLength("<", schema.minLength, 'minLength');
    },
    "[pattern]": function (schema) {
        return {inline: "if (typeof _ === 'string' && !_.match(/" + schema.pattern + "/)) this.error('pattern', ctx, " + JSON.stringify(schema.pattern) + ")"};
    },
    "[format]": function (schema) {
        var fmt = this.formats[schema.format];
        if (!fmt) {
            throw new Error("Unknown format '" + schema.format + "'. Did you forget to register it?");
        }
        return {inline: "if (typeof _ === 'string' && !_.match(" + fmt.regexp + ")) this.error('format." + schema.format + "', ctx, " + JSON.stringify(fmt.message) + ")"};
    },

    ////////////////// array

    "[additionalItem=false]": {inline: function (_, ctx) {
        this.error("additionalItems", ctx);
    }},

    "xItems": function (op, count, code) {
        return {
            inline: "if(Array.isArray(_) && _.length " + op + count + ") this.error('" + code + "', ctx)"
        };
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

    processRequired: function (reqs) {
        if (Array.isArray(reqs)) {
            return function (s, o, ctx) {
                if (!isObject(o)) {
                    return;
                }
                var i;
                for (i = 0; i < reqs.length; i++) {
                    if (!o.hasOwnProperty(reqs[i])) {
                        this.error("required", ctx, null, ctx.path.slice().concat(reqs[i]));
                    }

                }
            };
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
        return {inline: "if (typeof _ === 'number' && (_ / " + schema.multipleOf + ") % 1 !== 0) this.error('multipleOf', ctx, " + schema.multipleOf + ")" };
    },

    "ximum": function (op, excl, count, code) {
        return {inline: "if (_ " + op +  (excl ? "=" : "") + count + ") this.error('" + code + (excl ? ".exclusive" : "") + "', ctx, " + count + ")"};
    },
    "[minimum]": function (schema) {
        return this.ximum("<", schema.exclusiveMinimum, schema.minimum, 'minimum');
    },
    "[maximum]": function (schema) {
        return this.ximum(">", schema.exclusiveMaximum, schema.maximum, 'maximum');
    },

    ///////////////// custom
    "[conform]": function (schema) {
        this.$custom = this.$custom || [];
        if (typeof schema.conform === 'function') {
            this.$custom.push(schema.conform);
            return {inline: "if (!this.$custom[" + (this.$custom.length - 1) + "](_, ctx)) this.error('custom', ctx)"};
        }
        var inlines = [];
        var k, fn, args;
        for (k in schema.conform) {
            if (schema.conform.hasOwnProperty(k)) {
                fn = this.custom[k];
                args = schema.conform[k] === true ? "" : schema.conform[k].map(JSON.stringify).concat([""]).join(',');
                this.$custom.push(fn);
                inlines.push("if (!this.$custom[" + (this.$custom.length - 1) + "](_, " + args + " ctx)) this.error('custom." + k + "', ctx, this.options.messages.custom)");
            }
        }
        return {inline: inlines.join('\n')};
    },

    ///////////////// result

    end: {inline: function () {
        this.res.valid = this.errors.length === 0;
        return this.res;
    }},

    begin: function () {
        this.errors = this.res.errors = [];
        this.res.valid = true;
        delete this.$cm;
    }

};
V4Validator.prototype.constructor = V4Validator;

V4Validator.factory = function (options) {
    return function () {
        return new V4Validator(options);
    };
};

module.exports = V4Validator;
},{"./messages":11}],14:[function(require,module,exports){
"use strict";
module.exports = function addExtender(ValidatorClass) {

    ValidatorClass.extend = function (override, ctor) {
        function NewValidator(options) {
            ValidatorClass.call(this, options);
            if (ctor) {
                ctor.call(this, options);
            }
        }

        NewValidator.prototype = new ValidatorClass();
        NewValidator.prototype.constructor = NewValidator;
        var k;
        for (k in override) {
            if (override.hasOwnProperty(k)) {
                NewValidator.prototype[k] = override[k];
            }
        }
        NewValidator.factory = function (options) {
            return function () {
                return new NewValidator(options);
            };
        };

        return NewValidator;
    };

};
},{}]},{},[10])(10)
});