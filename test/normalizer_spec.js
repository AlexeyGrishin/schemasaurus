var expect = require('expect.js');
var newNormalizer = require('../src/iterator').newNormalizer;


describe('normalizer', function () {

    it("shall apply default values", function () {
        var n = newNormalizer({
            properties: {
                intProp: {default: 10},
                strProp: {default: "test"},
                arrProp: {
                    type: "array",
                    items: {
                        default: {obj: true}
                    }
                }
            }
        });
        expect(n({})).to.eql({
            intProp: 10,
            strProp: "test"
        });
        expect(n({intProp: 5, strProp: "str", arrProp: [null, "test"]})).to.eql({
            intProp: 5,
            strProp: "str",
            arrProp: [
                {obj: true},
                "test"
            ]
        });
    });
    it("shall apply default values to nested structures", function () {
        var n = newNormalizer({
            properties: {
                a: {
                    default: {},
                    properties: {
                        b: {default: 3}
                    }
                }
            }
        });
        expect(n({})).to.eql({a: {b: 3}});
    });
    it("shall remove additional items", function () {
        var n = newNormalizer({
            properties: {
                oneProp: {type: "integer"}
            }
        });
        var exp = {oneProp: 10};
        expect(n({oneProp: 10})).to.eql(exp);
        expect(n({oneProp: 10, secondProp: 5})).to.eql(exp);
    });
    var allTypesNormalizer = newNormalizer({
        properties: {
            i: {type: "integer"},
            n: {type: "number"},
            s: {type: "string"},
            b: {type: "boolean"},
            a: {type: "array"},
            u: {type: "null"},
            o: {type: "object"}
        }
    });

    it("shall convert types", function () {
        expect(allTypesNormalizer({i: "10", n: ["22.2"], s: {toString: function() { return "1";}}, b: "false", a: 77, u: 33, o: -5})).to.eql({
            i: 10,
            n: 22.2,
            s: "1",
            b: false,
            a: [77],
            u: null,
            o: -5
        });
    });
    it("shall pass correct types", function () {
        var data = {
            i: 10,
            n: 22.2,
            s: "test",
            b: true,
            a: [10],
            u: null,
            o: {test: 1}
        };
        expect(allTypesNormalizer(data)).to.eql(data);
    });
    it("shall pass undefined and null values", function () {
        var data = {i: null, n: undefined, s: null, b: undefined, a: null, u: undefined, o: null};
        expect(allTypesNormalizer(data)).to.eql(data);
    });
});
