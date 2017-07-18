const gulp = require('gulp');
const ts = require('gulp-typescript');
const del = require('del');

gulp.task('default', ['clean', 'copyTemplates','copyLib']);

gulp.task('clean', function(){
  return del(['dist']);
});
gulp.task('copyTemplates',['clean'], function(){
  return gulp.src('src/**/*.hbs').pipe(gulp.dest('dist'));
});

gulp.task('copyLib',['clean'], function(){
  return gulp.src('src/**/*.ts').pipe(ts({project: 'tsconfig.json'})).pipe(gulp.dest('dist'));
});

