var sampleSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        username: {
            type: "string",
            title: "Username",
            required: true,
            minLength: 3
        },
        password: {
            type: "string",
            title: "Password",
            required: true,
            minLength: 3
        },
        password2: {
            type: "string",
            title: "Repeat password",
            required: true,
            minLength: 3
        },
        companiesInfo: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: {type: "string", required: true, title: "Name"},
                    primary: {type: "boolean", required: true, title: "Primary"},
                    address: {type: "string", title: "Address"},
                    additionalProperties: false
                }
            }
        }
    }
};

function iterate(schema, object, listener) {
    var ATTR_REGEX = /^\s*\[(\w+)\s*(=\s*(.*))?\](:\w+)?\s*$/;

    function matcher(attr, value, modifier) {
        return function(schema, mod) {
            if (typeof schema[attr] === 'undefined') return false;
            if (typeof value !== 'undefined' && schema[attr] !== value) return false;
            if (mod != modifier) return false;
            return true;
        }
    }

    var matchers = [];

    var l = typeof listener === 'function' ? listener() : listener;
    for (var pattern in l) {
        if (l.hasOwnProperty(pattern)) {
            var m = ATTR_REGEX.exec(pattern);
            if (m) {
                matchers.push({matcher: matcher(m[1], m[3], m[4]), exec: l[pattern]})
            }
        }
    }

    function callListener(schema, mod, object, options) {
        var s = {
            next: true,
            stop: function() { this.next = false;}
        };
        for (var i = 0; i < matchers.length; i++) {
            if (matchers[i].matcher(schema, mod)) matchers[i].exec.call(s, schema, object, options);
            if (!s.next) break;
        }

    }

    function Context(ctx) {
        if (ctx) {
            this.stack = ctx.stack;
        }
        else {
            this.stack = [];
        }
    }

    Context.prototype = {
        push: function(item) {
            return new Context({stack: this.stack.concat([item])});
        },
        toObject: function() {
            return {
                path: this.stack.map(function(s) { return s.toString();}).join(".")
            }
        }
    };

    var justSchema = object == null;

    function step(schema, object, ctx) {
        switch (schema.type) {
            case "object":
                callListener(schema, null, object, ctx.toObject());
                callListener(schema, ":start", object, ctx.toObject());
                for (var p in schema.properties) {
                    if (schema.properties.hasOwnProperty(p)) {
                        step(schema.properties[p], object ? object[p] : object, ctx.push(p))
                    }
                }
                callListener(schema, ":end", object, ctx.toObject());
                break;
            case "array":
                //todo: support tuple mode
                var itemSchema = schema.items;
                if (justSchema) {
                    callListener(schema, ":start", object, ctx.toObject());
                    step(itemSchema, object, ctx.push("[]"));
                    callListener(schema, ":end", object, ctx.toObject());
                }
                else  {
                    callListener(schema, null, object, ctx.toObject());
                    if (object && object.length) {
                        for (var i = 0; i < object.length; i++) {
                            callListener(schema, ":start", object, ctx.toObject());
                            step(itemSchema, object[i], ctx.push("[" + i + "]"));
                            callListener(schema, ":end", object, ctx.toObject());
                        }
                    }
                }
                break;
            default:
                callListener(schema, null, object, ctx.toObject());
                break;
        }
    }

    step(schema, object, new Context());
    return l.done ? l.done() : schema;
}


iterate(sampleSchema, {username: "1", password: "2", password2: "2"}, {
    "[type=string]": function(schema, value) { console.log(schema.title + " = " + value); }
});

translatedSchema = iterate(JSON.parse(JSON.stringify(sampleSchema)), null, {
    "[title]": function(schema) { schema.title = "~" + schema.title;}
});

console.log(iterate(translatedSchema, {username: "1", companiesInfo: [{name: "a", primary:true}, {name: "b"}]}, function() {
    var form = "";
    var indent = "  ";
    return {
        "[type=array]:start": function() {
            form += indent + "<fieldset>\n";
            indent += "  ";
        },
        "[type=array]:end": function() {
            indent = indent.substring(0, indent.length - 1);
            form += indent + "</fieldset>\n";
        },
        "[type=array]": function() {
            form += indent + "<!-- form -->\n";
        },
        "[type=boolean]": function(schema, value, options) {
            form += indent + "<label>" + schema.title + "  <input name='" + options.path + "' " + (value ? "checked" : "") + " type='checkbox'></label>\n";
            this.stop();
        },
        "[type=object]": function() {this.stop()},
        "[type]": function(schema, value, options) {
            form += indent + "<label>" + schema.title + "  <input name='" + options.path + "' value='" + value + "'></label>\n";
        },
        done: function() { return form; }
    }
}));

//selectors:
// [attr=value]
// :modifier
// propName
// path.to.prop
// path.to.prop[attr=value]:modifier