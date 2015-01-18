var path = require('path');

module.exports = function (grunt) {

    var distfiles = ['images/**', 'lib/**', 'mode/**', 'styles/**', 'templates/**', 'themes/**',
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
                    layout: function (type, component, src) {
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
    grunt.registerTask('dist', ['clean:dist', 'bower', 'copy:dist', 'compress']);

    // Development under Windows only
    if (extensionDir) {
        grunt.registerTask('devdeploy', ['clean:dev', 'copy:dev']);
    }
};

