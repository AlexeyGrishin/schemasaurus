var fs = require('fs');
var expect = require('expect.js');
var Validator = require('../src/iterator').Validator;
var path = require('path');

var ignored = require('./ignored.json');

function loadSuite(dir) {

    var tests = [];

    fs.readdirSync(dir).forEach(function (f) {
        var fpath = path.join(dir, f);
        if (!fs.statSync(fpath).isFile()) return;
        var t = require(fpath);
        t.forEach(function(s) {s.file = f;});
        tests = tests.concat(t);
    });
    return tests;
}

var suite = loadSuite(path.join(__dirname, 'json-schema-test-suit', 'tests', 'draft4')).concat(
    loadSuite(path.join(__dirname, 'json-schema-test-suit', 'tests', 'draft4', 'optional'))
);

function isIgnored(str) {
    return ignored.some(function(i) { return str.indexOf(i) != -1});
}

describe("Official json schema tests suite", function() {
    suite.forEach(function(s) {
        describe(s.description + " [" + s.file + "]", function() {
            if (isIgnored(s.description)) return console.warn("  [IGNORED] " + s.description + ": *");
            s.tests.forEach(function(t) {
                if (isIgnored(t.description)) return console.warn("  [IGNORED] " + s.description + ": " + t.description);
                it(t.description, function() {
                    var r = Validator().schema(s.schema)(t.data);
                    expect(r).to.eql(t.valid ? {valid: t.valid, errors: []} : {valid: t.valid, errors: r.errors});
                })
            });
        });
    });
});

