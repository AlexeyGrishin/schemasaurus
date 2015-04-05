"use strict";
/*jslint nomen: true */

function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function reuse(obj, props) {
    function NewObj() {
        var k;
        for (k in props) {
            if (props.hasOwnProperty(k)) {
                this[k] = props[k];
            }
        }
    }
    NewObj.prototype = obj;
    return new NewObj();
}

function IteratorBase(callbackCtor, options) {
    if (typeof callbackCtor !== 'function') {
        throw new Error("callback shall be a function");
    }
    switch (callbackCtor.length) {
    case 0:
        break;
    case 3:
        var cb = callbackCtor;
        callbackCtor = function () { return cb; };
        break;
    default:
        throw new Error("Callback constructor shall have no arguments");
    }
    this._callbackCtor = callbackCtor;
    if (options && options.schema) {
        this._schema = options.schema;
    }
    this.attrs = reuse(IteratorBase.prototype.attrs, (options && options.attrs) ? options.attrs : {});
    this.types = reuse(IteratorBase.prototype.types, (options && options.types) ? options.types : {});

    this._options = options || {};
}



IteratorBase.prototype.schema = function (schema) {
    if (!schema) {
        throw new Error("Schema shall be an object");
    }
    this._schema = clone(schema);
    return this;
};

IteratorBase.prototype.attrs = {};
IteratorBase.prototype.types = {};

function isEmpty(o) { return o === undefined || o === null; }

IteratorBase.prototype.iterate = function (schema, object) {
    if (this._schema) {
        object = schema;
        schema = this._schema;
    }

    var self = this;
    function proceed(schemaNode, objectNode, stack, path) {
        var ctx, callback, c;
        ctx = {
            path: function () { return path; },
            attribute: undefined,
            value: function () { return stack[0][1]; },
            parent: function (n) {
                var p = stack[n || 1] || [];
                return {schema: p[0], object: p[1]};
            },
            visit: function (schemaNode, objectNode) {
                if (schemaNode === undefined) {
                    return;
                }
                if (!Array.isArray(schemaNode)) {
                    return proceed(schemaNode, objectNode, stack, path);
                }
                return schemaNode.map(function (s) {
                    return proceed(s, objectNode, stack, path);
                });
            },

            refbase: []
        };
        callback = self._callbackCtor();
        if (callback === undefined) {
            throw new Error("Callback shall be specified");
        }
        c = {
            schemaOnly: object === undefined,
            options: self._options,
            visit: function (schemaNode, objectNode, step) {
                var visitors, customVisitor, nodeType, attr, v;
                if (schemaNode.$$visited && isEmpty(objectNode)) {
                    //do not go deep - to prevent recursion
                    return;
                }
                Object.defineProperty(schemaNode, "$$visited", {value: true, configurable: true});
                if (schemaNode.id) {
                    ctx.refbase.push(schemaNode.id);
                }
                if (step) {
                    path.push(step);
                }
                stack.unshift([schemaNode, objectNode]);
                callback(schemaNode, objectNode, ctx);
                visitors = [];
                nodeType = schemaNode.type;
                for (attr in self.attrs) {
                    if (self.attrs.hasOwnProperty(attr) && schemaNode.hasOwnProperty(attr)) {
                        customVisitor = self.attrs[attr];
                        if (typeof customVisitor === 'string') {
                            nodeType = customVisitor;
                            customVisitor = null;
                        } else {
                            visitors.push(customVisitor);
                        }
                    }
                }
                customVisitor = self.types[nodeType];
                if (customVisitor) {
                    visitors.push(customVisitor);
                }
                for (v = 0; v < visitors.length; v = v + 1) {
                    visitors[v](schemaNode, objectNode, c, nodeType);
                }
                stack.shift();
                if (step) {
                    path.pop();
                }
                if (schemaNode.id) {
                    ctx.refbase.pop();
                }
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
            resolveRef: function (ref) {
                function detilde(s) {
                    return s.replace(/~0/g, "~").replace(/~1/g, "/");   //do not know how to parse it other way
                }
                var remLoc = decodeURI(ref).split("#"), rem = remLoc[0], loc = remLoc[1].split("/").map(detilde), st = schemaNode, i;
                if (rem !== '') {
                    throw new Error("Remote refs are not supported for now :(");
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
        };
        if (Object.defineProperty) {
            Object.keys(c).forEach(function (k) {
                Object.defineProperty(c, k, {editable: false, value: c[k]});
            });
        }

        c.visit(schemaNode, objectNode);
        ctx.finished = true;
        ctx.attribute = "finished";
        return callback(null, null, ctx);
    }

    return proceed(schema, object, [], []);

};

Object.defineProperty(IteratorBase.prototype, "meta", {get: function () {
    var self = this;
    return {
        type: function (type, visitor) {
            self.types[type] = visitor;
        },
        attr: function (attr, visitor) {
            self.attrs[attr] = visitor;
        }
    };
}});

IteratorBase.meta = {
    type: function (type, visitor) {
        IteratorBase.prototype.types[type] = visitor;
    },
    attr: function (attr, visitor) {
        IteratorBase.prototype.attrs[attr] = visitor;
    }
};

module.exports = IteratorBase;

