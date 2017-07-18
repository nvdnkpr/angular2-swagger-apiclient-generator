#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';

import { map } from 'lodash';

/**
 * Command line interface (CLI) for generator.
 *
 * @package angular2-swagger-apiclient-generator
 * @author Navid Nikpour <navid@nikpour.com>
 */

//
const optimist = require('optimist')
  .usage('Usage: swagger2angular [options]')
  .alias('h', 'help').describe('h', 'Displays this help information')
  .alias('s', 'source').describe('s', 'Path to your swagger specification, can be file or a URL path')
  .alias('o', 'outputPath').describe('o', 'Output path for the generated files').default('o', 'client')
  .alias('d', 'debug').describe('d', 'Enable verbose debug message').default('d', false)
  .alias('t', 'templatePath').describe('t', 'Path to own templates to generate model and resource files')
  .alias('r', 'resourceTemplate').describe('o', 'Template filename for generating resource files')
  .alias('m', 'modelTemplate').describe('o', 'Template filename for generatiing model files')
  .alias('g', 'generateTemplates').describe('g', 'Generates files for model and resource templates, showing the template contexts')
  .alias('b', 'buildConfig').describe('b', 'Path to your swagger2angular configuration file.');

const argv = optimist.argv;
console.log(argv);

function stderr(err) {
  console.log('Error: ' + err);
  process.exit(1);
}


/**
 * Execute
 */
if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

/**
 * Special Flag for generating
 */

/**
 * Only required option: the swagger file source, either file or URL path
 */

/**
 * Config
 */
const config = argv.buildConfig
  ? JSON.parse(fs.readFileSync(argv.buildConfig, 'utf8'))
  : {
    swaggerSpecFile: argv.source,
    output: argv.outputPath,
    debug: argv.debug,
    templatePath: argv.templatePath,
    modelTemplate: argv.modelTemplate,
    resourceTemplate: argv.resourceTemplate
  };

const Generator = require('..').Generator;

const generator = new Generator(config);

// create output paths if they don't exist
const outputPath = path.join(process.cwd(), generator.getOutputPath());
if (!fs.existsSync(outputPath)) {fs.mkdirSync(outputPath); }

const modelsPath = path.join(outputPath, 'models');
if (!fs.existsSync(modelsPath)) { fs.mkdirSync(modelsPath); }

const resourcesPath = path.join(outputPath, 'resources');
if (!fs.existsSync(resourcesPath)) { fs.mkdirSync(resourcesPath); }


const barrelRenderer = Generator.templateCompiler(
`
/* tslint:disable */
{{#each paths}}
export * from './{{this}}';
{{/each}}
`);
// create models and model barrel
generator.getModels().then((models) => {
  const modelsPathList = map(models, (modelDefinition, modelName) => {
    const modelPath = path.join(modelsPath, `${modelName}.ts`);
    const data = generator.processModel({modelName, modelDefinition});
    fs.writeFileSync(modelPath, data);

    return modelPath;
  });

  const modelsRelativePaths = map(modelsPathList, (modelPath) => path.relative(modelsPath, modelPath));
  fs.writeFileSync(path.join(modelsPath, 'index.ts'), barrelRenderer({paths: modelsRelativePaths}));
});

// create resources and resource barrel
generator.getResources().then((resources) => {
  const resourcesPathList = map(resources, (resourceDefinition, resourceName) => {
    const resourcePath = path.join(resourcesPath, `${resourceName}.ts`);
    const data = generator.processResource({resourceName, resourceDefinition});
    fs.writeFileSync(resourcePath, data);

    return resourcePath;
  });
  const resourcesRelativePaths = map(resourcesPathList, (resourcePath) => path.relative(resourcesPath, resourcePath));
  fs.writeFileSync(path.join(resourcesPath, 'index.ts'), barrelRenderer({paths: resourcesRelativePaths}));
});
