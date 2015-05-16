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

You have two ways to add custom validator:
1. Add function to 'conform' property of schema:
```javascript
var s = require('schemasaurus');

var v = s.newValidator({
    type: "string",
    conform: function (value) {
        return value.indexOf("-") == 0;
    }
});
console.log(v("1"));
//Output: { valid: false, errors: [ { code: 'custom', message: 'is not valid', value: '1', path: [] } ] }
console.log(v("-1"));
//Output: { valid: true, errors: [] }

```

You may customize message adding `messages` object to the schema on same level with key `custom`.

2. Register custom functions in validator constructor and refer them by name in schema:

```javascript
var s = require('schemasaurus');

var v = s.newValidator({
    properties: {
        username: {
            type: "string",
            required: true
        },
        password: {
            type: "string",
            required: true,
            conform: {
                isStrong: true,
                notEqualTo: ["username"]
            },
            messages: {
                "custom.isStrong": "password is weak",
                "custom.notEqualTo": "password shall not be same as username"
            }
        }
    }
}, {
    custom: {
        isStrong: function (value) {
            return value !== 'qwerty';
        },
        notEqualTo: function (value, field, ctx) {
            return ctx.parent[field] !== value;
        }
    }
});
console.log(v({username: "sam", password: "qwerty"}));
// ... {code: 'custom.isStrong', message: 'password is weak', path: ['password'] }
console.log(v({username: "sam", password: "sam"}));
// ... {code: 'custom.notEqualTo', message: 'password shall not be same as username', path: ['password'] }
console.log(v({username: "sam", password: "damn"}));
```

This way allows to remove code from schema so it could be stored on disk, db, transferred over net - whatever.

#### Context in custom validators

The last argument of custom validators is 'ctx' which has following useful attributes:
* `parent` - reference to the parent object/array
* `path` - array of properties that represents the full path to this value
* `property` - current property name


### Extend/fix validator

```javascript
var s = require('schemasaurus');


// Actually you may use any kind of class inheritance - MyValidator is just a subclass of Validator
var MyValidator = s.Validator.extend({
    '[notEqualTo]': function (schema, object, context) {
        var field = schema.notEqualTo;
        if (context.parent[field] === object) {
            this.error('myCode', context, 'my message');
        }
    },

    "[isStrong]": {inline: function (_, ctx) { if (_ === 'qwerty') this.error('myAnotherCode', ctx, 'my another message'); } }

});

var v = s.newIterator({
    properties: {
        username: { type: "string" },
        password: {
            type: "string",
            isStrong: true,
            notEqualTo: "username"
        }
    }
}, MyValidator.factory() );

console.log(v({username: "gandalf", password: "gandalf"}));
console.log(v({username: "gandalf", password: "qwerty"}));
console.log(v({username: "gandalf", password: "mellon"}));

```

Please find the description of extension syntax below.

### Unicode support

Validator does not proceed correctly `minLength`/`maxLength` checks for unicode strings by default. If you'd like to you may use your favourite unicode parser to fix that, just pass `strLength` function to the validator on creation, for example:

```javascript
var s = require('./iterator');
var GraphemeBreaker = require('grapheme-breaker');

var strOfLength3 = "12a\u0301\u0302";
var schemaForLength3 = {maxLength: 3};
var notUnicodeValidator = s.newValidator(schemaForLength3);

var unicodeValidator = s.newValidator(schemaForLength3, {
    strLength: function (str) {
        return GraphemeBreaker.countBreaks(str);
    }
});

console.log(notUnicodeValidator(strOfLength3));
// error
console.log(unicodeValidator(strOfLength3));
// no errors
```
`s.newValidator` accepts the options object as second parameter, where options are:


# Normalizer usage

Normalizer converts input json according to schema:
* adds default values for missing properties
* converts types
* removes additional properties

So it could be used to preprocess data before validation.

```javascript
var v = s.newNormalizer({
    properties: {
        name: { type: "string", required: true },
        age: {type: "number", required: true},
        race: {type: "string", enum: ["human", "elf"], default: "elf"}
    },
    additionalProperties: false
});

console.log(v({name: "Glorfindel", age: "1000", horse: "Asfaloth"}));
// { name: 'Glorfindel', age: 1000, race: 'elf' }
```

# Create own tool (on example of form generator)

It is easy enough - that is what schemasaurus was created for.

Let's create simple form generator.

### Prepare iterator

