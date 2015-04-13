var expect = require('expect.js');
var Validator = require('../src/iterator').Validator;

var V2 = require('../src/v4validator_compiled');
var C2 = require('../src/compiler');

describe("validator", function() {

    var Ok = {valid: true, errors: []};
    function FailWith() {
        return {valid: false, errors: [].slice.call(arguments)};
    }

    function validate(schema, value, exp, opts) {
        var it = C2(schema, V2.factory(opts));
        var res = it(value);
        res.errors = res.errors.map(function(e) { return e.code; });
        expect({value: value, validationResult: res}).to.eql({value: value, validationResult: exp});
    }

    function schema(schema) {
        var o = undefined;
        return {
            withFormat: function(fmt) {
                o = o || {formats: {}};
                o.formats[fmt.name] = fmt;
                return this;
            },
            validate: function(value, exp) {
                validate(schema, value, exp, o);
                return this;
            }
        }
    }


    describe("for boolean type", function() {
        it("shall pass boolean values", function() {
            schema({type:"boolean"})
                .validate(true, Ok)
                .validate(false, Ok);
        });

        it("shall reject non-boolean values", function() {
            schema({type:"boolean"})
                .validate(1, FailWith("type.boolean"))
                .validate("hello", FailWith("type.boolean"))
                .validate({}, FailWith("type.boolean"))
        });
    });

    describe("for numeric types", function() {
        it("shall distinguish integer values", function() {
            schema({type: "integer"})
                .validate(1, Ok)
                .validate(1.1, FailWith("type.integer"));
        });
        it("shall pass numeric values", function() {
            schema({type: "number"})
                .validate(1, Ok)
                .validate(1.1, Ok);
        });
        it("shall reject non-numeric values", function() {
            schema({type: "integer"})
                .validate("string", FailWith("type.integer"))
                .validate(true, FailWith("type.integer"))
                .validate("1", FailWith("type.integer"));
        });
        it("shall pass multiples of", function() {
            schema({type: "integer", multipleOf: 11})
                .validate(11, Ok)
                .validate(0, Ok)
                .validate(22, Ok)
                .validate(12, FailWith("type.integer.multipleOf"))
                .validate(10, FailWith("type.integer.multipleOf"))
                .validate(1, FailWith("type.integer.multipleOf"))
        });
        it("shall check minimum", function() {
            schema({type: "number", minimum: 3})
                .validate(3, Ok)
                .validate(2, FailWith("type.number.minimum"))
                .validate(4, Ok)
        });
        it("shall check maximum", function() {
            schema({type: "number", maximum: 3})
                .validate(3, Ok)
                .validate(4, FailWith("type.number.maximum"))
                .validate(2, Ok)
        });
        it("shall check range", function() {
            schema({type: "number", minimum: 1, maximum: 2})
                .validate(0, FailWith("type.number.minimum"))
                .validate(1, Ok)
                .validate(2, Ok)
                .validate(3, FailWith("type.number.maximum"))
        })
    });
    describe("for strings", function() {
        describe("without format", function() {
            it("shall pass string values", function() {
                schema({type: "string"})
                    .validate("str", Ok)
                    .validate("", Ok)
            });
            it("shall reject non-string values", function() {
                schema({type: "string"})
                    .validate(10, FailWith("type.string"))
                    .validate(true, FailWith("type.string"))
                    .validate({}, FailWith("type.string"))
            });
            it("shall check min length", function() {
                schema({type: "string", minLength: 3})
                    .validate("123", Ok)
                    .validate("1234", Ok)
                    .validate("12", FailWith("type.string.minLength"))
            });
            it("shall check max length", function() {
                schema({maxLength: 3})
                    .validate("123", Ok)
                    .validate("12", Ok)
                    .validate("1234", FailWith("type.string.maxLength"))
            });
            it("shall check pattern", function() {
                schema({type: "string", pattern: "^[ab][12]$"})
                    .validate("a1", Ok)
                    .validate("b2", Ok)
                    .validate("c1", FailWith("type.string.pattern"))
                    .validate("a3", FailWith("type.string.pattern"))
            });
        });
        describe("with email format", function() {
            it("shall pass emails", function() {
                schema({type: "string", format: "email"})
                    .validate("a@b.com", Ok)
                    .validate("ab.com", FailWith("type.string.format.email"))
            })
        });
        describe("with custom format", function() {
            it("shall check format specified with regexp locally", function() {
                schema({type: "string", format: "pet"})
                    .withFormat({
                        name: "pet",
                        regexp: /(dog|cat|rat)/,
                        message: "shall be pet"
                    })
                    .validate("cat", Ok)
                    .validate("dog", Ok)
                    .validate("rat", Ok)
                    .validate("crow", FailWith("type.string.format.pet"))
            });
            it("shall throw error on unknown format", function() {
                var s = schema({type: "string", format: "unknown"});
                expect(s.validate.bind(s, "tst", Ok)).to.throwError();
            });
        });
    })

    //https://github.com/json-schema/JSON-Schema-Test-Suite
});