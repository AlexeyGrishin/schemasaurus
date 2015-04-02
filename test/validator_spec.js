var expect = require('expect.js');
var Iterator = require('../src/iterator_base');
require('../src/standardExtensions.js')(Iterator);
var Selector = require('../src/selector');
var Validator = require('../src/v4validator');

describe("validator", function() {

    var Ok = {valid: true, errors: []};
    function FailWith() {
        return {valid: false, errors: [].slice.call(arguments)};
    }

    function validate(schema, value, exp) {
        var it = new Iterator(schema, Selector);
        var res = it.iterate(value, Validator);
        res.errors = res.errors.map(function(e) { return e.code; });
        expect({value: value, validationResult: res}).to.eql({value: value, validationResult: exp});
    }

    function schema(schema) {
        return {
            validate: function(value, exp) {
                validate(schema, value, exp);
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
                schema({type: "string", maxLength: 3})
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
            Validator.meta.addFormat({
                name: "pet",
                regexp: /(dog|cat|rat)/,
                message: "shall be pet"
            });
            Validator.meta.addFormat({
                name: "strength",
                test: function(v) { return v !== 'qwerty';},
                message: "shall be stronger"
            });

            it("shall check format specified with regexp", function() {
                schema({type: "string", format: "pet"})
                    .validate("cat", Ok)
                    .validate("dog", Ok)
                    .validate("rat", Ok)
                    .validate("crow", FailWith("type.string.format.pet"))
            });
            it("shall check format specified by function", function() {
                schema({type: "string", format: "strength"})
                    .validate("qwerty", FailWith("type.string.format.strength"))
                    .validate("!K&$F", Ok)
            });
            it("shall throw error on unknown format", function() {
                var s = schema({type: "string", format: "unknown"});
                expect(s.validate.bind(s, "tst", Ok)).to.throwError();
            });
        });
    })

});