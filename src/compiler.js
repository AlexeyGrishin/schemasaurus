"use strict";
function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

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
        this.si = 0;
        this.parent = null;
        this.property = null;
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
