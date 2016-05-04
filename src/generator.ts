let fs = require('fs');
let _ = require('lodash');

class Generator
{
  swaggerFile:string;
  outputPath:string;
  logger:any;
  debug:boolean = true;

  private swaggerParsed:any;
  private templates:any;
  private initialized:boolean = false;
  private viewModel:any;

  setDebug(debug:boolean)
  {
    this.debug = debug;
  }

  constructor(swaggerFile:string, outputPath:string, private logger = console)
  {

  }

  initialize():void
  {
    this.logMessage(`Reading Swagger file ${this.swaggerFile}`);
    let swaggerfilecontent = fs.readFileSync(this.swaggerFile, 'UTF-8');

    this.logMessage('Parsing Swagger JSON');
    this.swaggerParsed = JSON.parse(swaggerfilecontent);

    this.logMessage('Reading Mustache templates');

    this.templates = {
      'classRenderer': _.template(fs.readFileSync(__dirname + "/../templates/angular2-service.mustache", 'utf-8')),
      'modelRenderer': _.template(fs.readFileSync(__dirname + "/../templates/angular2-model.mustache", 'utf-8')),
      'barrelRenderer': _.template(fs.readFileSync(__dirname + "/../templates/angular2-models-export.mustache", 'utf-8'))
    };

    this.logMessage('Creating Mustache viewModel');
    this.viewModel = this.createViewModel();

    this.initialized = true;
  }

  generateAPIClient()
  {
    if (this.initialized !== true)
    {
      this.initialize();
    }

    this.generateClient();
    this.generateModels();
    this.generateCommonModelsExportDefinition();

    this.logMessage('API client generated successfully');
  };

  generateClient()
  {
    if (this.initialized)
    {
      this.initialize();
    }

    // generate main API client class
    this.logMessage('Rendering template for API');
    let result = this.renderLintAndBeautify(this.templates.classRenderer, this.viewModel);

    let outfile = this.outputPath + "/" + "client.ts";
    this.logMessage(`Creating output file: ${outfile}`);

    fs.writeFileSync(outfile, result, 'utf-8')
  }

  generateModels()
  {
    if (!this.initialized)
    {
      this.initialize();
    }

    let outputdir = this.outputPath + '/models';

    if (!fs.existsSync(outputdir))
    {
      fs.mkdirSync(outputdir);
    }

    // generate API models
    _.forEach(this.viewModel.definitions, function (definition, defName)
    {
      this.logMessage(`Rendering template for model: ${definition.name}`);
      let result = this.renderLintAndBeautify(this.templates.modelRenderer, definition);

      let outfile = outputdir + "/" + definition.name + ".ts";

      this.logMessage(`Creating output file ${outfile}`);
      fs.writeFileSync(outfile, result, 'utf-8')
    });
  }

  generateCommonModelsExportDefinition()
  {
    if (this.initialized)
    {
      this.initialize();
    }

    let outputdir = this.outputPath;

    if (!fs.existsSync(outputdir))
    {
      fs.mkdirSync(outputdir);
    }

    this.logMessage('Rendering common models export');
    let result = this.renderLintAndBeautify(this.templates.barrelRenderer, this.viewModel);

    let outfile = outputdir + "/models.ts";

    this.logMessage(`Creating output file ${outfile}`);
    fs.writeFileSync(outfile, result, 'utf-8')
  }

  renderLintAndBeautify(renderer, model)
  {

    // Render *****
    let result = renderer(model);

    // TODO: lint the result
    // Lint *****
    // let ll = new Linter("noname", rendered, {});
    // let lintResult = ll.lint();
    // lintResult.errors.forEach(function (error) {
    //     if (error.code[0] === 'E')
    //         throw new Error(error.reason + ' in ' + error.evidence + ' (' + error.code + ')');
    // });

    // TODO: beautify the result
    // Beautify *****
    // NOTE: this has been commented because of curly braces were added on newline after beaufity
    //result = beautify(result, { indent_size: 4, max_preserve_newlines: 2 });

    return result;
  }

