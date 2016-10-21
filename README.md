# flyacts-angular2-swagger-apiclient-generator
Angular 2 API client generator from swagger json

# Description
This package generates a angular2 typescript class from a swagger v2.0 specification file. The code is generated using mustache templates.

Updated to work with the release version of Angular2

# How to get it working

## Installation
1. `npm install flyacts-angular2-swagger-client-generator`

or

1. get it from github `git clone https://github.com/flyacts/angular2-swagger-client-generator`
1. `cd flyacts-angular2-swagger-client-generator`
1. `npm install`
1. `npm run build`

## Usage

From commandline run:
```
a2apigen -s [yopur/path/to/swagger.json]
```

or
```
a2apigen -u [url/of/your/swagger.json]
```

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
