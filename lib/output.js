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

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */

define(function (require, exports) {
  "use strict";

  var utils = require("lib/utils");

  var lastDocState = [];
  var lastOutlineState = [];

  function createDocState(inputData, result) {
    var state = [];
    Object.keys(inputData).forEach(function (key) {
      if (key !== 'docText') { // skip full source text
        state.push(inputData[key] + "");
      }
    });

    state.push(result.stem + "");
    state.push(result.sourceHighlighter);

    result.messages.forEach(function (msg) {
      state.push(msg);
    });

    return state;
  }

  function createOutlineState(result) {
    var state = [];
    if (result.outline !== null) {
      result.outline.forEach(function (outl) {
        state.push(outl.level + '_' + outl.id + '_' + outl.title);
      });
    }
    return state;
  }


  function needsFullUpdate(inputData, result) {
    var prevDocState = lastDocState;
    lastDocState = createDocState(inputData, result);
    if (prevDocState.length != lastDocState.length) {
      return true;
    }
    for (var i = 0; i < prevDocState.length; i++) {
      if (prevDocState[i] !== lastDocState[i]) {
        return true;
      }
    }
    return false;
  }

  function needsOutlineUpdate(result) {
    var prevOutlineState = lastOutlineState;
    lastOutlineState = createOutlineState(result);
    if (prevOutlineState.length != lastOutlineState.length) {
      return true;
    }
    for (var i = 0; i < prevOutlineState.length; i++) {
      if (prevOutlineState[i] !== lastOutlineState[i]) {
        return true;
      }
    }
    return false;
  }


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
      '  showProcessingMessages: false, ' +
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
      '  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_HTMLorMML&skipStartupTypeset=true">' +
      '</script>' +
      '<script>' +
      '  function startMath() { MathJax.Hub.queue.Resume(); MathJax.Hub.Queue(["Typeset", MathJax.Hub, document.getElementById("body-text")]); }' +
      '  function stopMath() { MathJax.Hub.queue.Suspend();}' +
      '</script>';
  }


  /**
   * Set automatic tooltips aon links and add other handlers.
   * @returns {String} script as a string
   */
  function addCommonScripts() {
    return '<script>' +
        // Add handler for closing outline an click into document
      '  var trigger = document.body.querySelector("#asciidoc-outl-trigger"); ' +
      '  document.body.querySelector("#content").addEventListener("click", ' +
      '    function(e) { trigger.checked = false; });' +
      '  function goto(id){window.scroll(0, document.getElementById(id).offsetTop);}' +
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
   * Create outline panel.
   */
  function outlinePanel(baseUrl) {
    var trigger = '<input type="checkbox" id="asciidoc-outl-trigger" class="asciidoc-outl-trigger" style="display: none;"/><label id="asciidoc-outl-label" for="asciidoc-outl-trigger" style="display: none;"></label>';
    var frame = '<iframe id="asciidoc-outl-frame" name="asciidoc-outl-frame" seamless style="display: none;"></iframe>';

    return trigger + frame;
  }

  /**
   * Create a HTML document from the data returned by the web worker.
   * @param   {Object}   inputData original data passed to web worker
   * @param   {Object}   result      converted data returned from web worker
   * @returns {String}   HTML document
   */
  function createDocument(inputData, result) {

    var baseUrl = utils.toUrl(inputData.baseDir) + '/';
    var messages = result.messages;
    var bodyText = result.html;

    // Assemble the HTML source
    var htmlSource = '<!DOCTYPE html><html><head>';
    htmlSource += '<base href="' + baseUrl + '">';
    htmlSource += '<link rel="stylesheet" href="' + require.toUrl("../themes/" + inputData.theme + ".css") + '"></link>';
    htmlSource += '<link rel="stylesheet" href="' + require.toUrl("../styles/console.css") + '"></link>';
    htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.5.0/css/font-awesome.min.css">';
    if (result.sourceHighlighter === 'highlightjs') {
      htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/styles/github.min.css">';
    } else if (result.sourceHighlighter === 'prettify') {
      htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.css">';
    }

    htmlSource += '<style type="text/css">#header, #content, #footnotes { max-width: 100%; padding-left: 50px; padding-right: 50px; }</style>';

    if (inputData.renderMath) {
      htmlSource += mathJax();
    }

    htmlSource += '</head><body class="' + inputData.doctype + '">';

    htmlSource += outlinePanel(baseUrl);

    htmlSource += '<div id="content" class="content-wrapper">';
    htmlSource += '<div id="asciidoc-preview-console" style="display: none"><pre id="asciidoc-console-box"></pre></div>';
    htmlSource += '<div id="body-text"></div></div>';


    if (result.sourceHighlighter === 'highlightjs') {
      htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/highlight.min.js"></script>';
    } else if (result.sourceHighlighter === 'prettify') {
      htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.js"></script>';
    }

    htmlSource += addCommonScripts();
    htmlSource += "</body></html>";
    return htmlSource;
  }

  exports.update = function ($iframe, isNewDocument, inputData, result, onUpdatedCallback) {

    function updateContent() {

      var baseUrl = utils.toUrl(inputData.baseDir) + '/';
      var body = $iframe.contents()[0].body;

      if (result.messages.length) {
        var msgHtml = '';
        result.messages.forEach(function (msg) {
          msgHtml += asUrl(msg) + '<p/>';
        });

        $(body).find('#asciidoc-console-box').html(msgHtml);
        $(body).find('#asciidoc-preview-console').show();
      } else {
        $(body).find('#asciidoc-preview-console').hide();
      }

      var $outlineFrame = $(body).find('#asciidoc-outl-frame');
      var $outlineTrigger = $(body).find('#asciidoc-outl-trigger');
      var $outlineLabel = $(body).find('#asciidoc-outl-label');
      if (result.outline != null) {
        $outlineFrame.attr('srcdoc', srcDoc(result.outline, baseUrl));
        $outlineFrame.show();
        $outlineTrigger.show();
        $outlineLabel.show();
      } else {
        $outlineTrigger.hide();
        $outlineFrame.hide();
        $outlineLabel.hide();
      }


      if (inputData.renderMath) {
        $iframe[0].contentWindow.stopMath();
      }

      $(body).find('#body-text').html(result.html);

      if (result.stem && inputData.renderMath) {
        $iframe[0].contentWindow.startMath();
      }

      // Highlight source code
      if (result.sourceHighlighter === 'highlightjs') {
        $('pre code', body).each(function (i, block) {
          $iframe[0].contentWindow.hljs.highlightBlock(block);
        });
      } else if (result.sourceHighlighter === 'prettify') {
        $iframe[0].contentWindow.prettyPrint();
      }

      // update link titles
      $iframe.contents().find('a[href]:not([title])').each(function (index, link) {
        link.setAttribute("title", link.getAttribute("href"));
      });




      onUpdatedCallback();
    }


    if (isNewDocument || needsFullUpdate(inputData, result)) {
      $iframe.off('load');
      $iframe.on('load', updateContent);
      $iframe.attr("srcdoc", createDocument(inputData, result));
    } else {
      updateContent();
    }
  };
});