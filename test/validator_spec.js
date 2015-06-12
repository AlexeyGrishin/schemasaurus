var expect = require('expect.js');
var s = require('../src/iterator');
var newValidator = s.newValidator;

describe("validator", function() {

    var Ok = {valid: true, errors: []};
    function FailWith() {
        return {valid: false, errors: [].slice.call(arguments)};
    }

    function validate(schema, value, exp, opts, whatToReturn) {
        opts = opts || {};
        var it = newValidator(schema, opts);
        var res = it(value);
        res.errors = res.errors.map(function(e) { return e[whatToReturn || 'code']; });
        expect({value: value, validationResult: res}).to.eql({value: value, validationResult: exp});
    }

    function schema(schema, options) {
        var o = options;
        return {
            withFormat: function(fmt) {
                o = o || {formats: {}};
                o.formats[fmt.name] = fmt;
                return this;
            },
            withCustom: function(name, cst) {
                o = o || {custom: {}};
                o.custom[name] = cst;
                return this;
            },
            validate: function(value, exp, whatToReturn) {
                validate(schema, value, exp, o, whatToReturn);
                return this;
            },
            validatePath: function(value, exp) {
                validate(schema, value, exp, o, "path");
                return this;
            },
            validateValue: function(value, exp) {
                validate(schema, value, exp, o, "value");
                return this;
            },
            validateMessage: function(value, exp) {
                validate(schema, value, exp, o, "message");
                return this;
            }
        };
    }


    describe("for boolean type", function() {
        it("shall pass boolean values", function() {
            schema({type:"boolean"})
                .validate(true, Ok)
                .validate(false, Ok);
        });

        it("shall reject non-boolean values", function() {
            schema({type:"boolean"})
                .validate(1, FailWith("boolean"))
                .validate("hello", FailWith("boolean"))
                .validate({}, FailWith("boolean"))
        });
    });

    describe("for numeric types", function() {
        it("shall distinguish integer values", function() {
            schema({type: "integer"})
                .validate(1, Ok)
                .validate(1.1, FailWith("integer"));
        });
        it("shall pass numeric values", function() {
            schema({type: "number"})
                .validate(1, Ok)
                .validate(1.1, Ok);
        });
        it("shall reject non-numeric values", function() {
            schema({type: "integer"})
                .validate("string", FailWith("integer"))
                .validate(true, FailWith("integer"))
                .validate("1", FailWith("integer"));
        });
        it("shall pass multiples of", function() {
            schema({type: "integer", multipleOf: 11})
                .validate(11, Ok)
                .validate(0, Ok)
                .validate(22, Ok)
                .validate(12, FailWith("multipleOf"))
                .validate(10, FailWith("multipleOf"))
                .validate(1, FailWith("multipleOf"))
        });
        it("shall check minimum", function() {
            schema({type: "number", minimum: 3})
                .validate(3, Ok)
                .validate(2, FailWith("minimum"))
                .validate(4, Ok)
        });
        it("shall check maximum", function() {
            schema({type: "number", maximum: 3})
                .validate(3, Ok)
                .validate(4, FailWith("maximum"))
                .validate(2, Ok)
        });
        it("shall check range", function() {
            schema({type: "number", minimum: 1, maximum: 2})
                .validate(0, FailWith("minimum"))
                .validate(1, Ok)
                .validate(2, Ok)
                .validate(3, FailWith("maximum"))
        })
    });
    describe("for required fields", function() {
        it("shall provide valid path if required provided for field", function() {
            schema({properties: {
                a: {required: true}
            }})
                .validatePath({}, FailWith(["a"]))
                .validatePath({a: undefined}, FailWith(["a"]))
                .validatePath({a: null}, Ok)//type not specified, so null is valid value
                .validatePath({a: 3}, Ok);
        });
        it("shall provide valid path if required provided for field with type", function() {
            schema({properties: {
                a: {required: true, type: "string"}
            }})
                .validatePath({a: undefined}, FailWith(["a"]))
                .validatePath({a: null}, FailWith(["a"]))
                .validatePath({a: "3"}, Ok);
        });
        it("shall provide valid path if required provided for set of fields", function(){
            schema({
                properties: {
                    a: {type: 'integer'},
                    b: {type: 'integer'}
                },
                required: ['a','b']
            })
                .validatePath({}, FailWith(["a"], ["b"]))
                .validatePath({a: 1}, FailWith(["b"]))
                .validatePath({a: 1, b:2}, Ok)
        });
        it("shall provide valid path for combined case", function() {
            schema({
                properties: {
                    a: {type: 'integer', required: false},
                    b: {type: 'integer', required: true}
                },
                required: ['a']
            })
                .validatePath({}, FailWith(["a"], ["b"]))
                .validatePath({a: 1}, FailWith(["b"]))
                .validatePath({a: 1, b:2}, Ok)
        });
        it("shall provide path for array items", function() {
            schema({
                items: {
                    required: true,
                    type: "string"
                }
            })
                .validatePath(["1", undefined], FailWith(["1"]))
                .validatePath(["1", "2", null], FailWith(["2"]))
        });
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
                    .validate(10, FailWith("string"))
                    .validate(true, FailWith("string"))
                    .validate({}, FailWith("string"))
            });
            it("shall check min length", function() {
                schema({type: "string", minLength: 3})
                    .validate("123", Ok)
                    .validate("1234", Ok)
                    .validate("12", FailWith("minLength"))
            });
            it("shall check max length", function() {
                schema({maxLength: 3})
                    .validate("123", Ok)
                    .validate("12", Ok)
                    .validate("1234", FailWith("maxLength"))
            });
            it("shall check pattern", function() {
                schema({type: "string", pattern: "^[ab][12]$"})
                    .validate("a1", Ok)
                    .validate("b2", Ok)
                    .validate("c1", FailWith("pattern"))
                    .validate("a3", FailWith("pattern"))
            });
            it("shall use user-defined length function to check max length", function () {
                function length3 () { return 3; }
                schema({maxLength: 2}, {strLength: length3})
                    .validate("12", FailWith("maxLength"))
                    .validate("123", FailWith("maxLength"))
            });
            it("shall use user-defined length function to check min length", function () {
                function length3 () { return 3; }
                schema({minLength: 4}, {strLength: length3})
                    .validate("1234", FailWith("minLength"))
                    .validate("123", FailWith("minLength"))
            });
        });
        describe("with email format", function() {
            it("shall pass emails", function() {
                schema({type: "string", format: "email"})
                    .validate("a@b.com", Ok)
                    .validate("ab.com", FailWith("format.email"))
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
                    .validate("crow", FailWith("format.pet"))
            });
            it("shall throw error on unknown format", function() {
                var s = schema({type: "string", format: "unknown"});
                expect(s.validate.bind(s, "tst", Ok)).to.throwError();
            });
        });
    })

    describe("shall provide actual information in error message", function () {
        it("for root values", function () {
            var s = schema({type: "boolean"});
            s.validatePath(10, FailWith([]))
            s.validateValue(10, FailWith(10))
        });
        it("for nested objects", function () {
            var s = schema({
                type: "object",
                properties: {
                    a: {type: "object", properties: {
                        b: {type: "object", properties: {
                            c: {type: "number"}
                        }}
                    }}
                }
            });
            s.validatePath({a:{b:{c:'fail'}}}, FailWith(['a','b','c']));
            s.validateValue({a:{b:{c:'fail'}}}, FailWith('fail'));
        });
        it("for arrays", function () {
            var s = schema({
                type: "array",
                items: {
                    type: "array",
                    items: {type: "number"}
                }
            })
            s.validatePath([[1,2],[3,"4"]], FailWith(['1','1']));
            s.validateValue([[1,2],[3,"4"]], FailWith("4"));
        });
        it("for additional items in arrays", function () {
            var s = schema({
                type: "array",
                items: [
                    {type: "number"}
                ],
                additionalItems: false
            })
            s.validatePath([1,2,3], FailWith(['1'],['2']));
            s.validateValue([1,2,3], FailWith(2, 3));
        });
        it("for additional properties in object", function () {
            var s = schema({
                type: "object",
                properties: {
                    a: {type: "number"}
                },
                additionalProperties: false
            })
            s.validatePath({a: 10, b: 20}, FailWith(["b"]));
            s.validateValue({a: 10, b: 20}, FailWith(20));
        });
        it("for nested schemas", function () {
            var s = schema({
                type: "object",
                properties: {
                    a: {
                        oneOf: [
                            {type: "object", properties: {b: {type: "string"}}}
                        ]
                    }
                }
            })    ;
            s.validatePath({a: {b: 5}}, FailWith(["a"], ["a", "b"]))
        })
        it("for nested schemas in arrays", function () {
            var s = schema({
                type: "object",
                properties: {
                    a: {
                        type: "array",
                        items: {
                            oneOf: [
                                {properties: {b: {type: "string"}}}
                            ]
                        }
                    }
                }
            });
            s.validatePath({a: [{b:'valid'}, {b: false}]}, FailWith(["a", 1], ["a", 1, "b"]))
        })
    });

    describe("custom validators & messages", function () {
        it ("shall call to custom validation method", function () {
            var s = schema({
                type: "number",
                conform: function (self) {
                    return self > 5;
                }
            });
            s.validate(6, Ok);
            s.validate(5, FailWith("custom"));
        });
        it ("shall call to custom validation method refered by name", function () {
            var s = schema({
                type: "number",
                conform: {
                    larger: [5]
                }
            }).withCustom('larger', function(value, arg) {
                return value > arg;
            });
            s.validate(6, Ok);
            s.validate(5, FailWith("custom.larger"));
        });
        it("shall return user-specified messages", function () {
            var s = schema({
                type: "number",
                minimum: 3,
                maximum: 10,
                messages: {
                    minimum: ":(",
                    maximum: ":O",
                    number: ":/"
                }
            });
            s.validateMessage(2, FailWith(":("));
            s.validateMessage(11, FailWith(":O"));
            s.validateMessage("5", FailWith(":/"));
            s.validateMessage(4, Ok);
        });
        it("shall return default messages for errors without user-specified messages", function() {
            var s = schema({
                minimum: 3,
                maximum: 10,
                messages: {
                    minimum: ":("
                }
            });
            s.validateMessage(2, FailWith(":("));
            s.validateMessage(11, FailWith("shall be <= %d"));
        });
        it("shall not mess user-specified messages from different nodes", function () {
            var s = schema({
                properties: {
                    a: {minimum: 3, messages: {minimum: ":("}},
                    b: {minimum: 3},
                    c: {minimum: 3, messages: {minimum: ":["}}
                }
            });
            s.validateMessage({a: 2, b: 2, c: 2}, FailWith(":(", "shall be >= %d", ":["));
            s.validateMessage({a: 3, b: 2, c: 2}, FailWith("shall be >= %d", ":["));
            s.validateMessage({a: 3, b: 3, c: 2}, FailWith(":["));
            s.validateMessage({a: 2, b: 3, c: 2}, FailWith(":(", ":["));
        });
        it("shall pass user-specified messages through gettext", function () {
            var s = schema({
                type: "number",
                conform: function (o) {
                    return o === -1;
                },
                messages: {
                    custom: "hello"
                }
            }, {gettext: function (s) { return "~" + s; }});
            s.validateMessage(1, FailWith("~hello"));
        });


    });
});

describe('extend validator', function () {
    var extendedValidator = s.Validator.extend({
        "[minLength]": function (s, o, c) {
            //ignore
        },
        "[fail]": function (s, o, c) {
            this.error("fail", c);
        }
    }, function () {
        this.options.messages.fail = "fail!";
    });
    var v = s.newIterator({
        properties: {
            a: {minLength: 3},
            b: {fail: true}
        }
    }, extendedValidator, {noinline: true});

    it('shall override default behavior', function () {
        var res = v({a: '', b: 1});
        res.errors = res.errors.map(function (e) { return e.message; });
        expect(res).to.eql({
            valid: false,
            errors: ["fail!"]
        })
    });
});