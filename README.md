[![Build Status](https://travis-ci.org/AlexeyGrishin/schemasaurus.png?branch=master)](https://travis-ci.org/AlexeyGrishin/schemasaurus)
[![Coverage Status](https://coveralls.io/repos/AlexeyGrishin/schemasaurus/badge.svg?branch=master)](https://coveralls.io/r/AlexeyGrishin/schemasaurus?branch=master)
[![Code Climate](https://codeclimate.com/github/AlexeyGrishin/schemasaurus/badges/gpa.svg)](https://codeclimate.com/github/AlexeyGrishin/schemasaurus)

# What is this
First of all Schemasaurus is an iterator over JSON according to JSON schema. For example:

```javascript
var s = require('schemasaurus')

var fn = s.compile({
  properties: {
    firstname: {type: "string", required: true},
    lastname: {type: "string", required: true},
    age: {type: "number"}
  }
}, function () {
  return {
    "[type=string]": function (schema, object, ctx) {
      console.log("string = " + object);
    },
    "[type=number]": function (schema, object, ctx) {
      console.log("number = " + object);
    },
    "[required]": function (schema, object, ctx) {
      console.log(" *required");
    }
  }
});
fn({firstname: "frodo", lastname: "baggins", age: 33});
// Output:
//  string = frodo
//   *required
//  string = baggins
//   *required
//  number = 33
```

It could be used as a base for other JSON schema-related tools - validators, form generators, etc.

For now schemasaurus already contains following tools:
- Validator for JSON schema draft 4
  * it passes official test suite except the following tests:
    * unicode-related tests
    * remote references
- Normalizer (removes props non-listed in schema, applies defaults, converts types)

See usage examples below.

Schemasaurus works in node.js and browser. To install run

```
npm install schemasaurus
```


# Other solutions

Well, there is a lot of schema validators, few form generators but I did not found something like __iterator__ that could be extended for any purpose.
So even schemasaurus has json schema validator it is not the main feature of library. If you just look for validator there are other known libraries like [is-my-json-valid](https://github.com/mafintosh/is-my-json-valid) or [jjv](https://github.com/acornejo/jjv).

# Validator usage

Here is node.js code, but it will work in browser as well, just get 'schemasaurus' object from window.
```javascript
var s = require('schemasaurus');

var validator = s.newValidator({
  properties: {
    str: {type: "string"},
    numeric: {type: "number", minimum: 5, exclusiveMinimum: true},
    custom: {
      conform: function Pi(value) { return value == 3.14; },
      messages: {
        custom: "It is not PI"
      }
    },
    array: {type: "array", items: {
      type: "boolean"
    }}
  },
  additionalProperties: false
});

console.log(JSON.stringify(validator({str: "6", numeric: 6, custom: 3.14, array: [true, false]})));
// Output: {"valid":true,"errors":[]}
console.log(validator({str: 5, numeric: 5, custom: 5, array: [5]}));
// Output: {"valid":false, "errors": [
//        {
//            "code": "string",
//            "message": "shall be a string",
//            "value": 5,
//            "path": ["str"]
//        },
//        {
//            "code": "minimum.exclusive",
//            "message": "shall be > %d",
//            "arg": 5,
//            "value": 5,
//            "path": ["numeric"]
//        },
//        {
//            "code": "custom",
//            "message": "It is not PI",
//            "value": 5,
//            "path": ["custom"]
//        },
//        {
//            "code": "boolean",
//            "message": "shall be boolean",
//            "value": 5,
//            "path": ["array",0]
//        }

```

For each error you'll get the following:
* `code` - error code, usually equal to corresponding schema attribute (required, minimum, etc.). You may check the full list with default messages at `src/messages.js`
* `message` - error message, default or custom. To provide your own error messages you'll need to do one of the following:
  * pass `messages` object to validator constructor where messages are values and error codes are keys (i.e. like `{required: "shall be"}` )
  * provide `messages` object directly in schema, in same format
* `arg` - for some bound violation errors here will be value from schema - minimum, maximum, etc.
* `value` - value that violated the schema
* `path`- array of properties that shall be used to get to value from root of object.

### Formats

To add your own format just pass them to the validator constructor:

```javascript
var s = require('schemasaurus');

var v = s.newValidator({
    type: "string",
    format: "binary"
}, {formats: {
    binary: {
        regexp: /[01]+/,
        message: "binary message shall have only 0 or 1 chars"
    }
}});
console.log(v("010"));
// Output:  { valid: true, errors: [] }
console.log(v("2"));
// Output: { valid: false,
// errors:
//    [ { code: 'format.binary',
//        message: 'binary message shall have only 0 or 1 chars',
//        value: '2',
//        arg: 'binary message shall have only 0 or 1 chars',
//        path: [] } ] }
```

### Custom validators

TBD

### Extend/fix validator

TBD

# Normalizer usage

TBD

# Create own tool

TBD

# Benchmark for validator