```javascript
s = require('schemasaurus');

function FormGenerator () {}
FormGenerator.prototype = {
  end: function () {
    return "ok!"
  }
}

var schema = {
  properties: {
    firstname: {type: "string", required: true},
    lastname: {type: "string", required: true},
    gender: {type: "string", required: true, enum: ["male", "female"]},
    favouriteBands: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {type: "string", required: true},
          genre: {type: "string"}
        }
      }
    }
  }
}

var gen = s.newIterator(schema, FormGenerator);
console.log(gen({}));
//ok!
```

Here we defined base iterator class with only 'done' method. It is called after the object is processed and what it returns will be returned from generated function `gen`.
Let's add some fields.

### Render string fields

```javascript
function FormGenerator () {}
FormGenerator.prototype = {
    input: function (type, options) {
        this.html += "<input type='" + type + "'";
        for (var name in options) {
            if (options.hasOwnProperty(name)) {
                this.html += " " + name + "='" + options[name] + "'";
            }
        }
        this.html += ">\n";
    },

    path: function (ctx) {
        return ctx.path[0] + ctx.path.slice(1).map(function (p) { return "[" + p + "]" }).join("");
    },

    "[type=string]": function (schema, object, ctx) {
        this.input('string', {value: object, name: this.path(ctx)});
    },

    begin: function () {
        this.html = "";
    },

    end: function () {
        return this.html;
    }
}
...

console.log(gen({firstname: "frodo", lastname: "baggins", gender: "male"}));
// <input type='string' value='frodo' name='firstname'>
// <input type='string' value='baggins' name='lastname'>
// <input type='string' value='male' name='gender'>

```

So what we see here:
* methods 'input' and 'path' are just our helper methods, schemasaurus does not call them
* method `[type=string]` is called for any field of type 'string'
* method 'begin' is called before object processing, method 'end' is called after.

Methods with keys like `[type=string]` called 'selectors'. They match schema parts according to following syntax:
* `[attr]` - is called when schema contains provided attribute
* `[^attr]` - is called when schema does not contain provided attribute
* `[attr=value]` - is called when schema contains provided attribute equal to provided value
* `[^attr=value]` - is called when schema does not contain attribute or it differs from provided value
* `[..][..]` - is called when both conditions are met
* '[a]:start' - is called _before_ `[a]`
* '[a]:end' - is called _after_ `[a]`
* '[a]:item' - is called _before_ `[a]` for array item
* '[a]:item-end' - is called _after_ `[a]` for array item

Note that for now we do not match arrays. If we run this code

```javascript
console.log(gen({firstname: "frodo", lastname: "baggins", gender: "male", favouriteBooks: [
    {name: "Lord of the Rings", genre: "Epic story"}
]}));

// <input type='string' value='frodo' name='firstname'>
// <input type='string' value='baggins' name='lastname'>
// <input type='string' value='male' name='gender'>
// <input type='string' value='Lord of the Rings' name='favouriteBooks[0][name]'>
// <input type='string' value='Epic story' name='favouriteBooks[0][genre]'>
```

Array items are processed as other fields (note `name` attribute - it contains valid path)

Let's wrap array items with fieldset

### Process array items:

```javascript
...
FormGenerator.prototype = {
    ...

    "[type=array]:start": function (schema, object, ctx) {
        this.append("<fieldset>");
    },

    "[type=array]:end": function (schema, object, ctx) {
        this.append("</fieldset>");
    },

    ":item": function (schema, object, ctx) {
        this.append("<div id='" + this.path(ctx) + "'>");
    },

    ":item-end": function (schema, object, ctx) {
        this.append("<button onclick='document.getElementById(\"" + this.path(ctx) + "\").remove();'>Delete</button>");
        this.append("</div>");
    },

  ...
```
Here we use `:start`/`:end`/`:item`/`:item-end` modifiers to wrap whole array and array items with some tags.


Note that in all cases we define function with exactly 3 arguments. Even if you don't use some of them, define all 3, as function with less arguments count is recognized
as precompiling function - it will be described later.

Now let's show select control for enumerated value (gender)

### Show select for enum

First naive implementation would be the following:

```javascript
...
    select: function (values, options) {
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

    "[enum]": function (schema, object, ctx) {
        this.select(schema.enum, object, {name: this.path(ctx)});
    },

...
```

