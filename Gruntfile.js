'use strict';

module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-jscs');

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        ignores: ['node_modules/**/*.js']
      },
      all: {
        files: {
          src: ['*.js']
        }
      }
    },

    jscs: {
      all: ['*.js']
    },

    watch: {
      all: {
        files: ['*.js'],
        tasks: ['jshint:all', 'jscs:all']
      }
    }
  });

  grunt.registerTask('default', 'jshint:all');
};