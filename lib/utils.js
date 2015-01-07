/*
 * Copyright (c) 2014-2015 Thomas Kern
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

/*global define, brackets, window */

/** @Module utils */

define(function (require, exports) {
    "use strict";

    var FileUtils = brackets.getModule("file/FileUtils");

    
    function normalizePath(path) {
        return FileUtils.stripTrailingSlash(FileUtils.convertWindowsPathToUnixPath(path.trim()));
    }
    
    function getDefaultBaseDir(doc) {
        return FileUtils.getDirectoryPath(doc.file.fullPath);
    }
    
    function toUrl(path) {
        return window.location.protocol + "//" + normalizePath(path);
    }
    
    function stripYamlFrontmatter(txt) {
        var yamlRegEx = /^-{3}([\w\W]+?)(-{3})/,
            yamlMatch = yamlRegEx.exec(txt);

        // If there's yaml front matter, remove it.
        if (yamlMatch) {
            txt = txt.substr(yamlMatch[0].length);
        }
        return txt;
    }
    
    // pathEqual normalizes paths before comparing. On Windows,
    // comparison is case insensitive.
    function pathEqual(path1, path2) {
        var p1 = normalizePath(path1);
        var p2 = normalizePath(path2);
        if (brackets.platform == "win") {
            return p1.toLowerCase() == p2.toLowerCase();
        } else {
            return p1 == p2;
        }
    }
    
    exports.getDefaultBaseDir = getDefaultBaseDir;
    exports.normalizePath = normalizePath;
    exports.pathEqual = pathEqual;
    exports.toUrl = toUrl;
    exports.stripYamlFrontmatter = stripYamlFrontmatter;
});
