var b = require('benchmark');

var gen = require('./formgen');
var genCompiled = require('./formgen_compiled');

var suite = new b.Suite();
suite.add("non-compiled", function () {
    gen({firstname: "frodo", lastname: "baggins", gender: "male", favouriteBooks: [
        {name: "Lord of the Rings", genre: "Epic story"},
        {name: "Silmarrilion", genre: "More epic story"}
    ]})
}).add("compiled", function () {
    genCompiled({firstname: "frodo", lastname: "baggins", gender: "male", favouriteBooks: [
        {name: "Lord of the Rings", genre: "Epic story"},
        {name: "Silmarrilion", genre: "More epic story"}
    ]})
}).on('cycle', function(event) {
    console.log(String(event.target));
}).run();

