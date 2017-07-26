module.exports = function (grunt) {

    function log(err, stdout, stderr, cb) {
        console.log(stdout);
        console.log(stderr);
        cb();
    }

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        shell: {
            apimd: {
                command: [
                    'apidoc-markdown2 -p docs -o README.md --prepend header.md',
                ].join('&&'),
                options: {
                    callback: log
                }
            }
        },

        apidoc: {
            gen: {
                src: 'routes/',
                dest: 'docs'
            }
        }
    });

    grunt.loadNpmTasks('grunt-apidoc');
    grunt.loadNpmTasks('grunt-shell');

    grunt.registerTask('doc', ['apidoc', 'shell:apimd']);
};
