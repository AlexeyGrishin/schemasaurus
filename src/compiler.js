"use strict";
function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function CurrentObject(path) {
    this.path = path ? path.slice() : [];
    this.stack = [];
    this.parent = null;
    this.property = null;
    this.self = null;
}
CurrentObject.prototype = {
    replace: function (newVal) {
        this.parent[this.property] = newVal;
    },
    remove: function () {
        delete this.parent[this.property];
    },
    push: function (prop, parent, self) {
        this.path.push(prop);
        this.stack.push([prop, parent, self]);
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
        this.stack.pop();
        this.path.pop();
        var last = this.stack[this.stack.length - 1];
        this.parent = last ? last[0] : undefined;
        this.property = last ? last[1] : undefined;
        this.self = last ? last[2] : undefined;
    }
};
var Context = CurrentObject;


function defaultLoader() {
    throw new Error("Remote refs are not supported for now :(");
}

function resolveRef(loader, schemaNode, ref) {
    function detilde(s) {
        return s.replace(/~0/g, "~").replace(/~1/g, "/");   //do not know how to parse it other way
    }
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

    options = options || {};
    options.ignoreAdditionalItems = options.ignoreAdditionalItems === undefined ? false: options.ignoreAdditionalItems;

    var code = [], schema = clone(userSchema), selector = selectorCtor(), matchFns, vars = [], fnin, fnout, matchers, labelCount = 0, label, schemas = [], ctx = new Context(path), schemaRoot = schema, innerFns = [];

    matchFns = function (schema, att, cb) {
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
    };


    function createVar() {
        var newvar = "i" + vars.length;
        vars.push(newvar);
        return newvar;
    }

    function addFn(fn, name, varName, schema, stopLabel, allowReturn) {
        var fnbody, k, useinner = false;
        if (fn.prepare || {1:1,2:1}[fn.length] /*todo: ugly */) {
            fn = (fn.prepare || fn).call(selector, schema, ctx);
            useinner = true;
        }
        if (!fn) return;
        code.push("//call " + name);
        if (fn.inline) {

            if (typeof fn.inline === 'function' && options.noinline) {
                innerFns.push(fn.inline);
                code.push((allowReturn ? "return " : "") + "innerFns[" + (innerFns.length-1) + "].call(this, " + varName + ", ctx)");
                if (stopLabel) code.push("if (ctx.isStopped()) break " + stopLabel);
            }
            else {

                label = "label" + labelCount++;
                fnbody = fn.inline.toString()
                    .replace(/^function\s*\([^)]*\)/, "")
                    .replace(/_/g, varName);

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
                code = code.concat((label + ":{" + fnbody + "}").split(/[\n\r]+/));
            }
        } else if (useinner) {
            schemas.push(schema);
            innerFns.push(fn);
            code.push((allowReturn ? "return " : "") + "innerFns[" + (innerFns.length-1) + "].call(this, schemas[" + (schemas.length-1) + "], " + varName + ", ctx)");
            if (stopLabel) code.push("if (ctx.isStopped()) break " + stopLabel);
        } else {
            schemas.push(schema);
            code.push((allowReturn ? "return " : "") + "this['" + name + "'](schemas[" + (schemas.length-1) + "], " + varName + ", ctx)");
            if (stopLabel) code.push("if (ctx.isStopped()) break " + stopLabel);

        }
    }

    ctx.compile = function (subschema, newFnName) {
        if (Array.isArray(subschema)) {
            innerFns.push(ctx[newFnName] = subschema.map(function (s) {
                return compile(s, selectorCtor, options, ctx.path.slice());
            }));
        } else {
            innerFns.push(ctx[newFnName] = compile(subschema, selectorCtor, options, ctx.path.slice()));
        }
        code.push("ctx." + newFnName + " = innerFns[" + (innerFns.length - 1) + "]");
    };

    function step(schema, varName, opts) {
        var k, newvar, idxvar, propsVar;
        opts = opts || {};

        if (schema.$$visited) {
            //TODO: this is solution only for root recursion - to pass official suite :)
            code.push("if (" + varName + " !== undefined) self(" + varName + ",this);");
            return;
        }
        Object.defineProperty(schema, "$$visited", {value: true, enumerable: false, configurable: true});

        if (schema.$ref) {
            step(resolveRef(options.loader || defaultLoader, schemaRoot, schema.$ref), varName, opts);
            return;
        }

        function callback(attr) {
            var noCodeAdded = code.length + 1, label = "label" + labelCount++;
            code.push(label +": {");
            matchFns(schema, attr, function (s, name) {
                addFn(s, name, varName, schema, label);
            });
            if (code.length === noCodeAdded) {
                code.pop();
            }
            else {
                code.push("}");
            }
        }
        if (opts.path) {
            code.push("ctx.push(" + opts.path + ", " + opts.parent + "," + varName + ")");
            ctx.push(opts.path, opts.parentSchema, schema);
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

        if (schema.properties || schema.additionalProperties || schema.patternProperties) {
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
                    step(schema.properties[k], newvar, {path: "'" + k + "'", parent: varName, parentSchema: schema});
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
                        step(schema.patternProperties[k], newvar, {path: idxvar, parent: varName, parentSchema: schema});
                        code.push(propsVar + "[" + idxvar + "] = true");
                        code.push("}");
                    }
                }
                code.push("if (!" + propsVar + "[" + idxvar + "]) {");
                if (schema.additionalProperties === false) {
                    step({additionalProperty: false}, newvar, {path: idxvar, parent: varName, parentSchema: schema});
                } else if (typeof schema.additionalProperties === 'object') {
                    step(schema.additionalProperties, newvar, {path: idxvar, parent: varName, parentSchema: schema});
                } else {
                    step({additionalProperty: "allowed"}, newvar, {path: idxvar, parent: varName, parentSchema: schema});
                }
                code.push("}");
                code.push("}");
            }
        }
        if (schema.items || schema.additionalItems) {
            if (!Array.isArray(schema.items)) {
                idxvar = createVar();
                code.push("for (" + idxvar + " = 0; " + idxvar + " < (" + varName + " ? " + varName + ".length : 0); " + idxvar + "++) {");
                newvar = createVar();
                code.push(newvar + " = " + varName + "[" + idxvar + "]");
                step(schema.items, newvar, {attr: "item", path: idxvar, parent: varName, parentSchema: schema});
                code.push("}");
                if (!options.ignoreSchemaOnly) {
                    code.push("if (schemaOnly) {");
                    step(schema.items, 'nil', {attr: "item", path: "'[]'", parent: varName, parentSchema: schema});
                    code.push("}");
                }
            } else {
                for (k = 0; k < schema.items.length; k = k + 1) {
                    newvar = createVar();
                    code.push(newvar + " = " + varName + " ? " + varName + "[" + k + "] : undefined");
                    step(schema.items[k], newvar, {path: "'" + k + "'", parent: varName, parentSchema: schema});
                }
                if (!options.ignoreAdditionalItems) {
                    idxvar = createVar();
                    code.push("for (" + idxvar + " = " + schema.items.length + "; " + idxvar + " < (" + varName + " ? " + varName + ".length : 0); " + idxvar + "++) {");
                    newvar = createVar();
                    code.push(newvar + " = " + varName + "[" + idxvar + "]");
                    if (schema.additionalItems === false) {
                        step({additionalItem: false}, newvar, {path:idxvar, parent: varName, parentSchema: schema});
                    } else if (typeof schema.additionalItems === 'object') {
                        step(schema.additionalItems, newvar, {path:idxvar, parent: varName, parentSchema: schema});
                    } else {
                        step({additionalItem: "allowed"}, newvar, {path:idxvar, parent: varName, parentSchema: schema});
                    }
                    code.push("}");
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
    fnbody = ["var ctx = new CurrentObject(path), nil = undefined, schemaOnly = val === undefined"].concat(vars).join(",") + ";" + fnbody;
    try {
        fnin = new Function("val", "schemas", "innerFns", "path", "CurrentObject", "self", fnbody);
    }
    catch (e) {
        console.error(fnbody);
        throw e;
    }

    function cloneSelector() {
        if (selector.clone) {
            return selector.clone();
        }
        else {
            var newsel = selectorCtor();
            for (var k in selector) {
                if (selector.hasOwnProperty(k)) {
                    newsel[k] = clone(selector[k]);
                }
            }
            return newsel;
        }

    }

    fnout = function (obj, sel) {
        sel = sel || cloneSelector();
        return fnin.call(sel, obj, schemas, innerFns, path, CurrentObject, fnout);
    };
    fnout.fn = fnin;
    return fnout;
}

module.exports = compile;