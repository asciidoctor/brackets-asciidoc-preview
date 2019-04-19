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

/*global define, brackets, window, Worker */

/** @Module exporter */

define(function(require, exports, module) {
  'use strict'

  var ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
    FileSystem = brackets.getModule('filesystem/FileSystem'),
    FileUtils = brackets.getModule('file/FileUtils'),
    NativeApp = brackets.getModule('utils/NativeApp'),
    Previewer = require('lib/viewpanel'),
    utils = require('lib/utils')

  var converterWorker = new Worker(ExtensionUtils.getModulePath(module, 'converter-worker.js'))

  // Generated HTML file will be located outside the original document source tree in a temporary
  // directory. However, links to assets will still refer to the original directory.
  // This function sets '<base>' in the generated HTML to the original directory so that
  // all relative links still work. It also adds code so that internal page anchors are adjusted
  // automatically by the browser.

  function adjustLinks(html, baseDir, docDir) {
    var anchorScript =
      '<script>' +
      '    links = document.querySelectorAll("a[href]");' +
      '    for (var i = 0, n = links.length; i < n; i++) {' +
      '        var href = links[i].getAttribute("href");' +
      '        if (href.match(/^#/)) {' +
      '           links[i].setAttribute("href", "javascript:;");' +
      '           links[i].setAttribute("onclick", "document.location.hash=\'" + href.replace(/^#/, "") + "\';");' +
      '        }' +
      '    }' +
      '</script>'

    html = html.replace(/<head>/, '<head><base href="' + utils.toUrl(baseDir) + '/">')
    return html.replace(/<\/body>/, anchorScript + '</body>')
  }

  function userCSS(cssFiles) {
    var s = ''
    cssFiles.forEach(function(file) {
      s += '<link rel="stylesheet" href="' + utils.toUrl(require.toUrl(file)) + '">'
    })
    return s
  }

  function userScriptsHTML(scriptFiles) {
    var s = ''
    scriptFiles.forEach(function(file) {
      s += '<script src="' + utils.toUrl(require.toUrl(file)) + '"></script>'
    })
    return s
  }

  function injectCustomAssets(html, userExtensions) {
    html = html.replace(/<\/head>/, userCSS(userExtensions.styles) + '</head>')
    html = html.replace(/<\/head>/, userScriptsHTML(userExtensions.scriptsPrepend) + '</head>')
    return html.replace(/<\/body>/, userScriptsHTML(userExtensions.scriptsAppend) + '</body>')
  }

  /**
   * Convert text into full HTML document with header and footer.
   * Show the result in the system browser.
   * @param {Document}  doc document to be converted
   * @param {Object} prefs extension preferences
   */
  function execute(doc, prefs) {
    var docText = utils.stripYamlFrontmatter(doc.getText())

    Previewer.displaySpinner(true)

    var cwd = FileUtils.getDirectoryPath(window.location.href)

    var stylePath = utils.toUrl(require.toUrl(prefs.get('theme')))
    var baseDir = FileUtils.stripTrailingSlash(prefs.get('basedir') || utils.getDefaultBaseDir(doc))

    var attributes = 'stylesheet=' + stylePath

    var imagesDir = prefs.get('imagesdir')
    if (imagesDir) {
      attributes += ' imagesDir=' + utils.toUrl(imagesDir)
    }

    var safemode = prefs.get('safemode') || 'safe'
    var doctype = prefs.get('doctype') || 'article'

    // structure to pass docText, options, and attributes.
    var data = {
      docText: docText,
      plantUmlServerUrl: prefs.get('plantUmlServerUrl'),
      // current working directory
      cwd: cwd,
      userExtensions: utils.getUserExtensions(),
      // Asciidoctor options
      baseDir: baseDir,
      safemode: safemode,
      header_footer: true,
      doctype: doctype,
      // Asciidoctor attributes
      attributes: attributes
    }

    // perform conversion in worker thread
    converterWorker.postMessage(data)

    converterWorker.onmessage = function(e) {
      var directory = FileSystem.getDirectoryForPath(utils.getTmpDir())
      var expPath = directory.fullPath + '/exported.html'

      var html = adjustLinks(e.data.html, baseDir, expPath)
      html = injectCustomAssets(html, utils.getUserExtensions())

      Previewer.displaySpinner(false)

      // generated html is always overridden
      brackets.fs.unlink(expPath, function(err) {
        if (err === brackets.fs.NO_ERROR || err === brackets.fs.ERR_NOT_FOUND) {
          directory.create(function(err) {
            var file = null
            if (!err || err === 'AlreadyExists') {
              file = FileSystem.getFileForPath(expPath)
            } else {
              // fallback to location of document source
              file = FileSystem.getFileForPath(doc.file.fullPath + '_brackets.html')
            }

            FileUtils.writeText(file, html, true).done(function() {
              // Using correct URL crashes Brackets sprint 44 for whatever reason.
              // Raw file path works on Windows, but not on Linux
              if (brackets.platform === 'win') {
                NativeApp.openURLInDefaultBrowser(file.fullPath)
              } else {
                NativeApp.openURLInDefaultBrowser('file:///' + file.fullPath)
              }
            })
          })
        } else {
          console.log(': ' + err + ' Cannot delete file ' + expPath)
        }
      })
    }
  }

  exports.execute = execute
})
