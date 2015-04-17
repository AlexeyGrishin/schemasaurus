"use strict";
module.exports = function interpolate(template, a, b, c, d, e, f, g) {
    var list = template.split("%%"),
        code;
    if (a !== undefined) {
        if (b === undefined) {
            return list[0] + a + list[1];
        }
        if (c === undefined) {
            return list[0] + a + list[1] + b + list[2];
        }
        if (d === undefined) {
            return list[0] + a + list[1] + b + list[2] + c + list[3];
        }
        if (e === undefined) {
            return list[0] + a + list[1] + b + list[2] + c + list[3] + d + list[4];
        }
        if (f === undefined) {
            return list[0] + a + list[1] + b + list[2] + c + list[3] + d + list[4] + e + list[5];
        }
        if (g === undefined) {
            return list[0] + a + list[1] + b + list[2] + c + list[3] + d + list[4] + e + list[5] + g + list[6];
        }
    }
    code = "return " + ["list[0]", "a", "list[1]", "b", "list[2]", "c", "list[3]", "d", "list[4]", "e", "list[5]", "f", "list[6]", "g", "list[7]"].slice(0, list.length * 2 - 1).join("+");
    return (new Function("list", "return function(a,b,c,d,e,f,g){" + code + "};"))(list);
};