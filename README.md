[![Build Status](https://travis-ci.org/AlexeyGrishin/schemasaurus.png?branch=master)](https://travis-ci.org/AlexeyGrishin/schemasaurus)
[![Coverage Status](https://coveralls.io/repos/AlexeyGrishin/schemasaurus/badge.svg?branch=master)](https://coveralls.io/r/AlexeyGrishin/schemasaurus?branch=master)
[![Code Climate](https://codeclimate.com/github/AlexeyGrishin/schemasaurus/badges/gpa.svg)](https://codeclimate.com/github/AlexeyGrishin/schemasaurus)

# What is this
First of all Schemasaurus is an iterator over JSON according to JSON schema. For example:

```javascript
var s = require('schemasaurus')

var fn = compile({
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
```

It could be used as a base for other JSON schema-related tools - validators, form generators, etc.

For now schemasaurus already contains following tools:
- Validator for JSON schema draft 4
- Normalizer (removes props non-listed in schema, applies defaults, converts types)

See usage examples below.


# Other solutions


# Validator usage

# Normalizer usage

# Create own tool

# Benchmark for validator


