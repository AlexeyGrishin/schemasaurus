"use strict";
var Base = require('./iterator_base');
var ext = require('./standardExtensions');
var createValidator = require('./v4validator');
var createSelector = require('./selector');


function Iterator(iterator, opts) {
    var it, fn;
    it = new Base(iterator, opts);
    ext(it);
    fn = it.iterate.bind(it);
    fn.schema = function (s) {
        it.schema(s);
        return fn;
    };
    return fn;
}

function Validator(options) {
    return Selector(createValidator(options), options);
}

function Selector(selector, options) {
    return Iterator(createSelector(selector), options);
}

module.exports = {
    Iterator: Iterator,
    Selector: Selector,
    Validator: Validator
};

Validator.meta = createValidator.meta;
Iterator.meta = Base.meta;
