var path = require('path');

module.exports = function (grunt) {

    var distfiles = ['images/**', 'lib/**', 'styles/**', 'templates/**', 'themes/**',
        'node_modules/codemirror-asciidoc/**',
        'node_modules/asciidoctor.js/**',
        'CHANGELOG.adoc', 'LICENSE.txt', 'README.adoc', 'main.js', 'package.json', '!**/Thumbs.db'];

    var pkg = grunt.file.readJSON('package.json');

    // For development and Windows only:
    // extensionDir is the directory where this extension is installed
    // Just run 'grunt devdeploy' to copy the distribution files
    // to the brackets extension directory.
    //
    // In Unix environments this is not necessary. We can just use a symbolic link from
    // the extension directory to the source directory.

    var devExtFiles = [];
    if (process.platform === 'win32') {
        var extensionDir = process.env.APPDATA + '/Brackets/extensions/user/' + pkg.name + '/';
        devExtFiles = [extensionDir + '*'];
    }

    grunt.initConfig({
        pkg: pkg,

        clean: {
            /*
             * clean distribution directory
             */
            dist: {
                options: {
                    dot: true
                },
                src: ['dist/*']
            },
            /*
             * clean external extension directory (Windows only)
             */
            dev: {
                options: {
                    dot: true,
                    force: true
                },
                src: devExtFiles
            }
        },

        copy: {
            /**
             * Copy files to dist
             */
            dist: {
                files: [{
                    expand: true,
                    src: distfiles,
                    dest: 'dist/'
                }]
            },
            /**
             * Copy files to brackets extension directory (Windows only)
             */
            dev: {
                files: [{
                    expand: true,
                    src: distfiles,
                    dest: extensionDir
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
    });


    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-compress');

    grunt.registerTask('default', ['dist']);
    grunt.registerTask('dist', ['clean:dist', 'copy:dist', 'compress']);

    // Development under Windows only
    if (extensionDir) {
        grunt.registerTask('devdeploy', ['clean:dev', 'copy:dev']);
    }
};

