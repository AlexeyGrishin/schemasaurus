"use strict";

var compiled = {};

function interpolate(template) {
    if (compiled[template]) {
        return compiled[template];
    }
    var list = template.split("%%"),
        code = "return " + ["list[0]", "a", "list[1]", "b", "list[2]", "c", "list[3]", "d", "list[4]", "e", "list[5]", "f", "list[6]", "g", "list[7]"].slice(0, list.length * 2 - 1).join("+"),
        fn = (new Function("list", "return function(a,b,c,d,e,f,g){" + code + "};"))(list);
    compiled[template] = fn;
    return fn;
}
module.exports =  interpolate;
