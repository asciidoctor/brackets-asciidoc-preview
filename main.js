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

/* 
 * Based on Markdown preview
 * Copyright (c) 2012 Glenn Ruehle
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Worker */

define(function (require, exports, module) {
  "use strict";

  // Brackets modules
  var AppInit = brackets.getModule("utils/AppInit"),
    NativeApp = brackets.getModule("utils/NativeApp"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    EditorManager = brackets.getModule("editor/EditorManager"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    FileSystem = brackets.getModule("filesystem/FileSystem"),
    FileUtils = brackets.getModule("file/FileUtils"),
    LanguageManager = brackets.getModule("language/LanguageManager"),
    MainViewManager = brackets.getModule("view/MainViewManager"),
    PreferencesManager = brackets.getModule("preferences/PreferencesManager");
  
  // jQuery objects
  var $icon,
    $iframe;

  // Other vars
  var currentDoc,
    fileExtensions = ["ad", "adoc", "asciidoc", "asc"],
    viewerOn;

  // Define AsciiDoc mode
  require("node_modules/codemirror-asciidoc/lib/asciidoc");

  LanguageManager.defineLanguage("asciidoc", {
    name: "AsciiDoc",
    mode: "asciidoc",
    fileExtensions: fileExtensions,
    blockComment: ["////", "////"],
    lineComment: ["//"]
  });

  // Prefs
  var prefs = PreferencesManager.getExtensionPrefs("asciidoc-preview");
  prefs.definePreference("detached", "boolean", false);
  prefs.definePreference("posX", "number", 0);
  prefs.definePreference("posY", "number", 0);
  prefs.definePreference("showtitle", "boolean", true);
  prefs.definePreference("numbered", "boolean", false);
  prefs.definePreference("mjax", "boolean", false);
  prefs.definePreference("autosync", "boolean", false);
  prefs.definePreference("updatesave", "boolean", false);
  prefs.definePreference("theme", "string", "asciidoctor");
  prefs.definePreference("safemode", "string", "safe");
  prefs.definePreference("basedir", "string", "");
  prefs.definePreference("imagesdir", "string", "");
  prefs.definePreference("defaultdir", "string", "");
  prefs.definePreference("doctype", "string", "article");
  prefs.definePreference("plantUmlServerUrl", "string", "");

  // Webworker for AscciDoc into HTML conversion
  var converterWorker = new Worker(ExtensionUtils.getModulePath(module, "lib/converter-worker.js"));
  // assembly of final HTML page
  var output = require("lib/output"),
    // common utils
    utils = require("lib/utils"),
    htmlExporter = require("lib/exporter"),
    Previewer = require("lib/viewpanel");

  // time needed for the latest conversion in ms
  var lastDuration = 500;
  // timestamp when conversion started
  var conversionStart = 0;
  var outline = null,
    docDirChanged = false,
    updateOnSave = prefs.get("updatesave"),
    autosync = prefs.get("autosync");

  // Read user custom extensions directories 
  utils.initUserExtensions(); 
  
  // Event handler for clicks into preview pane
  function handlePreviewClick(e) {
    if (e.ctrlKey) {
      var elem = $(e.target);
      if (elem.is("[class*=data-line]")) {
        var line = elem.attr('class').match(/data-line-(\d+)/)[1];
        jumpToLine(line);
      } else {
        var closest = elem.closest("[class*=data-line]").attr('class');
        if (closest != null) {
           var line = closest.match(/data-line-(\d+)/)[1];
           jumpToLine(line);
	}
      }
      e.preventDefault();
    } else {
      // Open external browser when links are clicked
      // (similar to what brackets.js does - but attached to the iframe's document)
      // Check for links. Check parents too, in case link has inline formatting tags.
      var node = e.target,
        url;
      while (node) {
        if (node.tagName === "A") {
          url = node.getAttribute("href");
          if (url) {
            if (!url.match(/^#/)) {
              NativeApp.openURLInDefaultBrowser(url);
            } else if (url.match(/^#goto_/)) {
              // if URL contains special #goto_ fragment identifier,
              // use line number to jump to this line in document editor.
              jumpToLine(parseInt(url.substr(6), 10));
            }
          }
          e.preventDefault();
          break;
        }
        node = node.parentElement;
      }
    }
    // Close settings dropdown, if open
    Previewer.hideSettings();
  }

  function isDocDirChanged() {
    return docDirChanged;
  }

  /**
   * Jump to specified line in source editor. Vertically centers
   * line in view.
   */
  function jumpToLine(line) {
    line--; // code mirror starts with line 0
    var editor = EditorManager.getCurrentFullEditor();
    editor.setCursorPos(line, 0, true);
    editor.focus();

    var codeMirror = editor._codeMirror;
    codeMirror.addLineClass(line, "wrap", "flash");
    window.setTimeout(function () {
      codeMirror.removeLineClass(line, "wrap", "flash");
    }, 1000);
  }

  function loadDoc(isNewDocument) {
    
    if (Previewer.isActive() && $iframe && currentDoc) {
      var docText = utils.stripYamlFrontmatter(currentDoc.getText()),
        scrollPos = 0;

      if (isNewDocument) {
        scrollPos = 0;
      } else {
        var body = $iframe.contents()[0].body;
        if (body !== null) {
          scrollPos = body.scrollTop;
        }
      }

      var numbered = prefs.get("numbered") ? 'numbered' : 'numbered!';
      var showtitle = prefs.get("showtitle") ? 'showtitle' : 'showtitle!';
      var safemode = prefs.get("safemode") || "safe";
      var doctype = prefs.get("doctype") || "article";

      // baseDir will be used as the base URL to retrieve include files via Ajax requests
      var baseDir = prefs.get("basedir") || utils.getDefaultBaseDir(currentDoc);

      var attributes = numbered.concat(' ').concat(showtitle);

      // imagesDir will be used as the base URL to retrieve images
      var imagesDir = prefs.get("imagesdir");
      if (imagesDir) {
        attributes += ' imagesDir=' + utils.toUrl(imagesDir);
      }

      // Check if directories were overridden in settings panel
      // and post a warning dialog if the current document directory changed.

      var defBaseDir = utils.normalizePath(utils.getDefaultBaseDir(currentDoc));
      docDirChanged = !utils.pathEqual(prefs.get("defaultdir"), defBaseDir);
      if (docDirChanged) {
        prefs.set("defaultdir", defBaseDir);
        prefs.save();
      }
      
      // Input data to be passed to web worker.
      var inputData = {
        docText: docText,
        plantUmlServerUrl: prefs.get("plantUmlServerUrl"),
        theme: prefs.get("theme"),
        renderMath: prefs.get("mjax"),
        // current working directory
        cwd: FileUtils.getDirectoryPath(window.location.href),
        userExtensions: utils.getUserExtensions(),
        // Asciidoctor options
        baseDir: FileUtils.stripTrailingSlash(baseDir),
        safemode: safemode,
        doctype: doctype,
        header_footer: false,
        // Asciidoctor attributes
        attributes: attributes
      };

      if (lastDuration >= 500 || isNewDocument) {
        Previewer.displaySpinner(true);
      }

      // perform conversion in worker thread
      conversionStart = new Date().getTime();
      converterWorker.postMessage(inputData);

      converterWorker.onmessage = function (e) {
        var result = e.data;
        lastDuration = result.duration;
        outline = result.outline;

        output.render($iframe, isNewDocument, inputData, result, function () {
          if (autosync) {
            scrollToPreviewLocation();
          }
          Previewer.displayLocationButton(true);

          var dirsDefined = prefs.get("imagesdir") !== '' || prefs.get("basedir") !== '';
          if (isDocDirChanged() && dirsDefined) {
            Previewer.showWarning();
          } else {
            Previewer.hideWarning();
          }
          // detect mouse clicks in the preview window
          $iframe[0].contentDocument.body.addEventListener("click", handlePreviewClick, true);
        });
        conversionStart = 0;
        Previewer.displaySpinner(false);
      };
    }
  }

  var timer;

  function documentEdited() {
    if (updateOnSave) {
      return;
    }

    // throttle updates
    if (timer) {
      window.clearTimeout(timer);
    }

    // Estimate timeout based on time needed for 
    // actual document conversion. Never longer than
    // 5000 ms.
    var timeout = 150;
    var currentTime = new Date().getTime();

    if (conversionStart > 0) {
      timeout = Math.min(lastDuration - currentTime + conversionStart, 5000);
      if (timeout < 150) {
        timeout = 150;
      }
    }

    timer = window.setTimeout(function () {
      timer = null;
      loadDoc(false);
    }, timeout);
  }

  function updateSettings() {
    // Save preferences
    prefs.save();
    updateOnSave = prefs.get("updatesave");
    autosync = prefs.get("autosync");
    // Re-render
    loadDoc(false);
  }

  function openViewer() {
    var detached = prefs.get("detached");
    Previewer.open(detached, prefs, updateSettings, function (view) {
        $iframe = view.$iframe;
        if (!view.hasClickHandlers) {
          // attach handler to sync-location-button
          $("#asciidoc-sync-location-button", view.document)
            .click(function () {
              scrollToPreviewLocation();
            });

          // attach handler to export-file-button
          $("#asciidoc-export-file-button", view.document)
            .click(function () {
              htmlExporter.execute(currentDoc, prefs);
            });

          // attach handler to export-file-button
          $("#asciidoc-detach-button", view.document)
            .click(function () {
              prefs.set("detached", !detached);
              prefs.save();
              Previewer.close();
              if (currentDoc) {
                openViewer();
              }
            });
          view.hasClickHandlers = true;
        }

        loadDoc(true);
      },
      // view closed callback
      function () {
        if (Previewer.isDetached() && prefs.get("detached")) {
          $icon.removeClass("active");
          viewerOn = false;
        }
        $iframe = null;
      });
  }

  function activatePanel() {
    if (Previewer.isActive() && prefs.get("detached") === Previewer.isDetached()) {
      loadDoc(true);
      return;
    }
    openViewer();
  }

  function updateOnSaveHandler(event, entry) {
    if (Previewer.isActive() && updateOnSave && entry && currentDoc && entry.fullPath === currentDoc.file.fullPath) {
      loadDoc(true);
    }
  }

  // React to user manually changing the language of the file
  // to AsciiDoc from the status bar
  function languageChanged(e, oldLanguage, newLanguage) {
    if (newLanguage.getMode() === "asciidoc" || oldLanguage.getMode() === "asciidoc") {
      currentDocChangedHandler();
    }
  }

  function currentDocChangedHandler() {
    var doc = DocumentManager.getCurrentDocument();
    if (doc) {
      // listen to language changes initiated by the user
      doc.off("languageChanged", languageChanged);
      doc.on("languageChanged", languageChanged);
    }
    if (currentDoc) {
      currentDoc.off("change", documentEdited);
      currentDoc = null;
    }

    if (doc && doc.getLanguage().getMode() === "asciidoc") {
      currentDoc = doc;
      currentDoc.on("change", documentEdited);
      $icon.css({
        display: "block"
      });

      Previewer.setDocDir(utils.getDefaultBaseDir(currentDoc));

      if (viewerOn) {
        activatePanel();
      }
    } else {
      $icon.css({
        display: "none"
      });
      Previewer.deactivate();
    }
  }

  function toggleVisibility() {
    if (viewerOn) {
      viewerOn = false;
      $icon.removeClass("active");
      Previewer.close();
    } else {
      viewerOn = true;
      $icon.addClass("active");
      activatePanel();
    }
  }

  function scrollToPreviewLocation() {
    var editor = EditorManager.getCurrentFullEditor();
    var cursor = editor.getCursorPos();
    if (cursor) {
      var $elem = null;
      // getCursorPos starts with line 0
      var line = cursor.line + 2;
      var doc = $iframe.contents().find('#body-text');
      do {
        line--;
        $elem = doc.find('[class~=data-line-' + line + ']');
      } while (line >= 0 && $elem.length === 0);

      var blockPos = $elem.position();
      if (blockPos !== undefined) {
        $iframe[0].contentWindow.scrollTo(0, blockPos.top);
      }
      editor.focus();
      editor.setCursorPos(cursor, true);
    }
  }

  // Insert CSS for this extension
  ExtensionUtils.loadStyleSheet(module, "styles/AsciidocPreview.css");

  // Add toolbar icon
  $icon = $("<a>")
    .attr({
      id: "asciidoc-preview-icon",
      href: "#"
    })
    .css({
      display: "none"
    })
    .click(toggleVisibility)
    .appendTo($("#main-toolbar .buttons"));

  // Add a document change handler
  MainViewManager.on("currentFileChange", currentDocChangedHandler);
  // Detect if file changed on disk
  FileSystem.on("change", updateOnSaveHandler);

  // currentDocumentChange is *not* called for the initial document. Use
  // appReady() to set initial state.
  AppInit.appReady(function () {
    currentDocChangedHandler();
  });
});