  createViewModel()
  {
    let swagger = this.swaggerParsed;

    // domain
    let domain = (swagger.schemes && swagger.schemes.length > 0 && swagger.host && swagger.basePath) ? swagger.schemes[0] + '://' + swagger.host + swagger.basePath : null;
    domain = (!domain && swagger.host) ? swagger.host : '';

    let data = {
      isNode: false,
      description: swagger.info.description,
      isSecure: swagger.securityDefinitions !== undefined,
      swagger: swagger,
      domain: domain,
      methods: [],
      definitions: []
    };

    let authorizedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    _.forEach(swagger.paths, function (operations, path)
    {

      let globalParams = _.forEach(operations, function (op, m)
      {
        if (m.toLowerCase() === 'parameters')
        {
          globalParams = op;
        }
      });

      _.forEach(operations, function (op, m)
      {
        if (authorizedMethods.indexOf(m.toUpperCase()) === -1)
        {
          return;
        }

        // methodName
        let methodName = op['x-swagger-js-method-name'] ? op['x-swagger-js-method-name'] : (op.operationId ? op.operationId : this.getPathToMethodName(m, path));

        let summaryLines = op.description.split('\n');
        summaryLines.splice(summaryLines.length - 1, 1);

        let method = {
          path: path,
          methodName: methodName,
          method: m.toUpperCase(),
          angular2httpMethod: m.toLowerCase(),
          isGET: m.toUpperCase() === 'GET',
          hasPayload: !_.includes(['GET', 'DELETE', 'HEAD'], m.toUpperCase()),
          summaryLines: summaryLines,
          isSecure: swagger.security !== undefined || op.security !== undefined,
          parameters: [],
          hasJsonResponse: _.some(_.defaults([], swagger.produces, op.produces), function (response)
          { // TODO PREROBIT
            return response.indexOf('/json') != -1;
          })
        };

        let params = [];

        if (_.isArray(op.parameters))
        {
          params = op.parameters;
        }

        params = params.concat(globalParams);

        _.forEach(params, function (parameter)
        {
          // Ignore headers which are injected by proxies & app servers
          // eg: https://cloud.google.com/appengine/docs/go/requests#Go_Request_headers

          if (parameter['x-proxy-header'] && !data.isNode)
          {
            return;
          }

          if (_.has(parameter, 'schema') && _.isString(parameter.schema.$ref))
          {
            parameter.type = this.camelCase(this.getRefType(parameter.schema.$ref));
          }

          parameter.camelCaseName = this.camelCase(parameter.name);

          if (parameter.type === 'integer' || parameter.type === 'double')
          {
            parameter.typescriptType = 'number';
          }
          else
          {
            parameter.typescriptType = parameter.type;
          }

          if (parameter.enum && parameter.enum.length === 1)
          {
            parameter.isSingleton = true;
            parameter.singleton = parameter.enum[0];
          }

          if (parameter.in === 'body')
          {
            parameter.isBodyParameter = true;
          }
          else if (parameter.in === 'path')
          {
            parameter.isPathParameter = true;
          }
          else if (parameter.in === 'query')
          {
            parameter.isQueryParameter = true;
            if (parameter['x-name-pattern'])
            {
              parameter.isPatternType = true;
            }
          }
          else if (parameter.in === 'header')
          {
            parameter.isHeaderParameter = true;
          }
          else if (parameter.in === 'formData')
          {
            parameter.isFormParameter = true;
          }

          method.parameters.push(parameter);
        });

        if (method.parameters.length > 0)
        {
          method.parameters[method.parameters.length - 1].last = true;
        }

        data.methods.push(method);
      });

    });

    _.forEach(swagger.definitions, function (defin, defVal)
    {
      let defName = this.camelCase(defVal);

      let definition = {
        name: defName,
        properties: [],
        refs: [],
      };

      _.forEach(defin.properties, function (propin, propVal)
      {

        let property = {
          name: propVal,
          isRef: _.has(propin, '$ref') || (propin.type === 'array' && _.has(propin.items, '$ref')),
          isArray: propin.type === 'array',
          type: null,
          typescriptType: null
        };

        if (property.isArray)
        {
          property.type = _.has(propin.items, '$ref') ? this.camelCase(propin.items["$ref"].replace("#/definitions/", "")) : propin.type;
        }
        else
        {
          property.type = _.has(propin, '$ref') ? this.camelCase(propin["$ref"].replace("#/definitions/", "")) : propin.type;
        }

        if (property.type === 'integer' || property.type === 'double')
        {
          property.typescriptType = 'number';
        }
        else
        {
          property.typescriptType = property.type;
        }

        if (property.isRef)
        {
          definition.refs.push(property);
        }
        else
        {
          definition.properties.push(property);
        }
      });

      data.definitions.push(definition);
    });

    if (data.definitions.length > 0)
    {
      data.definitions[data.definitions.length - 1].last = true;
    }

    return data;
  }

  getRefType(refString)
  {
    let segments = refString.split('/');
    return segments.length === 3 ? segments[2] : segments[0];
  }

  getPathToMethodName(m, path)
  {
    if (path === '/' || path === '')
    {
      return m;
    }

    // clean url path for requests ending with '/'
    let cleanPath = path;

    if (cleanPath.indexOf('/', cleanPath.length - 1) !== -1)
    {
      cleanPath = cleanPath.substring(0, cleanPath.length - 1);
    }

    let segments = cleanPath.split('/').slice(1);

    segments = _.transform(segments, function (result, segment)
    {
      if (segment[0] === '{' && segment[segment.length - 1] === '}')
      {
        segment = 'by' + segment[1].toUpperCase() + segment.substring(2, segment.length - 1);
      }

      result.push(segment);
    });

    let result = this.camelCase(segments.join('-'));

    return m.toLowerCase() + result[0].toUpperCase() + result.substring(1);
  }

  camelCase(text)
  {
    if (!text)
    {
      return text;
    }

    if (text.indexOf('-') === -1 && text.indexOf('.') === -1)
    {
      return text;
    }

    let tokens = [];

    text.split('-').forEach(function (token, index)
    {
      tokens.push(token[0].toUpperCase() + token.substring(1));
    });

    let partialres = tokens.join('');
    tokens = [];

    partialres.split('.').forEach(function (token, index)
    {
      tokens.push(token[0].toUpperCase() + token.substring(1));
    });

    return tokens.join('');
  }

  logMessage(msg)
  {
    if (this.debug)
    {
      this.logger.log(msg);
    }
  }

}