"use strict";

/*

compile schema to set of commands --> code
[
  {schema: {}, object: null, prop: "firstname"},
  {schema: {}, object: null, prop: "lastname"},
  {schema: {}, object: null, prop: "medical_experience", assign: "a1"},
  {schema: {}, object: "a1", prop: "areas", assign: "a2"},
  {schema: {}, object: "a2", prop: {index: true}, attr: "item-start", assign: "a3'},
  {schema: {}, object: "a3", prop: "name"},
  {schema: {}, object: "a2", prop: {index: true}, attr: "item-start"},
  {schema: {}, object: "a2", prop: {pattern: "S_"}},
  {schema: {}, object: "a2", prop: {other: true}},
  {schema: {}, object: "a2", attr: "end"},
  {schema: {}, object: "a1", attr: "end"},


при этом на каждом шаге вызывается callback, в случае с селектором - еще и несколько их. можно запомнить вызванные коллбэки на каждом шаге, для каждого куска схемы

 */


module.exports = function (Iterator) {

    //xTODO: probably need to check objectNode type here, so if it is not object - do not go deep. or it shall be ruled by options
    Iterator.meta.type("object", function (schemaNode, objectNode, c) {
        var k, visitedProperties = {}, i, pattern, len, additionalSchema;
        if (schemaNode.default && (Array.isArray(schemaNode.default) || typeof schemaNode.default !== 'object')) {
            delete schemaNode.default;
        }

        for (k in schemaNode.properties) {
            if (schemaNode.properties.hasOwnProperty(k)) {
                c.visit(schemaNode.properties[k], objectNode ? objectNode[k] : undefined, k);
                visitedProperties[k] = true;
            }
        }

        if (objectNode && !Array.isArray(objectNode) && typeof objectNode === 'object') {
            if (!schemaNode.$$patterns && typeof schemaNode.patternProperties === 'object') {
                schemaNode.$$patterns = [];
                for (k in schemaNode.patternProperties) {
                    if (schemaNode.patternProperties.hasOwnProperty(k)) {
                        schemaNode.$$patterns.push({re: new RegExp(k), sc: schemaNode.patternProperties[k]});
                    }
                }
            }
            additionalSchema = schemaNode.additionalProperties;
            if (schemaNode.additionalProperties === false) {
                additionalSchema = {additionalAllowed: false};
            } else if (typeof schemaNode.additionalProperties !== 'object') {
                additionalSchema = {additionalAllowed: true};
            }
            len = schemaNode.$$patterns ? schemaNode.$$patterns.length : 0;
            for (k in objectNode) {
                if (objectNode.hasOwnProperty(k)) {
                    for (i = 0; i < len; i = i + 1) {
                        pattern = schemaNode.$$patterns[i];
                        if (pattern.re.test(k)) {
                            c.visit(pattern.sc, objectNode[k], k);
                            visitedProperties[k] = true;
                        }
                    }
                    if (!visitedProperties[k]) {
                        c.visit(additionalSchema, objectNode[k], k);
                    }
                }
            }

        }
        c.report("end");
    });

    Iterator.meta.attr("properties", "object");
    Iterator.meta.attr("additionalProperties", "object");
    Iterator.meta.attr("patternProperties", "object");


    Iterator.meta.type("array", function (schemaNode, objectNode, c) {
        var items = schemaNode.items || {}, i;
        if (schemaNode.default && !Array.isArray(schemaNode.default)) {
            delete schemaNode.default;
        }

        if (Array.isArray(items)) {
            for (i = 0; i < schemaNode.items.length; i = i + 1) {
                c.report("start-item");
                c.visit(schemaNode.items[i], objectNode ? objectNode[i] : undefined, i);
                c.report("end-item");
            }
            if (typeof schemaNode.additionalItems === 'object') {
                for (i = schemaNode.items.length; i < (objectNode ? objectNode.length : 0); i = i + 1) {
                    c.report("start-item");
                    c.visit(schemaNode.additionalItems, objectNode ? objectNode[i] : undefined, i);
                    c.report("end-item");
                }
            }
        } else if (c.schemaOnly) {
            c.report("start-item");
            c.visit(schemaNode.items || {}, null, "[]");
            c.report("end-item");
        } else {
            for (i = 0; i < (objectNode ? objectNode.length : 0); i = i + 1) {
                c.report("start-item");
                c.visit(schemaNode.items || {}, objectNode[i], i);
                c.report("end-item");
            }
        }
        c.report("end");
    });

    Iterator.meta.attr("items", "array");
    Iterator.meta.attr("additionalItems", "array");

    /*jslint unused: true */
    Iterator.meta.attr("default", function (schemaNode, objectNode, ctx, nodeType) {
        var valid, val = schemaNode.default;
        switch (nodeType) {
        case 'boolean':
            valid = typeof val === "boolean";
            break;
        case 'string':
            valid = typeof val === "string";
            break;
        case 'number':
            valid = typeof val === "number";    //have to copy these lines to make jslint happy
            break;
        case 'null':
            valid = val === null;
            break;
        case 'integer':
            valid = typeof val === 'number' && (val % 1 === 0);
            break;
        }
        if (!valid) {
            delete schemaNode.default;
        }
    });

    Iterator.meta.attr("$ref", function (schemaNode, objectNode, c) {
        var ref = schemaNode, k;
        while (ref.$ref) {
            ref = c.resolveRef(ref.$ref);
        }
        for (k in ref) {
            if (ref.hasOwnProperty(k)) {
                schemaNode[k] = ref[k];
            }
        }
        delete schemaNode.$ref;
        c.visit(schemaNode, objectNode);
    });
};