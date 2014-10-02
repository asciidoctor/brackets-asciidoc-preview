/*
 * Copyright (c) 2012 Glenn Ruehle
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
 * Modified for AsciiDoc
 * Copyright (c) 2014 Thomas Kern
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
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        FileUtils = brackets.getModule("file/FileUtils"),
        LanguageManager = brackets.getModule("language/LanguageManager"),
        PanelManager = brackets.getModule("view/PanelManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    
    // Templates
    var panelHTML = require("text!templates/panel.html");
    
    // jQuery objects
    var $icon,
        $iframe,
        $panel;

    // Other vars
    var currentDoc,
        panel,
        fileExtensions = ["ad", "adoc", "asciidoc", "asc"],
        visible = false,
        realVisibility = false;

    // Define AsciiDoc mode
    require("mode/asciidoc");
    LanguageManager.defineLanguage("asciidoc", {
        name: "AsciiDoc",
        mode: "asciidoc",
        fileExtensions: fileExtensions,
        blockComment: ["////", "////"],
        lineComment: ["//"]
    });
    
    // Prefs
    var prefs = PreferencesManager.getExtensionPrefs("asciidoc-preview");
    prefs.definePreference("showtitle", "boolean", true);
    prefs.definePreference("numbered", "boolean", false);
    prefs.definePreference("mjax", "boolean", false);
    prefs.definePreference("autosync", "boolean", false);
    prefs.definePreference("updatesave", "boolean", false);
    prefs.definePreference("theme", "string", "asciidoctor");
    prefs.definePreference("safemode", "string", "safe");
    prefs.definePreference("basedir", "string", "");
    prefs.definePreference("doctype", "string", "article");
    
    // Webworker for AscciDoc into HTML conversion
    var converterWorker = new Worker(ExtensionUtils.getModulePath(module, "lib/converter-worker.js"));
    // assembly of final HTML page
    var output = require("lib/output"),
        // utils for handling syncing between editor an preview panes
        syncEdit = require("lib/sync"),
        settingsPanel = require("lib/settings");
    
    // time needed for the latest conversion in ms
    var lastDuration = 500;
    // timestamp when conversion started
    var conversionStart = 0;
    // current editing location info in generated HTML
    var previewLocationInfo = null,
        outline = null,
        updateOnSave = prefs.get("updatesave"),
        autosync = prefs.get("autosync");
    
    

    // (based on code in brackets.js)
    function handleLinkClick(e) {
        // Check parents too, in case link has inline formatting tags
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
                        jumpToLine(parseInt(url.substr(6), 10) - 1);
                    }
                } 
                e.preventDefault();
                break;
            }
            node = node.parentElement;
        }
        // Close settings dropdown, if open
        settingsPanel.hide();
    }

    /**
     * Jump to specified line in source editor. Centers
     * line in view.
     */
    function jumpToLine(line) {
        var editor = EditorManager.getCurrentFullEditor();
        editor.setCursorPos(line, 0, true);
        editor.focus();
        
        var codeMirror = editor._codeMirror;
        codeMirror.addLineClass(line, "wrap", "flash");
        window.setTimeout(function () {
            codeMirror.removeLineClass(line, "wrap", "flash");
        }, 1000);
    }
    
    function loadDoc(doc, preserveScrollPos) {
        if (doc && visible && $iframe) {
            var docText = doc.getText(),
                scrollPos = 0,
                yamlRegEx = /^-{3}([\w\W]+?)(-{3})/,
                yamlMatch = yamlRegEx.exec(docText);

            // If there's yaml front matter, remove it.
            if (yamlMatch) {
                docText = docText.substr(yamlMatch[0].length);
            }

            if (preserveScrollPos) {
                scrollPos = $iframe.contents()[0].body.scrollTop;
            } else {
                scrollPos = 0;
                previewLocationInfo = null;
            }

            var defaultAttributes = 'icons=font@ ' +
                                    'platform=opal platform-opal ' +
                                    'env=browser env-browser ' +
                                    'sectids ' + // force generation of section ids
                                    'source-highlighter=highlight.js';
            var numbered = prefs.get("numbered") ? 'numbered' : 'numbered!';
            var showtitle = prefs.get("showtitle") ? 'showtitle' : 'showtitle!';
            var safemode = prefs.get("safemode") || "safe";
            var doctype = prefs.get("doctype") || "article";
            
            // Make <base> tag for relative URLS
            var baseUrl = window.location.protocol + "//" + FileUtils.getDirectoryPath(doc.file.fullPath);
            // baseDir will be used as the base URL to retrieve include files via Ajax requests
            var basedir = prefs.get("basedir") ||
                window.location.protocol.concat('//').concat(FileUtils.getDirectoryPath(doc.file.fullPath)).replace(/\/$/, '');

            var attributes = defaultAttributes.concat(' ').concat(numbered).concat(' ').concat(showtitle);

            // structure to pass docText, options, and attributes.
            var data = {
                docText: docText,
                // current working directory
                pwd: FileUtils.getDirectoryPath(window.location.href),
                // Asciidoctor options
                basedir: basedir,
                safemode: safemode,
                doctype: doctype,
                // Asciidoctor attributes
                attributes: attributes
            };
            
            if (lastDuration >= 500 || !preserveScrollPos) {
               displaySpinner(true);
            }
            
            // perform conversion in worker thread
            conversionStart = new Date().getTime();
            converterWorker.postMessage(data);

            converterWorker.onmessage = function (e) {
                lastDuration = e.data.duration;
                outline = e.data.outline;
                
                var theme = prefs.get("theme");
                if (theme == "default") { // recover from deprecated setting
                    theme = "asciidoctor";
                }
                
                var $locButton = $("#asciidoc-sync-location-button");
                if (outline) {
                    $locButton.show();
                    updatePreviewLocation();
                } else {
                    $locButton.hide();
                }
                               
                if (autosync) {
                    var pos = syncEdit.getTopPos($iframe[0], previewLocationInfo);
                    if (pos) {
                        scrollPos = pos;
                    }
                }
                var html = output.createPage(e.data, baseUrl, scrollPos, prefs);
                $iframe.attr("srcdoc", html);
                conversionStart = 0;
                displaySpinner(false);
            };

            $iframe.load(function () {
                // Open external browser when links are clicked
                // (similar to what brackets.js does - but attached to the iframe's document)
                $iframe[0].contentDocument.body.addEventListener("click", handleLinkClick, true);
                
                if (prefs.get("mjax") && !this.contentWindow.MathJax) {
                    prefs.set("mjax", false); 
                    alert("'MathJax' could not be accessed online and is also not available from cache. " +
                          "You are either working offline or access to the internet failed. " +
                          "Rendering of mathematical expressions has been switched off.");
                }
            });
        }
    }

    var timer;
    
    function documentChange(e) {
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
            loadDoc(e.target, true);
        }, timeout);
    }

    function resizeIframe() {
        if (visible && $iframe) {
            var iframeWidth = panel.$panel.innerWidth();
            $iframe.attr("width", iframeWidth + "px");
        }
    }

    function updateSettings() {
        // Save preferences
        prefs.save();
        updateOnSave = prefs.get("updatesave");
        autosync = prefs.get("autosync");
        // Re-render
        loadDoc(currentDoc, true);
    }

    
    function setPanelVisibility(isVisible) {
        if (isVisible === realVisibility) {
            return;
        }

        realVisibility = isVisible;
        if (isVisible) {
            if (!panel) {
                $panel = $(panelHTML);
                $iframe = $panel.find("#panel-asciidoc-preview-frame");

                panel = PanelManager.createBottomPanel("asciidoc-preview-panel", $panel);
                $panel.on("panelResizeUpdate", function (e, newSize) {
                    $iframe.attr("height", newSize);
                });
                $iframe.attr("height", $panel.height());

                window.setTimeout(resizeIframe);

                // create settings panel
                settingsPanel.create($panel, prefs, updateSettings);
                
                // attach handler to sync-location-button
                $("#asciidoc-sync-location-button")
                    .click(function (e) {
                         updatePreviewLocation(true);
                    });
            }
            loadDoc(DocumentManager.getCurrentDocument());
            $icon.toggleClass("active");
            panel.show();
        } else {
            $icon.toggleClass("active");
            panel.hide();
        }
    }

    function currentDocChangedHandler() {
        var doc = DocumentManager.getCurrentDocument(),
            ext = doc ? FileUtils.getFileExtension(doc.file.fullPath).toLowerCase() : "";

        if (currentDoc) {
            $(currentDoc).off("change", documentChange);
            currentDoc = null;
        }

        if (doc && fileExtensions.indexOf(ext) != -1) {
            if (doc != currentDoc) {
                prefs.set("basedir", FileUtils.getDirectoryPath(doc.file.fullPath));
            }
            currentDoc = doc;
            $(currentDoc).on("change", documentChange);
            $icon.css({
                display: "block"
            });
            setPanelVisibility(visible);
            loadDoc(doc);
        } else {
            $icon.css({
                display: "none"
            });
            setPanelVisibility(false);
        }
    }

    function toggleVisibility() {
        visible = !visible;
        setPanelVisibility(visible);
    }
    
    /**
     * Updates global variable previewLocationInfo with information
     * corresponding to the current position of the text cursor.
     *
     * @param {Boolean} sync if true, scrolls corresponding positions
     *                       of preview pane and text cursor position into view. 
     */
    function updatePreviewLocation(sync) {
        var editor = EditorManager.getCurrentFullEditor();
        var cursor = editor.getCursorPos();
        if (outline && cursor) {
            // store current editing location info with respect to HTML
            previewLocationInfo = syncEdit.findLocationInfo(outline, cursor.line + 1);
            if (previewLocationInfo) {
                previewLocationInfo.lineno = cursor.line + 1;
            }
            if (sync) {
                var topPos = syncEdit.getTopPos($iframe[0], previewLocationInfo);
                $iframe[0].contentWindow.scrollTo(0, topPos);
                editor.setCursorPos(cursor, true);
                editor.focus();
            }
        }
    }
    
    /**
     * Shows or hides a busy indicator
     * @param {Boolean} show display indicator on true, hide on false
     */
    function displaySpinner(show) {
        var $spinner = $("#asciidoc-busy-spinner");
        
        if (show) {
            $spinner.show();
        } else {
            $spinner.hide();
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
    $(DocumentManager).on("currentDocumentChange", currentDocChangedHandler);
    
    // Detect if file changed on disk
    FileSystem.on("change", function(event, entry) {
        if (updateOnSave && entry && currentDoc && entry.fullPath == currentDoc.file.fullPath) {
            loadDoc(currentDoc, true);
        }
    });
                  
    // currentDocumentChange is *not* called for the initial document. Use
    // appReady() to set initial state.
    AppInit.appReady(function () {
        currentDocChangedHandler();
    });

    // Listen for resize events
    $(PanelManager).on("editorAreaResize", resizeIframe);
    $("#sidebar").on("panelCollapsed panelExpanded panelResizeUpdate", resizeIframe);
});
