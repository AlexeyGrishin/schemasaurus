"use strict";
var expect = require('expect.js');
var compile = require('../src/iterator').compile;

function factory(val) {
    return function () {
        return val;
    };
}

describe("iterator", function () {
    it("shall distinguish different properties", function () {
        var selector = factory({
            "[a]": function() { this.called = "a";},
            "[b]": function() { this.called = "b";},
            end: function() { return this.called; }
        });
        expect(compile({a: 10}, selector)()).to.eql("a");
        expect(compile({b: 10}, selector)()).to.eql("b");
    });

    it("shall distinguish different property values", function () {
        var selector = factory({
            "[a=1]": function () { this.called = "1"; },
            "[a=2]": function () { this.called = "2"; },
            end: function() { return this.called; }
        });
        expect(compile({a: 1}, selector)()).to.eql("1");
        expect(compile({a: 2}, selector)()).to.eql("2");
    });
    it("shall catch property with dash in value or name", function () {
        var selector = factory({
            "[a=o-1]": function () { this.called = 1; },
            "[a-1=1]": function () { this.called = 2; },
            end: function () { return this.called; }
        });
        expect(compile({a: "o-1"}, selector)()).to.eql(1);
        expect(compile({"a-1": 1}, selector)()).to.eql(2);
    });

    it("shall process property on any level", function () {
        var selector = factory({
            called: 0,
            "[some]": function () { this.called++; },
            end: function() { return this.called; }
        });
        expect(compile({
            some: 10,
            properties: {
                some: {
                    items: [
                        {some: 30},
                        {some: 40}
                    ]
                }
            }
        }, selector)()).to.eql(3);
    });

    it("shall detect object start/end", function () {
        var selector = factory({
            called: [],
            ":start": function () { this.called.push(":start"); },
            ":end": function () { this.called.push(":end"); },
            "[type=object]": function () { this.called.push("object"); },
            end: function () { return this.called; }
        });
        expect(compile({type: "object", properties: {}}, selector)({})).to.eql([
            ":start", "object", ":end"
        ]);
    });

    it("shall detect array start/end", function () {
        var selector = factory({
            called: [],
            ":start": function () { this.called.push(":start"); },
            ":end": function () { this.called.push(":end"); },
            "[type=array]": function () { this.called.push("array"); },
            end: function () { return this.called; }
        });
        expect(compile({type: "array", items: {}}, selector)([])).to.eql([
            ":start", "array", ":end"
        ]);
    });

    it("shall detect array item start/end", function () {
        var selector = factory({
            called: [],
            "[type=array]:start": function () { this.called.push(":start"); },
            "[type=array]:end": function () { this.called.push(":end"); },
            ":item": function () { this.called.push(":item"); },
            ":item-end": function () { this.called.push(":item-end"); },
            "[type=string]": function (s, o, c) { this.called.push("item " + o); },
            end: function () { return this.called; }
        });
        expect(compile({type: "array", items: {type: "string"}}, selector)(["a", "b"])).to.eql([
            ":start", ":item", "item a", ":item-end", ":item", "item b", ":item-end", ":end"
        ]);
    });

    it("shall react on property absence", function () {
        var selector = factory({
            "[^a]": function () { this.called = "!a"; },
            end: function () { return this.called; }
        });
        expect(compile({b: 10}, selector)()).to.eql("!a");
        delete selector().called;
        expect(compile({a: 10}, selector)()).to.eql(undefined);
    });
    it("shall react on property non-equality", function () {
        var selector = factory({
            "[^a=3]": function () { this.called = "!a"; },
            end: function () { return this.called; }
        });
        expect(compile({a: 4}, selector)()).to.eql("!a");
        delete selector().called;
        expect(compile({a: 3}, selector)()).to.eql(undefined);
    });

    it("shall stop processing if stop called", function () {
        var selector = factory({
            "[a]": function (s, o, c) { this.called = "a"; c.stop(); },
            "[b]": function (s, o, c) { this.called = "b"; },
            end: function () { return this.called; }
        });
        expect(compile({a: 1, b: 2}, selector)()).to.eql("a");
    });

    it("shall provide correct path for objects", function () {
        var selector = factory({
            "[a]": function (s, o, c) { this.called = c.path.slice(); },
            end: function () { return this.called; }
        });
        expect(compile({properties: {
            p1: {properties: {
                p2: {type: 'string', a: true}
            }}
        }}, selector)()).to.eql(["p1", "p2"]);
    });

    it("shall provide correct path for arrays", function () {
        var selector = factory({
            "[a]": function (s, o, c) { this.called = c.path.slice(); },
            end: function () { return this.called; }
        });
        expect(compile({properties: {
            p1: {
                items: {type: 'string', a: true}
            }
        }}, selector)()).to.eql(["p1", "[]"]);
    });

    describe("pre-compiling", function () {

        it ("shall provide correct schema-level path", function () {
            var selector = factory({
                "[a]": function (s, c) {
                    this.path = c.path.slice();
                    return null;
                },
                clone: function () { return this; },
                end: function () { return this.path; }
            });
            expect(compile({properties: {q: {properties: {w: {items: {a: 10}}}}}}, selector)()).to.eql(["q", "w", "[]"]);
        });
    });

});