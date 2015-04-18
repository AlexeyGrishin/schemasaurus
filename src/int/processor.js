"use strict";
var Generator = require('./gen');

function SchemaPartProcessor(vargen, codeComposer, options) {
    this.vargen = vargen;
    this.labelgen = new Generator('label');
    this.codeComposer = codeComposer;
    this.options = options;
}


SchemaPartProcessor.prototype = {

    processors: ['processItems', 'processProperties'],

    execute: function (step) {
        this.processors.forEach(function (p) {
            this[p](step);
        }.bind(this));
    },

    createVar: function () {
        return this.vargen.next();
    },

    code: function () {
        this.codeComposer.code.apply(this.codeComposer, arguments);
    }
};

SchemaPartProcessor.prototype.processItems = function (step) {
    if (!step.schema.items && !step.schema.additionalItems) {
        return;
    }
    var idxvar, newvar, k;
    if (!Array.isArray(step.schema.items)) {
        idxvar = this.createVar();
        this.codeComposer.code("for (%% = 0; %%  < (%% ? %%.length : 0); %%++) {", idxvar, idxvar, step.varName, step.varName, idxvar);
        newvar = this.createVar();
        this.codeComposer.code("%% = %%[%%]", newvar, step.varName, idxvar);
        step.next(step.schema.items, newvar, "[]", idxvar, "item");
        this.code("}");
        if (!this.options.ignoreSchemaOnly) {
            this.code("if (schemaOnly) {");
            step.next(step.schema.items, 'nil', "[]", undefined, "item");
            this.code("}");
        }
    } else {
        for (k = 0; k < step.schema.items.length; k = k + 1) {
            newvar = this.createVar();
            this.code("%% = %% ? %%[%%] : undefined", newvar, step.varName, step.varName, k);
            step.next(step.schema.items[k], newvar, k);
        }
        if (!this.options.ignoreAdditionalItems) {
            idxvar = this.createVar();
            this.code("for (%% = %%; %% < (%% ? %%.length : 0); %%++) {", idxvar, step.schema.items.length, idxvar, step.varName, step.varName, idxvar);
            newvar = this.createVar();
            this.code("%% = %%[%%]", newvar, step.varName, idxvar);
            this.processAdditional(step, "additionalItems", "additionalItem", idxvar, newvar);
            this.code("}");
        }
    }

};

SchemaPartProcessor.prototype.processProperties = function (step) {
    if (!step.schema.properties && !step.schema.additionalProperties && !step.schema.patternProperties) {
        return;
    }
    var propsVar, newvar, k;
    if (!this.options.ignoreAdditionalItems) {
        propsVar = this.createVar();
        this.code("%% = {}", propsVar);
    }
    for (k in step.schema.properties) {
        if (step.schema.properties.hasOwnProperty(k)) {
            newvar = this.createVar();
            this.code("%% = %% ? %%.%% : undefined", newvar, step.varName, step.varName, k);
            if (!this.options.ignoreAdditionalItems) {
                this.code("%%.%% = true", propsVar, k);
            }
            step.next(step.schema.properties[k], newvar, k);
        }
    }
    if (!this.options.ignoreAdditionalItems) {
        this.processAdditionalProperties(step, propsVar);
    }
};

SchemaPartProcessor.prototype.processAdditionalProperties = function (step, propsVar) {
    var idxvar, newvar, k;
    idxvar = this.createVar();
    newvar = this.createVar();
    this.code("if (typeof %% === 'object' && !Array.isArray(%%)) for (%% in %%) if (%%.hasOwnProperty(%%)) {",
        step.varName, step.varName, idxvar, step.varName, step.varName, idxvar
        );
    this.code("%% = %%[%%]", newvar, step.varName, idxvar);
    for (k in (step.schema.patternProperties || {})) {
        if (step.schema.patternProperties.hasOwnProperty(k)) {
            this.code("if (/%%/.test(%%)) {", k, idxvar);
            step.next(step.schema.patternProperties[k], newvar, k, idxvar);
            this.code("%%[%%] = true", propsVar, idxvar);
            this.code("}");
        }
    }
    this.code("if (!%%[%%]) {", propsVar, idxvar);
    this.processAdditional(step, "additionalProperties", "additionalProperty", idxvar, newvar);
    this.code("}");
    this.code("}");
};

SchemaPartProcessor.prototype.processAdditional = function (step, schemaProp, cbProp, idxvar, newvar) {
    var stubSchema = {};
    stubSchema[cbProp] = false;
    if (step.schema[schemaProp] === false) {
        step.next(stubSchema, newvar, "*", idxvar);
    } else if (typeof step.schema[schemaProp] === 'object') {
        step.next(step.schema[schemaProp], newvar, "*", idxvar);
    } else {
        stubSchema[cbProp] = "allowed";
        step.next(stubSchema, newvar, "*", idxvar);
    }
};


module.exports = SchemaPartProcessor;