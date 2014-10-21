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

/*global define, brackets, window, Worker */

/** @Module exporter */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        FileSystem = brackets.getModule("filesystem/FileSystem"),
        FileUtils = brackets.getModule("file/FileUtils"),
        NativeApp = brackets.getModule("utils/NativeApp"),
        utils = require("lib/utils");
    
    var converterWorker = new Worker(ExtensionUtils.getModulePath(module, "converter-worker.js"));

    /**
     * Convert text into full HTML document with header and footer.
     * Show the result in the system browser.
     * @param {Document}   doc   document to be converted
     * @param {Preferences} prefs extension preferences
     */
    function execute(doc, prefs, displaySpinner) {
        var docText = utils.stripYamlFrontmatter(doc.getText());
             
        displaySpinner(true);
        
        var cwd = FileUtils.getDirectoryPath(window.location.href);
        
        var stylePath = utils.toUrl(require.toUrl("../themes/" + prefs.get("theme") + ".css"));
        console.log(stylePath);
        var baseDir = prefs.get("basedir") || utils.getDefaultBaseDir(doc);
        
        var attributes = 'icons=font@ ' +
                'platform=opal platform-opal ' +
                'env=browser env-browser ' +
                'linkcss ' +
                'stylesheet=' + stylePath;
                 
                
        var imagesDir = prefs.get("imagesdir");
        if (imagesDir) {
            attributes += ' imagesDir=' + utils.toUrl(imagesDir);
        }
        
        var safemode = prefs.get("safemode") || "safe";
        var doctype = prefs.get("doctype") || "article";
        
        // structure to pass docText, options, and attributes.
        var data = {
            docText: docText,
            // current working directory
            cwd: cwd,
            // Asciidoctor options
            basedir: FileUtils.stripTrailingSlash(baseDir),
            safemode: safemode,
            header_footer: true,
            doctype: doctype,
            // Asciidoctor attributes
            attributes: attributes
        };

        // perform conversion in worker thread
        converterWorker.postMessage(data);

        converterWorker.onmessage = function (e) {
  
            // HACK: 
            var html = e.data.html.replace('href="./' + stylePath, 'href="' + stylePath);
			
            // Workaround for issue https://github.com/asciidoctor/asciidoctor.js/issues/60
            if (e.data.stem) {
                html = html.replace('inlineMath: [\\(,\\)]', 'inlineMath: [["\\\\(","\\\\)"]]');
                html = html.replace('displayMath: [\\[,\\]]', 'displayMath: [["\\\\[","\\\\]"]]');
                html = html.replace('delimiters: [\\$,\\$]', 'delimiters: [["\\\\$","\\\\$"]]');
            }
            
            displaySpinner(false);

            var file = FileSystem.getFileForPath(doc.file.fullPath + "_brackets.html");
            
            FileUtils.writeText(file, html, true).done(function() {
                // Using correct URL crashes Brackets sprint 44 for whatever reason.
                // Raw file path works on Windows, but not on Linux 
                if (brackets.platform === "win") {
                    NativeApp.openURLInDefaultBrowser(file.fullPath);
                } else {
                    NativeApp.openURLInDefaultBrowser("file:///" + file.fullPath);
                }
            });
        };
    }

    exports.execute = execute;
});
