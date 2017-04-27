var gulp = require('gulp');
var fs = require("fs");

gulp.task('default', ['copyBin', 'copyLib']);

gulp.task('copyBin', function () {
    var stream = gulp.src('src/a2apigen.js').pipe(gulp.dest('bin'));
    console.log("copyBin, files present: ", fs.readdirSync("./"));
    console.log("copyBin, parent files present: ", fs.readdirSync("../"));
    return stream;
});

gulp.task('copyLib', function () {
    var stream = gulp.src('src/generator.js').pipe(gulp.dest('lib'));
    console.log("copyLib, files present: ", fs.readdirSync("./"));
    console.log("copyLib, parent files present: ", fs.readdirSync("../"));
    return stream;
});

