var base = require('./iterator_base');
var ext = require('./standardExtensions');
var validator = require('./v4validator');
var selector = require('./selector');

function Iterator() {

}

function Validator(schema, options) {

}

module.exports = {
    Iterator: Iterator,
    Validator: Validator
};


/*
usage:

  it = new Iterator(schema)
  it.iterate(obj, cb);

  //or

  it.setCallback(...)
  it = new Iterator(schema, options = {callback: ..., useSelectors: true/false, ...);


  v = new Validator(schema, options);    --> new Iterator(schema, {callback: validatorSelectors(..)})
  v.validate(obj)

  Iterator.create(schema, options)
  Iterator.cb.validatorSelector(options)
  Iterator.createValidator(schema);


 */