but if you start it you'll get the duplicated gender field:
```html
<select  name='gender'>
  <option value='male' selected>male</option>
  <option value='female'>female</option>
</select>
<input type='string' value='male' name='gender'>
```

By default schemasaurus does not stop after first match and calls other selectors if they match. You may prevent executing other functions by calling `ctx.stop()`

```javascript
    "[enum]": function (schema, object, ctx) {
        this.select(schema.enum, object, {name: this.path(ctx)});
        ctx.stop();
    },
```

Run and see that everything is ok.

BTW, what if we call it without object?

### Run without object

```javascript
console.log(gen());
```
```html
<input type='string' name='firstname'>
<input type='string' name='lastname'>
<select  name='gender'>
<option value='male' >male</option>
<option value='female' >female</option>
</select>
<fieldset>
<div id='favouriteBooks[]'>
<input type='string' name='favouriteBooks[][name]'>
<input type='string' name='favouriteBooks[][genre]'>
<button onclick='document.getElementById("favouriteBooks[]").remove();'>Delete</button>
</div>
</fieldset>
```
For this case schemasaurus goes through schema even object is not defined, also it iterates array item once.


### Add `required` attribute

One of the simplest way would be to check schema directly in selector function, like this:
```javascript
    "[type=string]": function (schema, object, ctx) {
        this.input('string', {value: object, name: this.path(ctx),
          required: schema.required ? 'required' : undefined
        });
    },
```

but there is another way to do it which could allow performance boost later. First of all make `input` method print just part of tag, without closing `>`.

```javascript

    "[type=string]": function (schema, object, ctx) {
        this.input('string', {value: object, name: this.path(ctx)});
    },
    "[required]": function (schema, object, ctx) {
        this.html += " required ";
    },
    "[type=string]:end": function (schema, object, ctx) {
        this.inputEnd();
    },
```

So here on any string value schemasaurus calls first selector, then second if `required` is specified, and then third.

Now see how it helps with performance

### Performance improvement

Schemasaurus compiles schema iterator into javascript function and calls to selector functions from it. But in most cases selector functions are very simple and could be inlined
which increase performance a bit. The only restriction is that inlined functions cannot access schema, but it could be solved with precompiling functions.

To inline function you may write following:
```javascript
   "[a]": {inline: function (_, ctx) { console.log(ctx.path.join('.') + _); }},
   "[b]": {inline: "console.log(_); "}
```
where `_` is current object (name is important), and `ctx` is context. From inline functions you may call your iterator method via `this`.

To use schema somehow you need to add precompiling function:
```javascript
   "[a]": {prepare: function (schema, ctx) {
      var a = schema.a;
      return {inline: " console.log(_ + " + a + ");"};
   }},
   "[b]": function (schema, ctx) {    //2 arguments
      return ...;
   }
```

Here is the code of forms generator optimize for inline:

```javascript
FormGenerator.prototype = {
    path: function (ctx) {
        return ctx.path[0] + ctx.path.slice(1).map(function (p) { return p == "[]" ? p : "[" + p + "]" }).join("");
    },

    "[type=array]:start": {inline: 'this.html += "<fieldset>"; '},

    "[type=array]:end": {inline: 'this.html += "</fieldset>"; '},

    ":item": {inline: 'this.html += "<div id=\'" + this.path(ctx) + "\'>"'},

    ":item-end": {inline: 'this.html += "<button onclick=\'document.getElementById(\" + this.path(ctx) + \").remove();\'>Delete</button></div>"'},

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
    "[enum]:end": {inline: function (_, ctx) {
        ctx.stop();
    }},

    "[type=string]": {inline: "this.html += '<input type=string name=\"' + this.path(ctx) + '\" value= \"' + _ + '\"'"},

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
}
```

The main improvement here is the `[enum]` selector inlining - instead of iterating over constant `enum` values on each call we iterate them once
and put `<option>` tags into the code.

The benchmark shows that new version is ~ 2x times faster:

```
non-compiled x 32,120 ops/sec ±0.20% (99 runs sampled)
compiled x 62,975 ops/sec ±0.80% (99 runs sampled)
```

Please refer to `examples` folder - it contains both versions and benchmark as well

# Benchmark for validator

[See here](https://github.com/AlexeyGrishin/json-schema-benchmark)

Actually schemasaurus is third one by speed, it 4x times slower than winner [is-my-json-valid](https://github.com/mafintosh/is-my-json-valid). But speed is not the main advantage of schemasaurus.