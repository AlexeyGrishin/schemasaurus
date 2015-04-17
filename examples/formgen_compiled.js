var s = require('../src/iterator');

var inline = s.inline;

function FormGenerator () {

}
FormGenerator.prototype = {
    path: function (ctx) {
        return ctx.path[0] + ctx.path.slice(1).map(function (p) { return p == "[]" ? p : "[" + p + "]" }).join("");
    },

    "[type=array]:start": inline('this.html += "<fieldset>"; '),

    "[type=array]:end": inline('this.html += "</fieldset>"; '),

    ":item": inline('this.html += "<div id=\'" + this.path(ctx) + "\'>"'),

    ":item-end": inline('this.html += "<button onclick=\'document.getElementById(\" + this.path(ctx) + \").remove();\'>Delete</button></div>"'),

    "[enum]": function (schema, ctx) {
        var lines = [];
        lines.push("this.html += \"<select name='" + this.path(ctx) + "'>\"\n");
        schema.enum.forEach(function (v) {
            lines.push("this.html += \"<option value='" + v + "' \" + (_ === " + JSON.stringify(v) + " ? 'selected' : '') + \">" + v + "</options>\"\n")
        });
        lines.push("this.html += \"</select>\"\n");
        lines.push("ctx.stop();");
        return {inline: lines.join("\n")};
    },
    "[enum]:end": inline('ctx.stop()'),

    "[type=string]": inline("this.html += '<input type=string name=\"' + this.path(ctx) + '\" value= \"' + _ + '\"'"),
    "[required]": {inline: function (_, ctx) {
        this.html += " required ";
    }},
    "[type=string]:end": {inline: function (_, ctx) {
        this.html += ">\n";
    }},

    begin: function () {
        this.html = "";
    },

    end: function () {
        return this.html;
    }
};

var schema = require('./schema.js');
var genCompiled = s.newIterator(schema, FormGenerator, {ignoreAdditionalItems: true});


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