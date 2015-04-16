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

    "[type=array]:start": {inline: 'this.html += "<fieldset>"; '},

    "[type=array]:end": {inline: 'this.html += "</fieldset>"; '},

    ":item": {inline: 'this.html += "<div id=\'" + this.path(ctx) + "\'>"'},

    ":item-end": {inline: 'this.html += "<button onclick=\'document.getElementById(\" + this.path(ctx) + \").remove();\'>Delete</button></div>"'},

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

    "[enum]": function (schema, object) {
        return {inline: "this.select(" + JSON.stringify(schema.enum) + ", _, {name: this.path(ctx)}); ctx.stop();"};
    },
    "[enum]:end": {inline: function (_, ctx) {
        ctx.stop();
    }},

    "[type=string]": {inline: "this.html += '<input type=string name=\"' + this.path(ctx) + '\" value= \"' + _ + '\"'"},
    "[required]": {inline: function (_, ctx) {
        this.html += " required ";
    }},
    "[type=string]:end": {inline: function (_, ctx) {
        this.inputEnd();
    }},

    begin: function () {
        this.html = "";
    },

    end: function () {
        return this.html;
    }
}

var schema = require('./schema.js');
var genCompiled = s.newIterator(schema, FormGenerator);


if (__filename == process.argv[1]) {
    console.log(genCompiled({
        firstname: "frodo", lastname: "baggins", gender: "male", favouriteBooks: [
            {name: "Lord of the Rings", genre: "Epic story"},
            {name: "Silmarrilion", genre: "More epic story"}
        ]
    }));
    console.log(genCompiled.fn.toString());
}


module.exports = genCompiled;