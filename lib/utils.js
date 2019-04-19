/*
 * Copyright (c) 2014-2016 Thomas Kern
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

define(function(require, exports) {
  'use strict'

  var FileUtils = brackets.getModule('file/FileUtils'),
    ExtensionLoader = brackets.getModule('utils/ExtensionLoader'),
    FileSystem = brackets.getModule('filesystem/FileSystem'),
    dataDirectoryName = 'data.nerk.asciidoc-preview',
    extensions = [],
    styles = [],
    themes = [],
    scriptsPrepend = [],
    scriptsAppend = []

  function getDataDir() {
    return ExtensionLoader.getUserExtensionPath() + '/../' + dataDirectoryName + '/'
  }

  function getTmpDir() {
    return getDataDir() + 'tmp/'
  }

  // returns path of extensions directory relative to plugin's lib/ directory
  function getRelativeUserExtensionsDir() {
    return '../../../' + dataDirectoryName + '/extensions/'
  }

  function populateList(subDir, list, fileExt) {
    try {
      var path = getDataDir() + subDir
      var dir = FileSystem.getDirectoryForPath(path)
      dir.getContents(function(err, contents) {
        if (err && err != 'NotFound') {
          console.error(dir.fullPath + ': ' + err)
          return
        }
        contents.forEach(function(file) {
          if (file._isFile && FileUtils.getFileExtension(file.fullPath) === fileExt) {
            if (subDir === 'extensions/') {
              list.push(getRelativeUserExtensionsDir() + file.name)
            } else {
              list.push(file.fullPath)
            }
          }
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  function initUserExtensions() {
    populateList('extensions/', extensions, 'js')
    populateList('styles/', styles, 'css')
    populateList('themes/', themes, 'css')
    populateList('scripts_prepend/', scriptsPrepend, 'js')
    populateList('scripts_append/', scriptsAppend, 'js')
  }

  function normalizePath(path) {
    return FileUtils.stripTrailingSlash(FileUtils.convertWindowsPathToUnixPath(path.trim()))
  }

  function getDefaultBaseDir(doc) {
    return FileUtils.getDirectoryPath(doc.file.fullPath)
  }

  function toUrl(path) {
    return window.location.protocol + '//' + normalizePath(path)
  }

  function stripYamlFrontmatter(txt) {
    var yamlRegEx = /^-{3}([\w\W]+?)(-{3})/,
      yamlMatch = yamlRegEx.exec(txt)

    // If there's yaml front matter, remove it.
    if (yamlMatch) {
      txt = txt.substr(yamlMatch[0].length)
    }
    return txt
  }

  // pathEqual normalizes paths before comparing. On Windows,
  // comparison is case insensitive.
  function pathEqual(path1, path2) {
    var p1 = normalizePath(path1)
    var p2 = normalizePath(path2)
    if (brackets.platform == 'win') {
      return p1.toLowerCase() == p2.toLowerCase()
    } else {
      return p1 == p2
    }
  }

  function themeName(themeFile) {
    var fileName = themeFile.split('/').pop()
    var tn = fileName.substring(0, fileName.length - 4).replace(new RegExp('_|-', 'g'), ' ')
    return tn.charAt(0).toUpperCase() + tn.slice(1)
  }

  exports.getDefaultBaseDir = getDefaultBaseDir
  exports.getTmpDir = getTmpDir
  exports.initUserExtensions = initUserExtensions
  exports.getUserExtensions = function() {
    return {
      extensions: extensions,
      styles: styles,
      themes: themes,
      scriptsPrepend: scriptsPrepend,
      scriptsAppend: scriptsAppend
    }
  }

  exports.themeName = themeName
  exports.normalizePath = normalizePath
  exports.pathEqual = pathEqual
  exports.toUrl = toUrl
  exports.stripYamlFrontmatter = stripYamlFrontmatter
})
