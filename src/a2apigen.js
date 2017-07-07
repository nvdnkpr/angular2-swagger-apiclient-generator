#!/usr/bin/env node

/**
 * Command line interface (CLI) for generator.
 *
 * @package angular2-swagger-apiclient-generator
 * @author Michal Krchnavy <michal@krchnavy.sk>
 */

// requirements
var optimist = require('optimist')
    .usage('Usage: swagger2ng2 -s path/to/your/swagger.json')
    .alias('h', 'help')
    .alias('s', 'source')
    .alias('u', 'url')
    .alias('o', 'outputpath')
    .alias('c', 'className')
    .alias('g', 'generate')
    .alias('m', 'modelInterfaces')
    .alias('f', 'fileName')
    .alias('p', 'modelPath')
    .alias('b', 'buildConfig')
    .describe('s', 'Path to your swagger.json file')
    .describe('u', 'Url of your swagger.json file')
    .describe('o', 'Path where to store generated files')
    .describe('c', 'Class name for Api client')
    .describe('g', 'What to generate, F for full (default), I for interfaces, M for models and C for classes')
    .describe('m', 'Path where model interfaces are stored')
    .describe('f', 'The filename of the generated service')
    .describe('p', 'Relative path to external models if used')
    .describe('b', 'Path to your swagger2ng2 configuration file.');

var fs = require('fs');

var genRef = require('../lib/generator');

var argv = optimist.argv;

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

// Check requirements
var fromSource = false;
var fromUrl = false;
var useBuildConfig = false;

if (typeof argv.source !== 'undefined' && argv.source !== true)
    fromSource = true;
else if (typeof argv.url !== 'undefined' && argv.url !== true)
    fromUrl = true;
else if (typeof argv.buildConfig !== 'undefined' && argv.buildConfig !== true)
    useBuildConfig = true;
else {
    stderr('Swagger.json file (-s) or url (-u) or buildconfig (-b) must be specified. See --help');
    process.exit(1);
}

var outputdir = "";
var sourceFile = "";
var className = "";
var generate = "";
var modelInterfaces = "";
var fileName = "";
var modelPath = "";
var buildConfigFile = "";
var createModelPath = true;
var createModelExportFile = true;

if (useBuildConfig) {
    buildConfigFile = argv.buildConfig;

    var fileContent = fs.readFileSync(buildConfigFile, 'UTF-8');
    var jsonFileContent = JSON.parse(fileContent);

    outputdir = jsonFileContent.outputPath; 
    sourceFile = jsonFileContent.source;
    className = jsonFileContent.className || 'ApiClientService';
    generate = jsonFileContent.generate || 'F';
    modelInterfaces = jsonFileContent.modelInterfaces || null;
    fileName = jsonFileContent.fileName || "index";
    modelPath = jsonFileContent.modelPath || './models';
    createModelPath = jsonFileContent.createModelPath || false;
    createModelExportFile = jsonFileContent.createModelExportFile || true;
}
else {
    outputdir = argv.outputpath || './output';
    sourceFile = argv.source;
    className = argv.className || 'ApiClientService';
    generate = argv.generate || 'F';
    modelInterfaces = argv.modelInterfaces || null;
    fileName = argv.fileName || "index";
    modelPath = argv.modelPath || './models';
}

if (!fs.existsSync(outputdir))
    fs.mkdirSync(outputdir);

if (fromUrl) {
    var request = require('request');
    var path = require('path');
    var fs = require('fs');

    var dest = path.join(outputdir, "swagger.json");

    request
        .get(argv.url, function (error, response, body) {
            if (error || response.statusCode != 200) {
                console.log(error);
                process.exit(1);
            }

            fs.writeFileSync(dest, body, 'utf-8');

            var g = new genRef.Generator(dest, outputdir, className, generate, modelInterfaces, fileName, modelPath, createModelPath, createModelExportFile);
            g.Debug = true;
            g.generateAPIClient();
        });
}
else {
    //Do Job
    var g = new genRef.Generator(sourceFile, outputdir, className, generate, modelInterfaces, fileName, modelPath, createModelPath, createModelExportFile);
    g.Debug = true;
    g.generateAPIClient();
}

