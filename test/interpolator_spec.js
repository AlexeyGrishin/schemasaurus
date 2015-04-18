var expect = require('expect.js');
var interpolate = require('../src/interpolate');

function code(template) {
    return interpolate(template).apply(null, [].slice.call(arguments, 1));
}

describe('interpolator', function () {
    it("shall return exact template without arguments", function () {
        expect(code("my code is")).to.be("my code is");
    });
    it("shall return exact template with 1 argument", function () {
        expect(code("my code is %% well", "tested")).to.be("my code is tested well");
    });
    it("shall return exact template with several arguments", function () {
        expect(code("my %% code %% is %% well", "favorite", "now", "tested")).to.be("my favorite code now is tested well");
    });

})