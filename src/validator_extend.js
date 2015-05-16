"use strict";
module.exports = function addExtender(ValidatorClass) {

    ValidatorClass.extend = function (override, ctor) {
        function NewValidator(options) {
            ValidatorClass.call(this, options);
            if (ctor) {
                ctor.call(this, options);
            }
        }

        NewValidator.prototype = new ValidatorClass();
        NewValidator.prototype.constructor = NewValidator;
        var k;
        for (k in override) {
            if (override.hasOwnProperty(k)) {
                NewValidator.prototype[k] = override[k];
            }
        }
        NewValidator.factory = function (options) {
            return function () {
                return new NewValidator(options);
            };
        };

        return NewValidator;
    };

};