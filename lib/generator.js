'use strict';

var fs = require('fs');
var Mustache = require('mustache');
// var beautify = require('js-beautify').js_beautify;
// var Linter = require('tslint');
var _ = require('lodash');

var Generator = (function () {

    function Generator(swaggerfile, outputpath) {
        this._swaggerfile = swaggerfile;
        this._outputPath = outputpath;
    }

    Generator.prototype.Debug = false;

    Generator.prototype.initialize = function () {
        this.LogMessage('Reading Swagger file', this._swaggerfile);
        var swaggerfilecontent = fs.readFileSync(this._swaggerfile, 'UTF-8');

        this.LogMessage('Parsing Swagger JSON');
        this.swaggerParsed = JSON.parse(swaggerfilecontent);

        this.LogMessage('Reading Mustache templates');

        this.templates = {
            'enum': fs.readFileSync(__dirname + "/../templates/angular2-model-enum.mustache", 'utf-8'),
            'class': fs.readFileSync(__dirname + "/../templates/angular2-service.mustache", 'utf-8'),
            'model': fs.readFileSync(__dirname + "/../templates/angular2-model.mustache", 'utf-8'),
            'models_export': fs.readFileSync(__dirname + "/../templates/angular2-models-export.mustache", 'utf-8')
        };

        this.LogMessage('Creating Mustache viewModel');
        this.viewModel = this.createMustacheViewModel();

        this.initialized = true;
    }

    Generator.prototype.generateAPIClient = function () {
        if (this.initialized !== true)
            this.initialize();

        this.generateClient();
        this.generateModels();
        this.generateEnums();
        this.generateCommonModelsExportDefinition();

        this.LogMessage('API client generated successfully');
    };

    Generator.prototype.generateClient = function () {
        if (this.initialized !== true)
            this.initialize();

        // generate main API client class
        this.LogMessage('Rendering template for API');
        var result = this.renderLintAndBeautify(this.templates.class, this.viewModel, this.templates);

        var outfile = this._outputPath + "/" + "index.ts";
        this.LogMessage('Creating output file', outfile);
        fs.writeFileSync(outfile, result, 'utf-8')
    };

    Generator.prototype.generateModels = function () {
        var that = this,
            swaggerDefinitions = this.swaggerParsed.definitions,
            i;

        if (this.initialized !== true)
            this.initialize();

        var outputdir = this._outputPath + '/models';

        if (!fs.existsSync(outputdir))
            fs.mkdirSync(outputdir);

        // generate API models
        _.forEach(swaggerDefinitions, function (definition, defName) {
            var i,
                propertyArray = [],
                refs = [],
                enums = [];

            //remove funny chars
            defName = that.sanitizeModelName(defName);

            definition.name = that.camelCase(defName);

            that.LogMessage('Rendering template for model: ', definition.name);

            for (var key in definition.properties) {
                if (definition.properties.hasOwnProperty(key)) {

                    var parameter = definition.properties[key];
                    parameter.name = key;

                    // add required info to property
                    if (definition.required && definition.required.indexOf(key) > -1) {
                        parameter.required = true;
                    } else {
                        parameter.required = false;
                    }

                    // array check
                    if (parameter.type === 'array') {
                        parameter.isArray = true;
                    }

                    // ref and enum check
                    if (_.has(parameter, '$ref') || (parameter.type === 'array' && _.has(parameter.items, '$ref'))) {
                        parameter.isRef = true;
                    } else if (_.has(parameter, 'enum')) {
                        parameter.isEnum = true;
                    }

                    // Create refs for arrays, generated classes, and enums
                    if (parameter.isArray && _.has(parameter.items, '$ref')) {
                        parameter.type = that.camelCase(parameter.items["$ref"].replace("#/definitions/", ""));
                    }
                    else if (_.has(parameter, '$ref')) {
                        parameter.type = that.camelCase(parameter["$ref"].replace("#/definitions/", ""));
                    } else if (_.has(parameter, 'enum')) {
                        var enumName = that.camelCase(parameter.name);
                        enumName = that.capitalize(enumName);
                        parameter.type = definition.name + enumName;
                    }


                    // add typescript type
                    if (parameter.type === 'integer' || parameter.type === 'double') {
                        parameter.typescriptType = 'number';
                    } else if (parameter.type === 'object') {
                        parameter.typescriptType = 'Object';
                    } else if (parameter.type === 'array') {
                        parameter.typescriptType = 'Array';
                    } else if (!parameter.type || parameter.type === '') {
                        parameter.typescriptType = 'any';
                    }
                    else {
                        parameter.typescriptType = parameter.type;
                    }

                    if (parameter.isRef) {
                        refs.push(definition.properties[key]);
                    } else if (parameter.isEnum) {
                        enums.push(definition.properties[key])
                    } else {
                        propertyArray.push(definition.properties[key]);
                    }
                }
            }

            definition.propertyArray = propertyArray;
            definition.refs = refs;
            definition.refImports = _.uniqBy(refs, function (e) {
                return e.type;
            });
            definition.enums = enums;


            var result = that.renderLintAndBeautify(that.templates.model, definition, that.templates);

            var outfile = outputdir + "/" + definition.name + ".ts";

            that.LogMessage('Creating output file', outfile);
            fs.writeFileSync(outfile, result, 'utf-8')
        });
    };

    Generator.prototype.generateEnums = function () {
        var that = this,
            swaggerDefinitions = this.swaggerParsed.definitions,
            i;

        if (this.initialized !== true)
            this.initialize();

        var outputdir = this._outputPath + '/enums';

        if (!fs.existsSync(outputdir))
            fs.mkdirSync(outputdir);

        // generate API models
        _.forEach(swaggerDefinitions, function (definition, defName) {
            var i;

            //remove funny chars
            defName = that.sanitizeModelName(defName);

            definition.name = that.camelCase(defName);

            that.LogMessage('Searching for Enums in: ', definition.name);

            for (var key in definition.properties) {
                if (definition.properties.hasOwnProperty(key)) {
                    var parameter = definition.properties[key];

                    if (parameter.enum) {
                        var enumParameters = [];

                        that.LogMessage("Enum found! " + key + " ", parameter.enum);

                        var enumName = that.camelCase(key);
                        enumName = that.capitalize(enumName);
                        parameter.name = definition.name + enumName;

                        that.LogMessage("Enum Name: ", parameter.name);

                        // add required info to property
                        if (definition.required && definition.required.indexOf(key) > -1) {
                            parameter.required = true;
                        } else {
                            parameter.required = false;
                        }

                        // Get the enum values
                        for (var enumKey in parameter.enum) {
                            if (parameter.enum.hasOwnProperty(enumKey)) {
                                var workingEnumVal = {};
                                var name = parameter.enum[enumKey];
                                name = that.capitalize(name);
                                name = that.camelCase(name);

                                workingEnumVal.name = name;

                                enumParameters.push(workingEnumVal);
                            }
                        }

                        if (enumParameters.length > 0) {
                            enumParameters[enumParameters.length - 1].last = true;
                        }
                        parameter.enumParameters = enumParameters;

                        // Output enum
                        that.LogMessage('Rendering template for enum: ', parameter.name);
                        var result = that.renderLintAndBeautify(that.templates.enum, parameter, that.templates);

                        var outfile = outputdir + "/" + parameter.name + ".ts";

                        that.LogMessage('Creating output file', outfile);
                        fs.writeFileSync(outfile, result, 'utf-8')
                    }
                }


            }
        });
    };

    Generator.prototype.generateCommonModelsExportDefinition = function () {
        if (this.initialized !== true)
            this.initialize();

        var outputdir = this._outputPath;

        if (!fs.existsSync(outputdir))
            fs.mkdirSync(outputdir);

        this.LogMessage('Rendering common models export');
        var result = this.renderLintAndBeautify(this.templates.models_export, this.viewModel, this.templates);

        var outfile = outputdir + "/models.ts";

        this.LogMessage('Creating output file', outfile);
        fs.writeFileSync(outfile, result, 'utf-8')
    };

    Generator.prototype.renderLintAndBeautify = function (tempalte, model) {

        // Render *****
        var result = Mustache.render(tempalte, model);

        // Lint *****
        // var ll = new Linter("noname", rendered, {});
        // var lintResult = ll.lint();
        // lintResult.errors.forEach(function (error) {
        //     if (error.code[0] === 'E')
        //         throw new Error(error.reason + ' in ' + error.evidence + ' (' + error.code + ')');
        // });

        // Beautify *****
        // NOTE: this has been commented because of curly braces were added on newline after beaufity
        // result = beautify(result, { indent_size: 4, max_preserve_newlines: 2 });

        return result;
    }

    Generator.prototype.createMustacheViewModel = function () {
        var that = this;
        var swagger = this.swaggerParsed;
        var authorizedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        var data = {
            isNode: false,
            description: swagger.info.description,
            isSecure: swagger.securityDefinitions !== undefined,
            swagger: swagger,
            domain: (swagger.schemes && swagger.schemes.length > 0 && swagger.host && swagger.basePath) ? swagger.schemes[0] + '://' + swagger.host + swagger.basePath : '',
            methods: [],
            definitions: [],
            hasDefinitions: false,
            enums: [],
            hasEnums: false
        };

        // Simple function to camelize poorly written operationId's.
        var camelize = function (string) {
            string = string.replace(/(?:^|(\W|_)+)(\w)|(?:\W+$)/g, function (match, p1, p2) {
                return p2 ? p2.toUpperCase() : '';
            });

            return string.charAt(0).toLowerCase() + string.slice(1);
        };

        _.forEach(swagger.paths, function (api, path) {
            var globalParams = [];

            _.forEach(api, function (op, m) {
                if (m.toLowerCase() === 'parameters') {
                    globalParams = op;
                }
            });

            _.forEach(api, function (op, m) {
                if (authorizedMethods.indexOf(m.toUpperCase()) === -1) {
                    return;
                }

                // The description line is optional in the spec
                var summaryLines = [];
                if (op.description) {
                    summaryLines = op.description.split('\n');
                    summaryLines.splice(summaryLines.length - 1, 1);
                }



                var method = {
                    path: path,
                    backTickPath: path.replace(/(\{.*?\})/g, "$$$1"),
                    methodName: op['x-swagger-js-method-name'] ? op['x-swagger-js-method-name'] : (op.operationId ? camelize(op.operationId) : that.getPathToMethodName(m, path)),
                    method: m.toUpperCase(),
                    angular2httpMethod: m.toLowerCase(),
                    isGET: m.toUpperCase() === 'GET',
                    hasPayload: !_.includes(['GET', 'DELETE', 'HEAD'], m.toUpperCase()),
                    hasEmptyPayload: false,
                    summaryLines: summaryLines,
                    isSecure: swagger.security !== undefined || op.security !== undefined,
                    parameters: [],
                    hasJsonResponse: _.some(_.defaults([], swagger.produces, op.produces), function (response) { // TODO PREROBIT
                        return response.indexOf('/json') != -1;
                    })
                };

                var params = [];

                if (_.isArray(op.parameters))
                    params = op.parameters;

                params = params.concat(globalParams);

                // remove formData endpoints since there implementation is broken and we won't need them
                var i,
                    formData;

                for (i = 0; i < params.length; i += 1) {
                    if (params[i].in === 'formData') {
                        formData = true;
                        break;
                    }
                }

                if (formData === true) {
                    return;
                }

                // set hasPayload to false if no params provided
                if (params.length === 0) {
                    method.hasPayload = false;
                    // include empty payload
                    method.hasEmptyPayload = true;
                }

                _.forEach(params, function (parameter) {
                    // Ignore headers which are injected by proxies & app servers
                    // eg: https://cloud.google.com/appengine/docs/go/requests#Go_Request_headers

                    if (parameter['x-proxy-header'] && !data.isNode)
                        return;

                    if (_.has(parameter, 'schema') && _.isString(parameter.schema.$ref))
                        parameter.type = that.camelCase(that.getRefType(parameter.schema.$ref));
                    else if (_.has(parameter, 'schema') && _.isString(parameter.schema.type))
                        parameter.type = parameter.schema.type;


                    parameter.camelCaseName = that.camelCase(parameter.name);

                    if (parameter.type === 'integer' || parameter.type === 'double') {
                        parameter.typescriptType = 'number';
                        parameter.convertToString = true;
                    } else if (parameter.type === 'boolean') {
                        parameter.typescriptType = parameter.type;
                        parameter.convertToString = true;
                    } else if (parameter.type === 'object') {
                        parameter.typescriptType = 'Object';
                    } else if (parameter.type === 'array') {
                        parameter.typescriptType = 'Array';
                    } else if (!parameter.type || parameter.type === '') {
                        parameter.typescriptType = 'any';
                    } else {
                        parameter.typescriptType = parameter.type;
                    }


                    if (parameter.enum && parameter.enum.length === 1) {
                        parameter.isSingleton = true;
                        parameter.singleton = parameter.enum[0];
                    }

                    if (parameter.in === 'body')
                        parameter.isBodyParameter = true;

                    else if (parameter.in === 'path')
                        parameter.isPathParameter = true;

                    else if (parameter.in === 'query') {
                        parameter.isQueryParameter = true;
                        if (parameter['x-name-pattern'])
                            parameter.isPatternType = true;
                    }
                    else if (parameter.in === 'header')
                        parameter.isHeaderParameter = true;

                    else if (parameter.in === 'formData')
                        parameter.isFormParameter = true;

                    method.parameters.push(parameter);
                });

                if (method.parameters.length > 0)
                    method.parameters[method.parameters.length - 1].last = true;

                data.methods.push(method);
            });


        });

        _.forEach(swagger.definitions, function (defin, defVal) {
            var defName = that.camelCase(that.sanitizeModelName(defVal));

            var definition = {
                name: defName,
                properties: [],
                refs: [],
            };

            _.forEach(defin.properties, function (propin, propVal) {

                var property = {
                    name: propVal,
                    isEnum: _.has(propin, 'enum'),
                    isRef: _.has(propin, '$ref') || (propin.type === 'array' && _.has(propin.items, '$ref')),
                    isArray: propin.type === 'array',
                    type: null,
                    typescriptType: null
                };

                property.type = propin.type;

                if (property.isArray && _.has(propin.items, '$ref')) {
                    property.type = that.camelCase(propin.items["$ref"].replace("#/definitions/", ""));
                } else if (_.has(propin, '$ref')) {
                    property.type = that.camelCase(propin["$ref"].replace("#/definitions/", ""));
                } else if (property.isEnum) {
                    var enumName = that.camelCase(property.name);
                    enumName = that.capitalize(enumName);
                    property.type = definition.name + enumName;
                }

                if (property.type === 'integer' || property.type === 'double') {
                    property.typescriptType = 'number';
                } else if (property.type === 'object') {
                    property.typescriptType = 'Object';
                } else if (property.type === 'array') {
                    property.typescriptType = 'Array';
                } else if (!property.type || property.type === '') {
                    property.typescriptType = 'any';
                } else {
                    property.typescriptType = property.type;
                }


                if (property.isRef) {
                    definition.refs.push(property);
                } else if (property.isEnum) {
                    data.enums.push(property);
                    definition.properties.push(property);
                } else {
                    definition.properties.push(property);
                }
            });

            data.definitions.push(definition);
        });

        if (data.definitions.length > 0) {
            data.hasDefinitions = true;
            data.definitions[data.definitions.length - 1].last = true;
        }

        if (data.enums.length > 0) {
            data.hasEnums = true;
            data.enums[data.enums.length - 1].last = true;
        }

        return data;
    }

    Generator.prototype.getRefType = function (refString) {
        var segments = refString.split('/');
        return segments.length === 3 ? segments[2] : segments[0];
    }

    Generator.prototype.getPathToMethodName = function (m, path) {
        if (path === '/' || path === '')
            return m;

        // clean url path for requests ending with '/'
        var cleanPath = path;

        if (cleanPath.indexOf('/', cleanPath.length - 1) !== -1)
            cleanPath = cleanPath.substring(0, cleanPath.length - 1);

        var segments = cleanPath.split('/').slice(1);

        segments = _.transform(segments, function (result, segment) {
            if (segment[0] === '{' && segment[segment.length - 1] === '}')
                segment = 'by' + segment[1].toUpperCase() + segment.substring(2, segment.length - 1);

            result.push(segment);
        });

        var result = this.camelCase(segments.join('-'));

        return m.toLowerCase() + result[0].toUpperCase() + result.substring(1);
    }


    Generator.prototype.camelCase = function (text) {
        if (!text)
            return text;

        if (text.indexOf('-') === -1 && text.indexOf('.') === -1
            && text.indexOf(' ') === -1 && text.indexOf('_') === -1)
            return text;

        var tokens = [];
        text.split('-').forEach(function (token, index) {
            tokens.push(Generator.prototype.capitalize(token));
        });

        var partialres = tokens.join('');
        tokens = [];
        partialres.split('.').forEach(function (token, index) {
            tokens.push(Generator.prototype.capitalize(token));
        });

        partialres = tokens.join('');
        tokens = [];
        partialres.split(' ').forEach(function (token, index) {
            tokens.push(Generator.prototype.capitalize(token));
        });

        partialres = tokens.join('');
        tokens = [];
        partialres.split('_').forEach(function (token, index) {
            tokens.push(Generator.prototype.capitalize(token));
        });

        return tokens.join('');
    }

    Generator.prototype.capitalize = function (text) {
        if (text && null !== text && undefined != text && text.length > 0) {
            return text[0].toUpperCase() + text.substring(1);
        } else {
            return text;
        }
    }

    Generator.prototype.sanitizeModelName = function (text) {
        //remove funny chars
        text = _.replace(text, new RegExp("«", "g"), "");
        text = _.replace(text, new RegExp("»", "g"), "");

        return text;
    }

    Generator.prototype.LogMessage = function (text, param) {
        if (this.Debug)
            console.log(text, param || '');
    }

    return Generator;
})();

module.exports.Generator = Generator;
