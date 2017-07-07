'use strict';

var fs = require('fs');
var Mustache = require('mustache');
var YAML = require('js-yaml');
//var beautify = require('js-beautify').js_beautify;
//var Linter = require('tslint');
var _ = require('lodash');

var Generator = (function () {

    function Generator(swaggerfile, outputpath, className, generate, modelInterfaces, fileName, modelPath, createModelPath, createModelExportFile) {
        this._className = className;
        this._swaggerfile = swaggerfile;
        this._outputPath = outputpath;
        this._generate = generate;
        this._modelInterfaces = modelInterfaces;
        this._fileName = fileName;
        this._modelPath = modelPath;
        this._createModelPath = createModelPath;
        this._createModelExportFile = createModelExportFile;
    }

    Generator.prototype.Debug = false;

    Generator.prototype.initialize = function () {
        this.LogMessage('Reading Swagger file', this._swaggerfile);
        var swaggerfilecontent = fs.readFileSync(this._swaggerfile, 'UTF-8');

        try {
            this.LogMessage('Parsing Swagger JSON');
            this.swaggerParsed = JSON.parse(swaggerfilecontent);
        }
        catch (ex) {
            try {
                this.LogMessage('File not valid JSON - trying to parse YAML');
                this.LogMessage('Parsing Swagger YAML');                
                this.swaggerParsed = JSON.parse(JSON.stringify(YAML.safeLoad(swaggerfilecontent)));
            }
            catch (iex) {
                throw iex;
            }
        }

        this.LogMessage('Reading Mustache templates');

        this.templates = {
            'interface': fs.readFileSync(__dirname + "/../templates/angular2-service.interface.mustache", 'utf-8'),
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

        for (var i = 0; i < this._generate.length; i++) {
            var param = this._generate[i];
            this.LogMessage("Generate file: " + param);

            if (param == 'F') {
                this.LogMessage("Generating full package.");                        
                this.generateInterface();
                this.generateClient();
                this.generateModels();
                if (this._createModelExportFile)
                    this.generateCommonModelsExportDefinition();
            }
            else if (param == 'M') {
                this.generateModels();
                if (this._createModelExportFile)
                    this.generateCommonModelsExportDefinition();
            }
            else if (param == 'I') {
                this.generateInterface();
            }
            else if (param == 'C') {
                this.generateClient();
            }
        }
        
        this.LogMessage('API client generated successfully');
    };

    Generator.prototype.generateInterface = function () {
        if (this.initialized !== true)
            this.initialize();

        // generate main API client interface
        this.LogMessage('Rendering interface template for API');
        var result = this.renderLintAndBeautify(this.templates.interface, this.viewModel, this.templates);

        var outfile = this._outputPath + "/" + this._fileName + ".interface.ts";
        this.LogMessage('Creating output file for interface', outfile);
        fs.writeFileSync(outfile, result, 'utf-8')
    };

    Generator.prototype.generateClient = function () {
        if (this.initialized !== true)
            this.initialize();

        // generate main API client class
        this.LogMessage('Rendering template for API');
        var result = this.renderLintAndBeautify(this.templates.class, this.viewModel, this.templates);

        var outfile = this._outputPath + "/" + this._fileName + ".ts";
        this.LogMessage('Creating output file', outfile);
        fs.writeFileSync(outfile, result, 'utf-8')
    };

    Generator.prototype.generateModels = function () {
        var that = this;

        if (this.initialized !== true)
            this.initialize();
        
        var outputdir = "";
        if (this._createModelPath)
            outputdir = this._outputPath + '/models';
        else
            outputdir = this._outputPath;

        if (!fs.existsSync(outputdir))
            fs.mkdirSync(outputdir);

        // generate API models
        _.forEach(this.viewModel.definitions, function (definition, defName) {
            that.LogMessage('Rendering template for model: ', definition.name);
            var result = that.renderLintAndBeautify(that.templates.model, definition, that.templates);

            var outfile = outputdir + "/" + definition.name + ".ts";

            that.LogMessage('Creating output file', outfile);
            fs.writeFileSync(outfile, result, 'utf-8')
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
        //result = beautify(result, { indent_size: 4, max_preserve_newlines: 2 });

        return result;
    }

    Generator.prototype.createMustacheViewModel = function () {
        var that = this;
        var swagger = this.swaggerParsed;
        var authorizedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        var data = {
            className: this._className,
            interfaceName: "I" + this._className,
            isNode: false,
            description: (swagger.info && swagger.info.description) ? swagger.info.description : '',
            isSecure: swagger.securityDefinitions !== undefined,
            swagger: swagger,
            domain: (swagger.schemes && swagger.schemes.length > 0 && swagger.host) ? swagger.schemes[0] + '://' + swagger.host + (swagger.basePath || '') : '',
            methods: [],
            definitions: [],
            modelPath: this._modelPath,
            createModelPath: this._createModelPath
        };

        _.forEach(swagger.paths, function (api, path) {
            var globalParams = [];

            _.forEach(api, function (op, m) {
                if (m.toLowerCase() === 'parameters') {
                    globalParams = op;
                }
            });

            _.forEach(api, function (op, m) {
                if (authorizedMethods.indexOf(m.toUpperCase()) === -1){
                    return;
                }

                var summary = op.summary || '';

                // The description line is optional in the spec
                var summaryLines = [];
                if (op.description) {
                    summaryLines = op.description.split('\n');
                    summaryLines.splice(summaryLines.length-1, 1);
                }



                var method = {
                    path: path,
                    backTickPath: path.replace(/(\{.*?\})/g, "$$$1"),
                    methodName: op['x-swagger-js-method-name'] ? op['x-swagger-js-method-name'] : (op.operationId ? op.operationId : that.getPathToMethodName(m, path)),
                    method: m.toUpperCase(),
                    angular2httpMethod: m.toLowerCase(),
                    isGET: m.toUpperCase() === 'GET',
                    hasPayload: !_.includes(['GET','DELETE','HEAD'], m.toUpperCase()),
                    summary: summary,
                    summaryLines: summaryLines,
                    isSecure: swagger.security !== undefined || op.security !== undefined,
                    parameters: [],
                    hasJsonResponse: _.some(_.defaults([], swagger.produces, op.produces), function (response) { // TODO PREROBIT
                        return response.indexOf('/json') != -1;
                    })
                };

                if(op.responses && op.responses['200'] && op.responses['200'].schema){
                  var schema = op.responses['200'].schema;

                  if(schema.type) {
                    if(schema.type === 'array'){
                      // Do something here
                      //method.returns += '[]';
                      if(schema.items && schema.items['$ref']){
                        var refType = schema.items['$ref'];
                        method.returns = refType.substring(refType.lastIndexOf('/')+1) + '[]';
                      }
                    } else {
                      method.returns = schema.type;
                    }
                  } else if(schema['$ref']){
                      var refType = schema['$ref'];
                      method.returns = refType.substring(refType.lastIndexOf('/')+1);
                  }
                }

                var params = [];

                if (_.isArray(op.parameters))
                    params = op.parameters;

                params = params.concat(globalParams);

                _.forEach(params, function (parameter) {
                    // Ignore headers which are injected by proxies & app servers
                    // eg: https://cloud.google.com/appengine/docs/go/requests#Go_Request_headers

                    if (parameter['x-proxy-header'] && !data.isNode)
                        return;

                    if (_.has(parameter, 'schema') && _.isString(parameter.schema.$ref))
                        parameter.type = that.camelCase(that.getRefType(parameter.schema.$ref));

                    parameter.camelCaseName = that.camelCase(parameter.name);

                    if (parameter.type === 'integer' || parameter.type === 'double')
                        parameter.typescriptType = 'number';
                    else
                        parameter.typescriptType = parameter.type;


                    if (parameter.enum && parameter.enum.length === 1) {
                        parameter.isSingleton = true;
                        parameter.singleton = parameter.enum[0];
                    }

                    if (parameter.in === 'body') {
                      parameter.isBodyParameter = true;
                      method.hasBodyParamters = true;
                    }


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
            var defName = that.camelCase(defVal);

            var definition = {
                name: defName,
                properties: [],
                refs: [],
            };

            _.forEach(defin.properties, function (propin, propVal) {

                var property = {
                    name: propVal,
                    isRef: _.has(propin, '$ref') || (propin.type === 'array' && _.has(propin.items, '$ref')),
                    isArray: propin.type === 'array',
                    type: null,
                    typescriptType: null,
                    format: propin.format
                };

                if (property.isArray)
                    property.type = _.has(propin.items, '$ref') ? that.camelCase(propin.items["$ref"].replace("#/definitions/", "")) : propin.items.type;
                else
                    property.type = _.has(propin, '$ref') ? that.camelCase(propin["$ref"].replace("#/definitions/", "")) : propin.type;

                if (property.type === 'integer' || property.type === 'double')
                    property.typescriptType = 'number';
                else if (property.type === 'string' && (property.format === 'date' || property.format === 'date-time'))
                     {
                         property.typescriptType = 'Date';
                     }
                else if (property.type === 'object')
                    property.typescriptType = 'any';
                else
                    property.typescriptType = property.type;


                if (property.isRef)
                    definition.refs.push(property);
                else
                    definition.properties.push(property);
            });

            data.definitions.push(definition);
        });

        if (data.definitions.length > 0)
            data.definitions[data.definitions.length - 1].last = true;

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

        if (text.indexOf('-') === -1 && text.indexOf('.') === -1)
            return text;

        var tokens = [];

        text.split('-').forEach(function (token, index) {
            tokens.push(token[0].toUpperCase() + token.substring(1));
        });

        var partialres = tokens.join('');
        tokens = [];

        partialres.split('.').forEach(function (token, index) {
            tokens.push(token[0].toUpperCase() + token.substring(1));
        });

        return tokens.join('');
    }

    Generator.prototype.LogMessage = function (text, param) {
        if (this.Debug)
            console.log(text, param || '');
    }

    return Generator;
})();

module.exports.Generator = Generator;
