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
/*global define, $, Image */

define(function (require, exports) {
  "use strict";

  // Fn to allow an event to fire after all images are loaded
  $.fn.imagesLoaded = function () {
    // get all the images (excluding those with no src attribute)
    var $imgs = this.find('img[src!=""]');
    // if there's no images, just return an already resolved promise
    if (!$imgs.length) {
      return $.Deferred().resolve().promise();
    }

    // for each image, add a deferred object to the array which resolves 
    // when the image is loaded (or if loading fails)
    var dfds = [];
    $imgs.each(function () {
      var dfd = $.Deferred();
      dfds.push(dfd);
      var img = new Image();
      img.onload = function () {
        dfd.resolve();
      };
      img.onerror = function () {
        dfd.resolve();
      };
      img.src = this.src;

    });

    // return a master promise object which will resolve when all the deferred objects have resolved
    // IE - when all the images are loaded
    return $.when.apply($, dfds);
  };

  var utils = require("lib/utils");

  // Array to keep all important configuration
  // strings from last run.
  var lastDocState = [];

  // create an array with relevant document configuration strings
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

  // When called through an update, returns true if 
  // the document needs to be fully re-created. 
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

  // configure and load MathJax
  function mathJax() {
    return '<script type="text/x-mathjax-config">' +
      'MathJax.Hub.Config({' +
      '  showProcessingMessages: false, ' +
      '  showMathMenu: true,' +
      '  imageFont: null,' +
      '  jax: ["input/TeX","input/AsciiMath","output/HTML-CSS"],' +
      '  extensions: ["tex2jax.js","asciimath2jax.js"],' +
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
      '  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?skipStartupTypeset=true">' +
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
      // scroll item with id into view
      '  function goto(id){var el = document.getElementById(id); window.scroll(0, (el != null)?el.offsetTop:0);}' +
      '</script>';
  }

  function addUserCSS(cssFiles) {
    var s = '';
    cssFiles.forEach(function(file) {
      s += '<link rel="stylesheet" href="' + require.toUrl(file) + '">';
    });
    return s;
  }
  
  function addUserScripts(scriptFiles) {
    var s = '';
    scriptFiles.forEach(function(file) {
      s += '<script src="' + require.toUrl(file) + '"></script>';
    });
    return s;
  }
  
  function replaceAll(str, str1, str2) {
    return str.replace(new RegExp(str1, "g"), str2);
  }

  // escape dangerous HTML
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
  function outlinePanel() {
    var trigger = '<input type="checkbox" id="asciidoc-outl-trigger" class="asciidoc-outl-trigger" style="display: none;"/>';
    var label = '<label id="asciidoc-outl-label" for="asciidoc-outl-trigger" style="display: none;"></label>';
    var frame = '<iframe id="asciidoc-outl-frame" name="asciidoc-outl-frame" seamless style="display: none;"></iframe>';
    return trigger + label + frame;
  }

  /**
   * Create HTML document shell without actual content
   * @param   {Object}   inputData original data passed to web worker
   * @returns {String}   HTML document
   */
  function createDocument(inputData) {
    var baseUrl = utils.toUrl(inputData.baseDir) + '/';

    // Assemble the HTML source
    var htmlSource = '<!DOCTYPE html><html><head>';
    htmlSource += '<base href="' + baseUrl + '">';
    htmlSource += '<link rel="stylesheet" href="' + require.toUrl(inputData.theme) + '">';
    htmlSource += '<link rel="stylesheet" href="' + require.toUrl("../styles/console.css") + '">';
    htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.5.0/css/font-awesome.min.css">';
    htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/styles/github.min.css">';
    htmlSource += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.css">';
    htmlSource += addUserCSS(inputData.userExtensions.styles);
    htmlSource += '<style type="text/css">#header, #content, #footnotes { max-width: 100%; padding-left: 50px; padding-right: 50px; }</style>';
    
    htmlSource += addUserScripts(inputData.userExtensions.scriptsPrepend);
    
    if (inputData.renderMath) {
      htmlSource += mathJax();
    }
    
    htmlSource += '</head><body class="' + inputData.doctype + '">';

    htmlSource += outlinePanel();

    htmlSource += '<div id="content" class="content-wrapper">';
    htmlSource += '<div id="asciidoc-preview-console" style="display: none"><pre id="asciidoc-console-box"></pre></div>';
    htmlSource += '<div id="body-text"></div></div>';

    htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/8.8.0/highlight.min.js"></script>';
    htmlSource += '<script src="https://cdnjs.cloudflare.com/ajax/libs/prettify/r298/prettify.min.js"></script>';

    htmlSource += addCommonScripts();
    htmlSource += addUserScripts(inputData.userExtensions.scriptsAppend);
    htmlSource += "</body></html>";
    return htmlSource;
  }

  /**
   * Render document.
   * @param   {Object}   $iframe view to render into
   * @param   {boolean}  isNewDocument true if this is a new document, false otherwise
   * @param   {Object}   inputData original data as passed to web worker
   * @param   {Object}   result converted data returned from web worker
   * @param   {function} callback to be called when rendering is complete
   */
  exports.render = function ($iframe, isNewDocument, inputData, result, onCompleteCallback) {
    function updateContent() {
      var baseUrl = utils.toUrl(inputData.baseDir) + '/';
      var body = $iframe.contents()[0].body;

      $iframe[0].contentWindow.scrollTo(0, body.scrollTop);

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

      $(body).find('#body-text').html(result.html).imagesLoaded().then(function () {
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

        // make page anchors work and add titles to links
        $iframe.contents().find('a[href]').each(function (index, link) {
          var href = link.getAttribute("href");
          if (href.match(/^#/)) {
            $(link).attr('onclick', 'goto("' + href.substring(1) + '");return false;');
          }
          var title = link.getAttribute('title');
          if (!title) {
            link.setAttribute("title", href);
          }
        });

        onCompleteCallback();
      });
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