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

define(function (require, exports, module) {
    "use strict";

    // Check if message contains a line number and convert
    // to special #goto_ fragment identifier
    function asUrl(message) {
        var matches = message.match(/\s[0-9]+:\s/)
        if (matches && matches.length > 0) {
            var linenum = matches[0].match(/[0-9]+/);
            return '<a href="#goto_' + linenum + '">' + message + '</a>';
        } else {
            return message;
        }
    }
    
    exports.createPage = function (bodyText, messages, baseUrl, scrollPos, theme) {
        // Show URL in link tooltip
        bodyText = bodyText.replace(/(href=\"([^\"]*)\")/g, "$1 title=\"$2\"");
        // Assemble the HTML source
        var htmlSource = "<html><head>";
        htmlSource += "<base href='" + baseUrl + "'>";
        htmlSource += "<link href='" + require.toUrl("../themes/" + theme + ".css") + "' rel='stylesheet'></link>";
        htmlSource += "<link href='" + require.toUrl("../styles/console.css") + "' rel='stylesheet'></link>";
        htmlSource += "<link href='" + require.toUrl("../styles/font-awesome/css/font-awesome.min.css") + "' rel='stylesheet'></link>";
        htmlSource += "<link href='" + require.toUrl("../styles/highlightjs/styles/default.min.css") + "' rel='stylesheet'></link>";
        htmlSource += "<script src='" + require.toUrl("../styles/highlightjs/highlight.min.js") + "'></script>";
        htmlSource += "<script>hljs.initHighlightingOnLoad();</script>";
        htmlSource += "<style type='text/css'>#header, #content, #footnotes { max-width: 100%; padding-left: 50px; padding-right: 50px; }</style>";
        htmlSource += "</head><body onload='document.body.scrollTop=" + scrollPos + "'><div id='content'>";
        htmlSource += bodyText + "</div>";

        if (messages.length) {
            htmlSource += '<div id="asciidoc-preview-console"><pre id="asciidoc-console-box">'
            messages.forEach(function (msg) {
                msg = asUrl(msg);
                htmlSource += msg + "<p/>";
            });
            htmlSource += "</pre></div>";
        }
        htmlSource += "</body></html>";
        return htmlSource;
    };
});
