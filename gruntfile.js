var path = require('path');

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // clean dist task
    clean: {
      options: {
        dot: true
      },
      dist: ['dist/*']
    },

    /**
    * Copy files to dist
    */
    copy: {
      dist: {
        files: [{
          expand: true,
          src: ['images/**', 'lib/**', 'mode/**', 'styles/**', 'templates/**', 'themes/**',
              'CHANGELOG.adoc', 'LICENSE.txt', 'README.adoc', 'main.js', 'package.json', '!**/Thumbs.db'],
          dest: 'dist/'
        }]
      }
    },

    /**
    * Create distribution zip file
    */
    compress: {
      main: {
        options: {
          archive: '<%= pkg.name %>-<%= pkg.version %>.zip'
        },
        files: [
          {expand: true, cwd: 'dist/', src: ['**']}
        ]
      }
    },

    /**
     * Install asciidoctor.css to ./themes and 
     * asciidoctor-all.min.js to ./lib
     * (needs "exportsOverride" in bower.json)
     */
    bower: {
        install: {
            options: {
                verbose: false,
                cleanBowerDir: true,
                targetDir: './lib',
                layout: function(type, component, src) {
                    if (type === "css") {
                        return path.join("../themes");
                    }
                    return "";
                }
            }
        }  
    }
  });
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-bower-task');

  grunt.registerTask('default', ['dist']);
  grunt.registerTask('dist', ['clean', 'bower', 'copy', 'compress']);
};

