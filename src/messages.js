"use strict";

module.exports = function messages(gettext) {
    return {
        "string": gettext("shall be a string"),
        "null": gettext("shall be null"),
        "minLength": gettext("shall have length at least %d"),
        "maxLength": gettext("shall have length no more than %d"),
        "pattern": gettext("shall match pattern %s"),
        "integer": gettext("shall be an integer"),
        "multipleOf": gettext("shall be multiple of %d"),
        "number": gettext("shall be a number"),
        "minimum": gettext("shall be >= %d"),
        "minimum.exclusive": gettext("shall be > %d"),
        "maximum": gettext("shall be <= %d"),
        "maximum.exclusive": gettext("shall be < %d"),
        "boolean": gettext("shall be boolean"),
        "object": gettext("shall be object"),
        "additionalProperties": gettext("shall not have additional properties"),
        "minProperties": gettext("shall have at least %d properties"),
        "maxProperties": gettext("shall have no more than %d properties"),
        "array": gettext("shall be array"),
        "additionalItems": gettext("shall not have additional items"),
        "minItems": gettext("shall have at least %d items"),
        "maxItems": gettext("shall have no more %d items"),
        "uniqueItems": gettext("shall have unique items"),
        "enum": gettext("shall be one of values %s"),
        "required": gettext("is required"),
        "dependency": gettext("does not meet additional requirements for %s"),
        "not": gettext("does not meet 'not' requirement"),
        "oneOf": gettext("does not meet exactly one requirement"),
        "oneOf.zero": gettext("does not meet any requirement"),
        "allOf": gettext("does not meet all requirements"),
        "anyOf": gettext("does not meet any requirement"),
        "custom": gettext("is not valid")
    };
};
