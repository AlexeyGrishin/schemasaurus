"use strict";

var CurrentObject = require('./int/context');
var Context = CurrentObject;
var Generator = require('./int/gen');
var Shared = require('./int/shared');
var SchemaPartProcessor = require('./int/processor');
var CodeComposer = require('./int/code');

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

function convertMatcher(expr) {
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
                return cb(expr);
            }
        };
    }
}

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
            ma = convertMatcher(m);
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
            return this.step(resolveRef(this.options.loader || defaultLoader, this.schemaRoot, schema.$ref), varName, opts);
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
        fnbody = prettifyCode(this.codeComposer.codeLines).map(function (line) {
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
