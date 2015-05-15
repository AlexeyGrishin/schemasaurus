"use strict";
var compile = require('./compiler-gb');
var Validator = require('./v4validator');
var Normalizer = require('./normalizer');
var interpolate = require('./interpolate');

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
