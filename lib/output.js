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

/*global define */

define(function (require, exports) {
  "use strict";

  // Check if message contains a line number and convert
  // to special #goto_ fragment identifier
  function asUrl(message) {
    var matches = message.match(/\s[0-9]+:\s/);
    if (matches && matches.length > 0) {
      var linenum = matches[0].match(/[0-9]+/);
      return '<a href="#goto_' + linenum + '">' + message + '</a>';
    } else {
      return message;
    }
  }

  function mathJax() {
    return '<script type="text/x-mathjax-config">' +
      'MathJax.Hub.Config({' +
      '  imageFont: null,' +
      '  tex2jax: {' +
      '    inlineMath: [["\\\\(", "\\\\)"]],' +
      '    displayMath: [["\\\\[", "\\\\]"]],' +
      '    ignoreClass: "nostem|nostem|nolatexmath"' +
      '  },' +
      '  asciimath2jax: {' +
      '    delimiters: [["\\\\$", "\\\\$"]],' +
      '    ignoreClass: "nostem|nostem|noasciimath"' +
      '  }' +
      '});' +
      '</script>' +
      '<script type="text/javascript" ' +
      'src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_HTMLorMML">' +
      '</script>';
  }



  /**
   * Set automatic tooltips aon links and add other handlers.
   * @returns {String} script as a string
   */
  function addCommonScripts() {
    return '<script>' +
      // 
      '    var links = document.querySelectorAll("a[href]:not([title])");' +
      '    for (var i = 0, n = links.length; i < n; i++) {' +
      '        links[i].setAttribute("title", links[i].getAttribute("href") );' +
      '    }' +
      // Add handler for closing outline an click into document
      '    var trigger = document.body.querySelector("#asciidoc-outl-trigger"); ' +
      '    document.body.querySelector("#content").addEventListener("click", ' +
      '         function(e) { trigger.checked = false; });' +
      '</script>';
  }

  function replaceAll(str, str1, str2) {
    return str.replace(new RegExp(str1, "g"), str2);
  }

  function safeHtml(raw) {
    var s = replaceAll(raw, '<', '\u003c');
    s = replaceAll(s, '>', '\u003e');
    s = replaceAll(s, '"', '\u201d'); // HACK: replace with double left quotes!
    s = replaceAll(s, "'", '\u0027');
    s = replaceAll(s, '\\\\', '\u005c');
    return replaceAll(s, '&', '\u0026');
  }

  /**
   * Create document from outline.
   * @returns properly quoted HTML to be used as srcdoc value for iframe.
   */
  function srcDoc(outline, baseUrl) {
    // Assemble the HTML source
    var htmlSource = "<!DOCTYPE html><html><head><base href='" +
      baseUrl +
      "'><link href='" +
      require.toUrl("../styles/navigation.css") +
      "' rel=stylesheet></link></head><body><ul>";

    for (var i = 0; i < outline.length; i++) {
      var s = "<a href=javascript:; onclick=parent.goto('" + outline[i].id + "');>" + outline[i].title + '</a>';
      htmlSource += "<li class='level-" + outline[i].level + "'>" + s + "</li>";
    }
    htmlSource += "</ul></body></html>";

    // This mess needs to be properly quoted because we are going
    // to use it as the string value for iframe's srcdoc attribute.
    return safeHtml(htmlSource);
  }

  /**
   * Create panel for navigation.
   */
  function navigation(outline, baseUrl) {
    var goto = '<script>function goto(id){window.scroll(0, document.getElementById(id).offsetTop);}</script>';

    var trigger = '<input type="checkbox" id="asciidoc-outl-trigger" class="asciidoc-outl-trigger"/><label for="asciidoc-outl-trigger"></label>';

    var frame = '<iframe id="asciidoc-outl-frame" name="asciidoc-outl-frame" srcdoc="' +
      srcDoc(outline, baseUrl) + '" seamless></iframe>';

    return goto + trigger + frame;
  }

  /**
   * Create a HTML document from the data returned by the web worker.
   * @param   {Object}   data      converted data returned from web worker
   * @param   {[[Type]]} baseUrl   base URL to be used in HTML
   * @param   {String}   scrollPos offset from top of page
   * @param   {Object}   prefs     user preferences
   * @returns {String}   HTML document
   */
  exports.createPage = function (data, baseUrl, scrollPos, prefs) {

    var messages = data.messages;
    var bodyText = data.html;

    // Assemble the HTML source
    var htmlSource = '<!DOCTYPE html><html><head>';
    htmlSource += '<base href="' + baseUrl + '">';
    htmlSource += '<link href="' + require.toUrl("../themes/" + prefs.get("theme") + ".css") + '" rel="stylesheet"></link>';
    htmlSource += '<link href="' + require.toUrl("../styles/console.css") + '" rel="stylesheet"></link>';
    htmlSource += '<link href="' + require.toUrl("../styles/font-awesome/css/font-awesome.min.css") + '" rel="stylesheet"></link>';
    if (data.sourceHighlighter === 'highlightjs') {
      htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/styles/github.min.css">';
    } else if (data.sourceHighlighter === 'prettify') {
      htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.css">';
    }

    htmlSource += '<style type="text/css">#header, #content, #footnotes { max-width: 100%; padding-left: 50px; padding-right: 50px; }</style>';

    htmlSource += '</head><body class="' + prefs.get("doctype") + '" onload="document.body.scrollTop=' + scrollPos + '">';

    if (data.outline != null) {
      htmlSource += navigation(data.outline, baseUrl);
    }

    htmlSource += '<div id="content" class="content-wrapper">';
    if (messages.length) {
      htmlSource += '<div id="asciidoc-preview-console"><pre id="asciidoc-console-box">';
      messages.forEach(function (msg) {
        msg = asUrl(msg);
        htmlSource += msg + "<p/>";
      });
      htmlSource += "</pre></div>";
    }

    htmlSource += bodyText + "</div>";


    if (data.sourceHighlighter === 'highlightjs') {
      htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/highlight.min.js"></script>';
      htmlSource += '<script>hljs.initHighlightingOnLoad()</script>';
    } else if (data.sourceHighlighter === 'prettify') {
      htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.js"></script>';
      htmlSource += '<script>document.addEventListener("DOMContentLoaded", prettyPrint)</script>';
    }

    if (data.stem && prefs.get("mjax")) {
      htmlSource += mathJax();
    }
    htmlSource += addCommonScripts();
    htmlSource += "</body></html>";
    return htmlSource;
  };
});