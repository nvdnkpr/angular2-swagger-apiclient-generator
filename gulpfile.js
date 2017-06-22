var gulp = require('gulp');
var fs = require("fs");

gulp.task('default', ['copyBin', 'copyLib']);

gulp.task('copyBin', function () {
    var stream = gulp.src('src/a2apigen.js').pipe(gulp.dest('bin'));
    return stream;
});

gulp.task('copyLib', function () {
    var stream = gulp.src('src/generator.js').pipe(gulp.dest('lib'));
    return stream;
});

