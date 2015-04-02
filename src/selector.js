
var attrRe = /(\[(\^?\w+)(=\w+)?\])/g;
var modRe = /:(\w+)$/;

function selectorToCondition(selector) {
    function genAttrCond(attr, value) {
        if (attr[0] == '^') {
            return "!(" + genAttrCond(attr.substring(1), value) + ")";
        }
        return value !== null ? ("schema." + attr + " === " + JSON.stringify(value)) : "typeof schema." + attr + " !== 'undefined'";
    }
    function genModifierCond(mod) {
        return mod ? ("ctx.attribute === " + JSON.stringify(mod)) : "typeof ctx.attribute === 'undefined'";
    }
    function parseValue(valAsStr) {
        if (valAsStr == null) return null;
        var val = parseFloat(valAsStr);
        if (!isNaN(val)) return val;
        if (valAsStr === "true") return true;
        if (valAsStr === "false") return false;
        return valAsStr;
    }

    var conds = [];
    var m;
    while (m = attrRe.exec(selector)) {
        conds.push(genAttrCond(m[2], parseValue(m[3] ? m[3].substring(1) /* remove = from beginning */ : null)));
    }
    m = modRe.exec(selector);
    if (conds.length == 0 && !m) throw new Error("Cannot parse selector `" + selector + "`");
    conds.push(genModifierCond(m ? m[1] : null));


    return "(" + conds.join(" && ") + ")";
}

//[attr=value]*:modifier : function(schema, object, ctx, next)
function selectorsToCallback(selectors) {
    if (typeof selectors === 'function') {
        selectors = selectors();
    }

    var singleCond = "if (#1) { stop = true; this.fn[#2](schema, object, ctx, next); if (stop) return; };";
    var head = "if (schema == null) {return this.fn.done ? this.fn.done() : null}; var stop; function next() { stop = false; };";

    var code = [head];
    for (var s in selectors) {
        if (selectors.hasOwnProperty(s) && s !== 'done') {
            var cond = selectorToCondition(s);
            code.push(singleCond.replace("#1", cond).replace("#2", "'" + s + "'"));
        }
    }
    var func = Function("schema", "object", "ctx", code.join("\n"));
    func.fn = selectors;
    return func.bind(func);
}

module.exports = selectorsToCallback;