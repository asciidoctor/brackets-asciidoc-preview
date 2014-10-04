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

/*global define, brackets, $ */

/** @Module settings */

define(function (require, exports) {
    "use strict";

    var PopUpManager = brackets.getModule("widgets/PopUpManager"),
        settingsHTML = require("text!templates/settings.html"),
        $settings,
        $settingsToggle;


    function documentClicked(e) {
        if (!$settings.is(e.target) &&
            !$settingsToggle.is(e.target) &&
            $settings.has(e.target).length === 0) {
            hideSettings();
        }
    }

    function hideSettings() {
        if ($settings) {
            $settings.remove();
            $settings = null;
            $(window.document).off("mousedown", documentClicked);
        }
    }
    
    function createSettings($panel, prefs, updateCallback) {

        function showSettings() {

            hideSettings();

            $settings = $(settingsHTML)
                .css({
                    right: 12,
                    top: $settingsToggle.position().top + $settingsToggle.outerHeight() + 12
                })
                .appendTo($panel);

            $settings.find("#asciidoc-preview-showtitle")
                .prop("checked", prefs.get("showtitle") || true)
                .change(function (e) {
                    prefs.set("showtitle", e.target.checked);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-numbered")
                .prop("checked", prefs.get("numbered"))
                .change(function (e) {
                    prefs.set("numbered", e.target.checked);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-mjax")
                .prop("checked", prefs.get("mjax"))
                .change(function (e) {
                    prefs.set("mjax", e.target.checked);
                    updateCallback();
                });

            $settings.find("#asciidoc-autosync")
                .prop("checked", prefs.get("autosync"))
                .change(function (e) {
                    prefs.set("autosync", e.target.checked);
                    updateCallback();
                });

            $settings.find("#asciidoc-update-save")
                .prop("checked", prefs.get("updatesave"))
                .change(function (e) {
                    prefs.set("updatesave", e.target.checked);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-theme")
                .val(prefs.get("theme"))
                .change(function (e) {
                    prefs.set("theme", e.target.value);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-safemode")
                .val(prefs.get("safemode"))
                .change(function (e) {
                    prefs.set("safemode", e.target.value);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-doctype")
                .val(prefs.get("doctype"))
                .change(function (e) {
                    prefs.set("doctype", e.target.value);
                    updateCallback();
                });

            $settings.find("#asciidoc-preview-basedir")
                .val(prefs.get("basedir"))
                .change(function (e) {
                    prefs.set("basedir", e.target.value);
                    updateCallback();
                });

            PopUpManager.addPopUp($settings, hideSettings, true);
            $(window.document).on("mousedown", documentClicked);
        }

        if (!$settingsToggle) {
            $settingsToggle = $("#asciidoc-settings-toggle")
                .click(function (e) {
                    if ($settings) {
                        hideSettings();
                    } else {
                        showSettings(e);
                    }
                });
        }
    };
    
    exports.hide = hideSettings;
    exports.create = createSettings;
});
