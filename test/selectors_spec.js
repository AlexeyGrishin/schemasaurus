var expect = require('expect.js');
var Iterator = require('../src/iterator');
require('../src/standardExtensions.js')(Iterator);
var selector = require('../src/selector');

function returnTrue() { return true; }
function countCalls(callNext) {
    var i = 0;
    return function(s,o,c,n) {
        ++i;
        if (callNext) n();
        return i;
    }
}

function countCallsAndNext() { return countCalls(true); }

describe("selector", function() {

    function iterateAndSaveNodes(schema, selectors) {
        var it = new Iterator(schema, selector);
        var expSelectors = {};
        var result = {};
        for (var k in selectors) {
            (function(k) {
                expSelectors[k] = function (s, o, c, n) {
                    result[k] = selectors[k](s, o, c, n);
                };
            })(k);
        }
        expSelectors.done = function() {
            return result;
        };
        return it.iterate(expSelectors);
    }

   it("shall detect nodes with specified attribute", function() {
       expect(iterateAndSaveNodes({
           node1: {a: 1},
           node2: {b: 1}
       }, {
           "[a]": countCalls()
       })).to.eql({
               "[a]": 1
           });
   });
    it("shall detect nodes with specified several attributes", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1},
            node2: {a:1, b: 1},
            node3: {a:1, b: 1, c: 1}
        }, {
            "[a][b]": countCalls()
        })).to.eql({
                "[a][b]": 2
            });
    });
    it("shall detect nodes with specific attribute values", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1},
            node2: {a: "test"},
            node3: {a: true},
            node4: {a: false}
        }, {
            "[a=1]": countCalls(),
            "[a=test]": countCalls(),
            "[a=true]": countCalls(),
            "[a=false]": countCalls()
        })).to.eql({
                "[a=1]": 1,
                "[a=test]": 1,
                "[a=true]": 1,
                "[a=false]": 1
            });
    });
    it("shall detect nodes without specified attribute", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1, b: 1},
            node2: {a: 1}
        }, {
            "[a][^b]": countCalls()
        })).to.eql({
                "[a][^b]": 1
            })
    });
    it("shall detect nodes without specific attribute value", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1},
            node2: {a: 2},
            node3: {a: 3}
        }, {
            "[a][^a=2]": countCalls()
        })).to.eql({
                "[a][^a=2]": 2
            })
    });
    it("shall detect attributes", function() {
        expect(iterateAndSaveNodes({
            node1: {
                type: "array",
                items: {
                    "mynode": 1
                }
            }
        }, {
            "[type=array]": countCalls(),
            "[type=array]:end": countCalls()
        })).to.eql({
                "[type=array]": 1,
                "[type=array]:end": 1
            });
    });
    it("shall stop on first matched selector", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1}
        }, {
            "[a]": countCalls(),
            "[a][a]": countCalls()
        })).to.eql({
                "[a]": 1
            })
    });
    it("shall use next selector if next() called", function() {
        expect(iterateAndSaveNodes({
            node1: {a: 1}
        }, {
            "[a]": countCallsAndNext(),
            "[a][a]": countCalls()
        })).to.eql({
                "[a]": 1,
                "[a][a]": 1
            })
    });

    it("shall call selector factory if function provided instead of object", function() {
        var it = new Iterator({node1: {a: 1}}, selector);
        var called = false;
        it.iterate(function() {
            return {"[a]": function() { called = true;}}
        });
        expect(called).to.be.ok();
    });
    it("shall throw error if selector is invalid", function() {
        function trySelector(sel) { return function() {
            o = {};
            o[sel] = function() {};
            return selector(o);
        }}
        expect(trySelector("[a")).to.throwError();
        expect(trySelector("a]")).to.throwError();
        expect(trySelector("")).to.throwError();
        expect(trySelector(":a[")).to.throwError();
    })
});
