var expect = require('expect.js');
var Iterator = require('../src/iterator').Iterator;

function t(s) {
    return function() { return s;}
}

function OBJECT(name, o) {
    Object.defineProperty(o, "toString", {value: t(name), enumerable: false});
    return o;
}
function SCHEMA(s) { return s;}

describe("default iterator", function() {

    var visited = [];
    function visit(schema, object, ctx) {
        if (!schema) return;
        var o = {};
        o[ctx.path().join(".") + (ctx.attribute ? ":" + ctx.attribute : "")] = object ? object.toString() : null;
        visited.push(o);
    }

    function iterate(schema, object) {
        Iterator(visit).schema(schema)(object);
        return visited;
    }

    beforeEach(function() {
        visited = [];
    });

    it("shall visit primitive types", function() {
        expect(iterate(
            SCHEMA({type: "string"}),
            "test"
        )).to.eql([{"": "test"}])
    });

    it('shall visit object properties', function() {
        expect(iterate(
            SCHEMA({
                type: "object",
                properties: {
                    "name": {type: "string"}
                }
            }),
            OBJECT("obj", {name: "ok"})
        )).to.eql([
            {"": "obj"},
            {"name": "ok"},
            {":end": "obj"}
        ])
    });

    it("shall visit unknown properties if additionalProperties is not defined", function() {
        expect(iterate(
            SCHEMA({
                type: "object",
                properties: {}
            }),
            OBJECT("obj", {test: 1})
        )).to.eql([
                {"": "obj"},
                {"test": '1'},
                {":end": "obj"}
            ])
    });

    it("shall visit unknown properties if additionalProperties is an object", function() {
        expect(iterate(
            SCHEMA({
                type: "object",
                properties: {},
                additionalProperties: {type: "integer"}
            }),
            OBJECT("obj", {test: 1})
        )).to.eql([
                {"": "obj"},
                {"test": 1},
                {":end": "obj"}
            ])
    });

    it("shall visit nested object properties", function() {
        expect(iterate(
            SCHEMA({
            type: "object",
            properties: {
                "profile": {
                    type: "object",
                    properties: {
                        name: {type: "string"}
                    }
                }
            }}),
            OBJECT("outer", {profile: OBJECT("inner", {name:"nested"})})
        )).to.eql([
            {"": "outer"},
            {"profile": "inner"},
            {"profile.name": "nested"},
            {"profile:end": "inner"},
            {":end": "outer"}
        ])
    });

    it("shall visit array elements", function() {
        expect(iterate(
            SCHEMA({
                type: "array",
                items: {
                    "type": "string"
                }
            }),
            OBJECT("list", ["1","2"])
        )).to.eql([
                {"": "list"},
                {":start-item": "list"},
                {"0": "1"},
                {":end-item": "list"},
                {":start-item": "list"},
                {"1": "2"},
                {":end-item": "list"},
                {":end": "list"}
            ])
    });

    it("shall visit tuple items", function() {
        expect(iterate(
            SCHEMA({
                type: "array",
                items: [
                    {type: "number"},
                    {type: "string"},
                    {type: "string"}
                ]
            }),
            OBJECT("list", [10, "mice"])
        )).to.eql([
                {"": "list"},
                {":start-item": "list"},
                {"0": 10},
                {":end-item": "list"},
                {":start-item": "list"},
                {"1": "mice"},
                {":end-item": "list"},
                {":start-item": "list"},
                {"2": null},
                {":end-item": "list"},
                {":end": "list"}
            ])
    })

    it("shall not visit empty array", function() {
        expect(iterate(
            SCHEMA({
                type: "array",
                items: {
                    "type": "string"
                }
            }),
            OBJECT("list", [])
        )).to.eql([
                {"": "list"},
                {":end": "list"}
            ])
    });
    it("shall not visit null array", function() {
        expect(iterate(
            SCHEMA({
                type: "object",
                properties: {
                    list: {
                        type: "array",
                        items: {type: "string"}
                    }
                }
            }),
            OBJECT("root", {list: null})
        )).to.eql([
                {"": "root"},
                {"list": null},
                {"list:end": null},
                {":end": "root"}
            ])
    });

    describe("if no object provided", function() {
        function iterateNoObject(schema) {
            return iterate(schema, undefined);
        }
        it("shall visit primitive types", function() {
            expect(iterateNoObject(
                SCHEMA({type: "integer"})
            )).to.eql([
                    {"": null}
                ])
        });
        it("shall visit object properties", function() {
            expect(iterateNoObject(SCHEMA({
                type: "object",
                properties: {
                    name: {type: "string"}
                }
            }))).to.eql([
                    {"": null},
                    {"name": null},
                    {":end": null}
                ])
        });
        it("shall visit array element once", function() {
            expect(iterateNoObject(
                SCHEMA({
                    type: "array",
                    items: {
                        "type": "string"
                    }
                })
            )).to.eql([
                    {"": null},
                    {":start-item": null},
                    {"[]": null},
                    {":end-item": null},
                    {":end": null}
                ])
        });
    });

    describe("visitor", function() {
        it("shall be able to get parent schema/object", function() {
            var parents = {};
            Iterator(function(schema, obj, ctx) {
                if (!schema) return;
                parents[schema.$$id] = ctx.parent().schema ? ctx.parent().schema.$$id : null;
            }).schema({
                type: "object",
                $$id: "root",
                properties: {
                    name: {
                        type: "string",
                        $$id: "child"
                    }
                }
            })();
            expect(parents).to.eql({
                "child": "root",
                "root": null
            })
        });
    });


    function firstLevelOnly(o) {
        var fl = {};
        for (var k in o) {
            if (o.hasOwnProperty(k)) {
                fl[k] = typeof o[k] != 'object' ? o[k] : true;
            }
        }
        return fl;
    }

    function visitAlt(schema, object, ctx) {
        if (!schema) return;
        var o = {};
        o[ctx.path().join(".") + (ctx.attribute ? ":" + ctx.attribute : "")] = firstLevelOnly(schema);
        visited.push(o);
        ctx.visit(schema.oneOf, object);
        ctx.visit(schema.allOf, object);
        ctx.visit(schema.anyOf, object);
    }

    function iterateAlt(schema) {
        new Iterator(visitAlt)(schema);
        return visited;
    }


    describe("combining attributes", function() {

        it("shall iterate all alternatives", function() {
            expect(iterateAlt(SCHEMA({
                properties: {
                    myProp: {
                        oneOf: [
                            {type: "string"},
                            {type: "object", properties: {one: {type: "number"}}}
                        ]
                    }
                }
            }))).to.eql([
                    {"": {properties: true}},
                    {"myProp": {oneOf: true}},
                    {"myProp": {type: "string"}},
                    {"myProp": {type: "object", properties: true}},
                    {"myProp.one": {type: "number"}},
                    {"myProp:end": {type: "object", properties: true}},
                    {":end": {properties: true}}
                ])
        });

    });



});