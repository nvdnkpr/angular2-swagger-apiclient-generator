# angular2-swagger-apiclient-generator
Angular 2 API client generator from swagger json

# Description
This package generates a angular2 typescript class from a swagger v2.0 specification file. The code is generated using mustache templates.

# How to get it working

## Installation
1. `npm install angular2-swagger-client-generator`

or

1. get it from github `git clone https://github.com/nvdnkpr/angular2-swagger-client-generator`
1. `cd angular2-swagger-client-generator`
1. `npm install`
1. `npm run build`
1. If you want to run globally run `npm install -g`

## Usage

From commandline run:
```
a2apigen -s [your/path/to/swagger.json] -c [className] -g [GenerateParameter]
```

or
```
a2apigen -u [url/of/your/swagger.json] -c [className] -g [GenerateParameter]
```

If parameter -c is not provided, class name will be ApiClient Service.

Available values for parameter -g are I, M, C or F, as well as you can combine them.  

## Parameters

Options:

  -s, --source      Path to your swagger.json file

  -u, --url         Url of your swagger.json file

  -o, --outputpath  Path where to store generated files

  -c, --className   Class name for Api client

  -g, --generate    What to generate, F for full (default), I for interfaces, M for models, C for classes

## Example usage:

This command will generate API client described in swagger.json file to ./out folder
```
a2apigen -s .\tests\apis\swagger.json -o ./out
```

or from repository directory run:
```
node ./src/main -s .\tests\apis\swagger.json -o ./out
```

##Note:
This project was inspired by:

[swagger-js-codegen](https://github.com/wcandillon/swagger-js-codegen) project
