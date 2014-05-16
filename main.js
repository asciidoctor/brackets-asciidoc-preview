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

    // Local modules
    var opal = require("lib/opal");
    var asciidoctor = require("lib/asciidoctor");
    var asciidoctor_ext = require("lib/asciidoctor_extensions");

    // jQuery objects
    var $icon,
        $iframe,
        $panel,
        $settingsToggle,
        $settings;

    // Other vars
    var currentDoc,
        panel,
        visible = false,
        realVisibility = false,
        baseDirEdited = false;

    // Prefs
    var _prefs = PreferencesManager.getExtensionPrefs("asciidoc-preview");
    _prefs.definePreference("showtitle", "boolean", true);
    _prefs.definePreference("showtoc", "boolean", true);
    _prefs.definePreference("numbered", "boolean", false);
    _prefs.definePreference("theme", "string", "default");
    _prefs.definePreference("safemode", "string", "safe");
    _prefs.definePreference("basedir", "string", "");
    _prefs.definePreference("doctype", "string", "article");


    // (based on code in brackets.js)
    function _handleLinkClick(e) {
        // Check parents too, in case link has inline formatting tags
        var node = e.target,
            location,
            url;
        while (node) {
            if (node.tagName === "A") {
                url = node.getAttribute("href");
                if (url) {
                  if (!url.match(/^#/)) {
                      NativeApp.openURLInDefaultBrowser(url);
                  } else {
                    location = $iframe.contents()[0].getElementById(url.substr(1));
                    $iframe.contents()[0].defaultView.scrollTo(0, location.offsetTop);
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

    // HACK: Fix relative include and image paths
    // Relative paths in asciidoc should be relative to base_dir.
    // Apparently, asciidoctor.js does not honor base_dir for include::
    // directives.
    // This function prepends all relative paths of the directive
    // with {docdir} to make them absolute. Paths starting with
    //
    //    '{', '/', 'file:', 'http:', 'https:', '[A-Z]:'
    //
    // are considered absolute and are not not modified.

    function fixRelativeIncludes(text) {
        text = text.replace(/(include::)(?!\{)(?!\/)(?![a-zA-Z]+:)(?!file:)(?!http:)(?!https:)/g, "$1{docdir}/");
        //text = text.replace(/(image:[:]*)(?!\{)(?!\/)(?![a-zA-Z]+:)(?!file:)(?!http:)(?!https:)/g, "$1{docdir}/");
        return text;
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

            var defaultAttributes = 'icons=font@ platform=opal platform-opal source-highlighter=highlight.js';
            var numbered = _prefs.get("numbered") ? 'numbered' : 'numbered!';
            var showtitle = _prefs.get("showtitle") ? 'showtitle' : 'showtitle!';
            var showtoc = _prefs.get("showtoc") ? 'toc toc2' : 'toc! toc2!';
            var safemode = _prefs.get("safemode") || "safe";
            var doctype = _prefs.get("doctype") || "article";

            if (!baseDirEdited) {
                _prefs.set("basedir", FileUtils.getDirectoryPath(doc.file.fullPath));
            }

            // Make <base> tag for relative URLS
            var baseUrl = window.location.protocol + "//" + FileUtils.getDirectoryPath(doc.file.fullPath);
            var basedir = _prefs.get("basedir") || baseUrl;

            var attributes = defaultAttributes.concat(' ').concat(numbered).concat(' ').concat(showtitle).concat(' ').concat(showtoc);
            var opts = Opal.hash2(['base_dir', 'safe', 'doctype', 'attributes'], {
                'base_dir': basedir,
                'safe': safemode,
                'doctype': doctype,
                'attributes': attributes
            });

            // HACK: Fix relative paths
            docText = fixRelativeIncludes(docText);

            // Parse asciidoc into HTML
            bodyText = Opal.Asciidoctor.$render(docText, opts);

            // Show URL in link tooltip
            bodyText = bodyText.replace(/(href=\"([^\"]*)\")/g, "$1 title=\"$2\"");

            // Assemble the HTML source
            var htmlSource = "<html><head>";
            var theme = _prefs.get("theme");
            htmlSource += "<base href='" + baseUrl + "'>";
            htmlSource += "<link href='" + require.toUrl("./themes/" + theme + ".css") + "' rel='stylesheet'></link>";
            htmlSource += "<link href='" + require.toUrl("./styles/font-awesome/css/font-awesome.css") + "' rel='stylesheet'></link>";
            htmlSource += "<link href='" + require.toUrl("./styles/highlightjs/styles/googlecode.css") + "' rel='stylesheet'></link>";
            htmlSource += "<script src='" + require.toUrl("./styles/highlightjs/highlight.pack.js") + "'></script>";
            htmlSource += "<script>hljs.initHighlightingOnLoad();</script>";


            htmlSource += "</head><body onload='document.body.scrollTop=" + scrollPos + "'>";
            htmlSource += bodyText;
            htmlSource += "</body></html>";
            $iframe.attr("srcdoc", htmlSource);

            // Open external browser when links are clicked
            // (similar to what brackets.js does - but attached to the iframe's document)
            $iframe.load(function () {
                $iframe[0].contentDocument.body.addEventListener("click", _handleLinkClick, true);
            });
        }
    }

    var _timer;

    function _documentChange(e) {
        // "debounce" the page updates to avoid thrashing/flickering
        // Note: this should use Async.whenIdle() once brackets/pull/5528
        // is merged.
        if (_timer) {
            window.clearTimeout(_timer);
        }
        _timer = window.setTimeout(function () {
            _timer = null;
            _loadDoc(e.target, true);
        }, 300);
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

        $settings.find("#asciidoc-preview-showtoc")
            .prop("checked", _prefs.get("showtoc") || true)
            .change(function (e) {
                _prefs.set("showtoc", e.target.checked);
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

        if (doc && /adoc|ad|asciidoc|asc/.test(ext)) {
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
