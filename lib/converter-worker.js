/*
 * Copyright (c) 2014 Thomas Kern
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*
 * This file contains everything necessary to execute asciidoctor.js in a
 * a webworker thread. It is completely self-contained and contains copies
 * of opal.js and asciidoctor.js.
 * Currently, opal and asciidoctor are included manually, but we might create
 * this from its parts through a build process in the future.
 */

/*global Opal, importScripts, postMessage */
/*jshint -W079, -W098 */

// Webworkers do not have access to 'console', but Opal needs it.

var console = {
    messages: [],
    log: function (m) {
        this.messages.push(m);
    },
    info: function (m) {
        this.messages.push(m);
    },
    warn: function (m) {
        this.messages.push(m);
    },
    error: function (m) {
        this.messages.push(m);
    },
    debug: function (m) {
        this.messages.push(m);
    },
    clear: function() {
        this.messages = [];
    }
};

// onmessage is invoked by 'postMessage' on the worker
var onmessage = function (e) {
    postMessage(convert(e.data));
};

// Actual conversion is done here
function convert(data) {

    var startTime = new Date().getTime();
    console.clear();
    
    // communicate to Asciidoctor that the working directory is not the same as the preview file
    Opal.ENV['$[]=']("PWD", data.pwd);
    
    // options an attributes
    var opts = Opal.hash2(['base_dir', 'safe', 'doctype', 'attributes'], {
        'base_dir': data.basedir,
        'safe': data.safemode,
        'doctype': data.doctype,
        'attributes': data.attributes
    });
    
    return {
        html: Opal.Asciidoctor.$convert(data.docText, opts), // convert!
        messages: console.messages,
        duration: new Date().getTime() - startTime
    };
}

// Import Opal and Asciidoctor.js
importScripts('opal.js', 'asciidoctor.js');
