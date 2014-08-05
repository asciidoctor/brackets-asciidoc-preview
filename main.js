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
/*global define, brackets, $, window, marked, _hideSettings */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var AppInit = brackets.getModule("utils/AppInit"),
        NativeApp = brackets.getModule("utils/NativeApp"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        LanguageManager = brackets.getModule("language/LanguageManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        FileUtils = brackets.getModule("file/FileUtils"),
        PanelManager = brackets.getModule("view/PanelManager"),
        PopUpManager = brackets.getModule("widgets/PopUpManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        Resizer = brackets.getModule("utils/Resizer"),
        StringUtils = brackets.getModule("utils/StringUtils");

    // Templates
    var panelHTML = require("text!templates/panel.html"),
        settingsHTML = require("text!templates/settings.html");
    
    // jQuery objects
    var $icon,
        $iframe,
        $panel,
        $settingsToggle,
        $settings;

    // Other vars
    var currentDoc,
        panel,
        fileExtensions = ["ad", "adoc", "asciidoc", "asc"],
        visible = false,
        realVisibility = false,
        baseDirEdited = false;

    // Define AsciiDoc mode
    require("mode/asciidoc");
    LanguageManager.defineLanguage("asciidoc", {
        name: "AsciiDoc",
        mode: "asciidoc",
        fileExtensions: fileExtensions,
        blockComment: ["////", "////"],
        lineComment: ["//"]
    });
    
    // Webworker for AscciDoc into HTML conversion
    var converterWorker = new Worker(ExtensionUtils.getModulePath(module, "lib/converter-worker.js"));
    // assembly of final HTML page
    var output = new require("lib/output");

    // time needed for the latest conversion in ms
    var lastDuration = 0;
    // timestamp when conversion started
    var conversionStart = 0;

    // Prefs
    var _prefs = PreferencesManager.getExtensionPrefs("asciidoc-preview");
    _prefs.definePreference("showtitle", "boolean", true);
    _prefs.definePreference("numbered", "boolean", false);
    _prefs.definePreference("theme", "string", "asciidoctor");
    _prefs.definePreference("safemode", "string", "safe");
    _prefs.definePreference("basedir", "string", "");
    _prefs.definePreference("doctype", "string", "article");


    // (based on code in brackets.js)
    function _handleLinkClick(e) {
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
        _hideSettings();
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
    
    function _loadDoc(doc, preserveScrollPos) {
        if (doc && visible && $iframe) {
            var docText = doc.getText(),
                scrollPos = 0,
                bodyText = "",
                yamlRegEx = /^-{3}([\w\W]+?)(-{3})/,
                yamlMatch = yamlRegEx.exec(docText);

            // If there's yaml front matter, remove it.
            if (yamlMatch) {
                docText = docText.substr(yamlMatch[0].length);
            }

            if (preserveScrollPos) {
                scrollPos = $iframe.contents()[0].body.scrollTop;
            }

            var defaultAttributes = 'icons=font@' 
                                  + ' platform=opal platform-opal' 
                                  + ' env=browser env-browser' 
                                  + ' source-highlighter=highlight.js';
            var numbered = _prefs.get("numbered") ? 'numbered' : 'numbered!';
            var showtitle = _prefs.get("showtitle") ? 'showtitle' : 'showtitle!';
            var safemode = _prefs.get("safemode") || "safe";
            var doctype = _prefs.get("doctype") || "article";

            if (!baseDirEdited) {
                _prefs.set("basedir", FileUtils.getDirectoryPath(doc.file.fullPath));
            }

            // Make <base> tag for relative URLS
            var baseUrl = window.location.protocol + "//" + FileUtils.getDirectoryPath(doc.file.fullPath);
            // baseDir will be used as the base URL to retrieve include files via Ajax requests
            var basedir = _prefs.get("basedir") ||
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

            conversionStart = new Date().getTime();
            converterWorker.postMessage(data);

            converterWorker.onmessage = function (e) {
                lastDuration = e.data.duration;
                conversionStart = 0;
                var theme = _prefs.get("theme");
                if (theme == "default") { // recover from deprecated setting
                    theme = "asciidoctor";
                }
                var html = output.createPage(e.data.html, e.data.messages, baseUrl, scrollPos, theme);
                $iframe.attr("srcdoc", html);
                conversionStart = 0;
            };


            // Open external browser when links are clicked
            // (similar to what brackets.js does - but attached to the iframe's document)
            $iframe.load(function () {
                $iframe[0].contentDocument.body.addEventListener("click", _handleLinkClick, true);
            });
        }
    }

    var _timer;

    function _documentChange(e) {
        // throttle updates
        if (_timer) {
            window.clearTimeout(_timer);
        }

        // Estimate timeout based on time needed for 
        // actual document conversion. Never longer than
        // 5000 ms.
        var timeout = lastDuration + 300;
        if (conversionStart > 0) {
            timeout = Math.min(timeout - new Date().getTime() + conversionStart, 5000);
        }

        _timer = window.setTimeout(function () {
            _timer = null;
            _loadDoc(e.target, true);
        }, timeout);
    }

    function _resizeIframe() {
        if (visible && $iframe) {
            var iframeWidth = panel.$panel.innerWidth();
            $iframe.attr("width", iframeWidth + "px");
        }
    }

    function _updateSettings() {
        // Save preferences
        _prefs.save();

        // Re-render
        _loadDoc(currentDoc, true);
    }

    function _documentClicked(e) {
        if (!$settings.is(e.target) &&
            !$settingsToggle.is(e.target) &&
            $settings.has(e.target).length === 0) {
            _hideSettings();
        }
    }

    function _hideSettings() {
        if ($settings) {
            $settings.remove();
            $settings = null;
            $(window.document).off("mousedown", _documentClicked);
        }
    }

    function _showSettings(e) {
        _hideSettings();

        $settings = $(settingsHTML)
            .css({
                right: 12,
                top: $settingsToggle.position().top + $settingsToggle.outerHeight() + 12
            })
            .appendTo($panel);

        $settings.find("#asciidoc-preview-showtitle")
            .prop("checked", _prefs.get("showtitle") || true)
            .change(function (e) {
                _prefs.set("showtitle", e.target.checked);
                _updateSettings();
            });

        $settings.find("#asciidoc-preview-numbered")
            .prop("checked", _prefs.get("numbered"))
            .change(function (e) {
                _prefs.set("numbered", e.target.checked);
                _updateSettings();
            });

        $settings.find("#asciidoc-preview-theme")
            .val(_prefs.get("theme"))
            .change(function (e) {
                _prefs.set("theme", e.target.value);
                _updateSettings();
            });

        $settings.find("#asciidoc-preview-safemode")
            .val(_prefs.get("safemode"))
            .change(function (e) {
                _prefs.set("safemode", e.target.value);
                _updateSettings();
            });

        $settings.find("#asciidoc-preview-doctype")
            .val(_prefs.get("doctype"))
            .change(function (e) {
                _prefs.set("doctype", e.target.value);
                _updateSettings();
            });

        $settings.find("#asciidoc-preview-basedir")
            .val(_prefs.get("basedir"))
            .change(function (e) {
                _prefs.set("basedir", e.target.value);
                baseDirEdited = true;
                _updateSettings();
            });

        PopUpManager.addPopUp($settings, _hideSettings, true);
        $(window.document).on("mousedown", _documentClicked);
    }

    function _setPanelVisibility(isVisible) {
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

                window.setTimeout(_resizeIframe);

                $settingsToggle = $("#asciidoc-settings-toggle")
                    .click(function (e) {
                        if ($settings) {
                            _hideSettings();
                        } else {
                            _showSettings(e);
                        }
                    });
            }
            _loadDoc(DocumentManager.getCurrentDocument());
            $icon.toggleClass("active");
            panel.show();
        } else {
            $icon.toggleClass("active");
            panel.hide();
        }
    }

    function _currentDocChangedHandler() {
        var doc = DocumentManager.getCurrentDocument(),
            ext = doc ? FileUtils.getFileExtension(doc.file.fullPath).toLowerCase() : "";

        if (currentDoc) {
            $(currentDoc).off("change", _documentChange);
            currentDoc = null;
        }

        if (doc && fileExtensions.indexOf(ext) != -1) {
            if (doc != currentDoc) {
                baseDirEdited = false;
            }
            currentDoc = doc;
            $(currentDoc).on("change", _documentChange);
            $icon.css({
                display: "block"
            });
            _setPanelVisibility(visible);
            _loadDoc(doc);
        } else {
            $icon.css({
                display: "none"
            });
            _setPanelVisibility(false);
        }
    }

    function _toggleVisibility() {
        visible = !visible;
        _setPanelVisibility(visible);
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
        .click(_toggleVisibility)
        .appendTo($("#main-toolbar .buttons"));

    // Add a document change handler
    $(DocumentManager).on("currentDocumentChange", _currentDocChangedHandler);

    // currentDocumentChange is *not* called for the initial document. Use
    // appReady() to set initial state.
    AppInit.appReady(function () {
        _currentDocChangedHandler();
    });

    // Listen for resize events
    $(PanelManager).on("editorAreaResize", _resizeIframe);
    $("#sidebar").on("panelCollapsed panelExpanded panelResizeUpdate", _resizeIframe);
});
