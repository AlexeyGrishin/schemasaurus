"use strict";
var compile = require('./compiler');
var Validator = require('./v4validator');
var Normalizer = require('./normalizer');
var extend = require('./validator_extend');

extend(Validator);

module.exports = {
    Validator: Validator,
    Normalizer: Normalizer,
    compile: compile,

    newIterator: compile,

    newValidator: function (schema, voptions) {
        voptions = voptions || {};
        voptions.noreplace = true;
        return compile(schema, Validator.factory(voptions), voptions);
    },
    newNormalizer: function (schema) {
        return compile(schema, Normalizer.factory);
    }
};
