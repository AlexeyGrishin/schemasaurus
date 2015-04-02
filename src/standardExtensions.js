module.exports = function(Iterator) {

    //TODO: probably need to check objectNode type here, so if it is not object - do not go deep. or it shall be ruled by options
    Iterator.meta.type("object", function (schemaNode, objectNode, c) {
        var k;
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
    Iterator.meta.attr("properties", function (schemaNode) { schemaNode.type = "object"});
    Iterator.meta.attr("additionalProperties", function (schemaNode) { schemaNode.type = "object"});

    Iterator.meta.type("array", function (schemaNode, objectNode, c) {
        if (c.schemaOnly) {
            c.report("start-item");
            c.visit(schemaNode.items || {}, null, "[]");
            c.report("end-item");
        }
        else {
            for (var i = 0; i < (objectNode ? objectNode.length : 0); i++) {
                c.report("start-item");
                c.visit(schemaNode.items || {}, objectNode[i], "[" + i + "]");
                c.report("end-item");
            }
        }
        c.report("end");
    });

    function composing(attr) {
        return function(schemaNode, objectNode, c) {
            var next = schemaNode[attr];
            for (var i = 0; i < next.length; i++) {
                for (var k in schemaNode) {
                    if (schemaNode.hasOwnProperty(k) && k != attr) {
                        next[i][k] = schemaNode[k];
                    }
                }
                c.report("start-alternative");
                c.visit(next[i], objectNode);
                c.report("end-alternative");
            }
        }
    }


    Iterator.meta.attr("anyOf", composing("anyOf"));
    Iterator.meta.attr("oneOf", composing("oneOf"));
    Iterator.meta.attr("allOf", composing("allOf"));
};