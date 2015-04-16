var s = require('../src/iterator');

function FormGenerator () {

}
FormGenerator.prototype = {
    input: function (type, options) {
        this.html += "<input type='" + type + "'";
        for (var name in options) {
            if (options.hasOwnProperty(name) && options[name] !== undefined) {
                this.html += " " + name + "='" + options[name] + "'";
            }
        }
    },

    inputEnd: function () {
        this.html += ">\n";
    },

    path: function (ctx) {
        return ctx.path[0] + ctx.path.slice(1).map(function (p) { return p == "[]" ? p : "[" + p + "]" }).join("");
    },

    append: function (str) {
        this.html += str + "\n";
    },

    "[type=array]:start": function (schema, object, ctx) {
        this.append("<fieldset>");
    },

    "[type=array]:end": function (schema, object, ctx) {
        this.append("</fieldset>");
    },

    ":item": function (schema, object, ctx) {
        this.append("<div id='" + this.path(ctx) + "'>");
    },

    ":item-end": function (schema, object, ctx) {
        this.append("<button onclick='document.getElementById(\"" + this.path(ctx) + "\").remove();'>Delete</button>");
        this.append("</div>");
    },

    select: function (values, selected, options) {
        this.html += "<select ";
        Object.keys(options).forEach(function(name) {
            this.html += " " + name + "='" + options[name] + "'";
        }.bind(this));
        this.html += ">\n";
        values.forEach(function (value) {
            this.append("<option value='" + value + "' " + (selected == value ? 'selected' : '') + ">" + value + "</option>");
        }.bind(this));
        this.html += "</select>\n";
    },

    "[enum]": function (schema, object, ctx) {
        this.select(schema.enum, object, {name: this.path(ctx)});
        ctx.stop();
    },
    "[enum]:end": function (schema, object, ctx) {
        ctx.stop();
    },

    "[type=string]": function (schema, object, ctx) {
        this.input('string', {value: object, name: this.path(ctx)});
    },
    "[required]": function (schema, object, ctx) {
        this.html += " required ";
    },
    "[type=string]:end": function (schema, object, ctx) {
        this.inputEnd();
    },

    begin: function () {
        this.html = "";
    },

    end: function () {
        return this.html;
    }
}

var schema = require('./schema.js');
var gen = s.newIterator(schema, FormGenerator);

if (__filename == process.argv[1]) {
    console.log(gen({
        firstname: "frodo", lastname: "baggins", gender: "male", favouriteBooks: [
            {name: "Lord of the Rings", genre: "Epic story"},
            {name: "Silmarrilion", genre: "More epic story"}
        ]
    }));
}

module.exports = gen;