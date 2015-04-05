var base = require('./iterator_base');
var ext = require('./standardExtensions');
var createValidator = require('./v4validator');
var createSelector = require('./selector');


function Iterator(iterator, opts) {
  var it = new base(iterator, opts);
  ext(it);
  var fn = it.iterate.bind(it);
  fn.schema = function(s) {
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
Iterator.meta = base.meta;
