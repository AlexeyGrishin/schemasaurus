module.exports = function(Iterator) {

    //TODO: probably need to check objectNode type here, so if it is not object - do not go deep. or it shall be ruled by options
    Iterator.meta.type("object", function (schemaNode, objectNode, c) {
        var k;
        if (schemaNode.default && (Array.isArray(schemaNode.default) || typeof schemaNode.default !== 'object')) {
            delete schemaNode.default;
        }
        for (k in schemaNode.properties) {
            if (schemaNode.properties.hasOwnProperty(k)) {
                c.visit(schemaNode.properties[k], objectNode ? objectNode[k] : undefined, k);
            }
        }
        if (objectNode && typeof schemaNode.additionalProperties === 'object') {
            for (k in objectNode) {
                if (objectNode.hasOwnProperty(k)) {
                    if (schemaNode.properties && schemaNode.properties.hasOwnProperty(k)) continue;
                    c.visit(schemaNode.additionalProperties, objectNode ? objectNode[k] : undefined, k);
                }
            }
        }
        c.report("end");
    });

    Iterator.meta.attr("properties", "object");
    Iterator.meta.attr("additionalProperties", "object");

    Iterator.meta.type("array", function (schemaNode, objectNode, c) {
        var items = schemaNode.items || {};
        var i;
        if (schemaNode.default && !Array.isArray(schemaNode.default)) {
            delete schemaNode.default;
        }

        if (Array.isArray(items)) {
            for (i = 0; i < schemaNode.items.length; i++) {
                c.report("start-item");
                c.visit(schemaNode.items[i] , objectNode ? objectNode[i] : undefined, "[" + i + "]");
                c.report("end-item");
            }
            if (typeof schemaNode.additionalItems === 'object') {
                for (i = schemaNode.items.length; i < (objectNode ? objectNode.length : 0); i++) {
                    c.report("start-item");
                    c.visit(schemaNode.additionalItems, objectNode ? objectNode[i] : undefined, "[" + i + "]");
                    c.report("end-item");
                }
            }
        }
        else if (c.schemaOnly) {
            c.report("start-item");
            c.visit(schemaNode.items || {}, null, "[]");
            c.report("end-item");
        }
        else {
            for (i = 0; i < (objectNode ? objectNode.length : 0); i++) {
                c.report("start-item");
                c.visit(schemaNode.items || {}, objectNode[i], "[" + i + "]");
                c.report("end-item");
            }
        }
        c.report("end");
    });

    Iterator.meta.attr("items", "array");
    Iterator.meta.attr("additionalItems", "array");

    Iterator.meta.attr("default", function(schemaNode, objectNode, c, nodeType) {
        var valid, val = schemaNode.default;
        switch (nodeType) {
            case 'boolean':
            case 'string':
            case 'number':
                valid = typeof val === nodeType;
                break;
            case 'null':
                valid = val === null;
                break;
            case 'integer':
                valid = typeof val === 'number' && (val%1 == 0);
                break;
        }
        if (!valid) {
            delete schemaNode.default;
        }
    });

    Iterator.meta.attr("$ref", function(schemaNode, objectNode, c) {
        var ref = schemaNode;
        while (ref.$ref) {
            ref = c.resolveRef(ref.$ref);
        }
        for (var k in ref) {
            if (ref.hasOwnProperty(k)) {
                schemaNode[k] = ref[k];
            }
        }
        delete schemaNode.$ref;
        c.visit(schemaNode, objectNode);
    });
};