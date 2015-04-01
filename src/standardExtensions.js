module.exports = function(Iterator) {

    Iterator.meta.type("object", function (schemaNode, objectNode, c) {
        for (var k in schemaNode.properties) {
            if (schemaNode.properties.hasOwnProperty(k)) {
                c.visit(schemaNode.properties[k], objectNode ? objectNode[k] : undefined, k);
            }
        }
        c.report("end");
    });

    Iterator.meta.type("array", function (schemaNode, objectNode, c) {
        if (c.schemaOnly) {
            c.report("start-item");
            c.visit(schemaNode.items, null, "[]");
            c.report("end-item");
        }
        else {
            for (var i = 0; i < (objectNode ? objectNode.length : 0); i++) {
                c.report("start-item");
                c.visit(schemaNode.items, objectNode[i], "[" + i + "]");
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