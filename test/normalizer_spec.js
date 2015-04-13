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
    it("shall convert types", function () {
        var n = newNormalizer({
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
        expect(n({i: "10", n: ["22.2"], s: {toString: function() { return "1";}}, b: "false", a: 77, u: 33, o: -5})).to.eql({
            i: 10,
            n: 22.2,
            s: "1",
            b: false,
            a: [77],
            u: null,
            o: -5
        });

    });
});
