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

/*global define, $ */

/** @Module sync */

/**
 * @typedef LocationInfo
 * @type {object}
 * {string} sectionId - id of a section heading
 * {number} level - level of section, strating with 0
 * {number} blockIndex - index of paragraph inside section. -1 if denotes heading itself
 */

define(function (require, exports) {
  "use strict";

  /** Find location info based on line number. */
  exports.findLocationInfo = findLocationInfo;
  /** Scroll preview pane to location */
  exports.getTopPos = getTopPos;
  /** Find line number from top pixel offset */
  exports.getLineNumber = getLineNumber;

  /**
   * Retrieves location information from document outline, based
   * on a line number in the source document.
   * @param   {Object} outline information about sections, section levels, and blocks
   * @param   {Number} lineNumber current line number for which to find information
   * @returns {LocationInfo} an object with sectionId, level, and index into list of blocks.
   */
  function findLocationInfo(outline, lineNumber) {
    for (var i = outline.length - 1; i >= 0; i--) {
      // this line is a section heading
      if (outline[i].lineno == lineNumber) {
        return {
          sectionId: outline[i].id,
          level: outline[i].level,
          blockIndex: -1,
          lineno: outline[i].lineno
        };
        // current line is in this section
      } else if (outline[i].lineno < lineNumber) {
        var info = outline[i];
        for (var j = info.blockInfo.length - 1; j >= 0; j--) {
          // line is in current block
          if (info.blockInfo[j].lineno <= lineNumber) {
            return {
              sectionId: info.id,
              level: info.level,
              blockIndex: j,
              lineno: info.blockInfo[j].lineno
            };
          }
        }

        return {
          sectionId: info.id,
          level: info.level,
          blockIndex: -1,
          lineno: info.lineno
        };
      }
    }
  }

  /**
   * Calculate the pixel offset from the top of the rendered
   * document based on locationInfo.
   *
   * @param   {Object} frame        iframe displaying the document
   * @param   {Object} locationInfo information returned from @findLocationInfo
   * @returns {Number} pixel offset from top
   */
  function getTopPos(frame, locationInfo) {
    if (!locationInfo) {
      return 0;
    }

    // find correct element based on htmlLocationInfo, section first
    var $element = $('#' + locationInfo.sectionId, frame.contentDocument.body);
    if (locationInfo.blockIndex >= 0) {
      // if we've got block information, find correct div or table
      var $paragraphs = null;
      if (locationInfo.level === 0) {
        // match blocks in preamble
        $paragraphs = $element.find("#preamble > div.sectionbody").find("> div, > table");
      } else if (locationInfo.level < 2) {
        $paragraphs = $element.siblings("div.sectionbody").find("> div, > table");
      } else {
        $paragraphs = $element.siblings("div,table");
      }
      if (locationInfo.blockIndex < $paragraphs.length) {
        var p = $paragraphs[locationInfo.blockIndex];
        var blockPos = $(p).position();

        if (blockPos !== undefined) {
          return blockPos.top;
        }
      }
    }

    // calculate pixel offset from top
    var headerPos = $element.position();
    if (headerPos !== undefined) {
      return headerPos.top;
    }
  }

  /**
   * Calculate the line number from pixel offset
   * @param   {Object} outline information about sections, section levels, and blocks
   * @param   {Number} offset in pixels from top of document
   * @returns {Number} line number in editor
   */
  function getLineNumber(frame, outline, topPos) {
    var prevLine = 1;

    function callback(locInfo) {

      var ty = getTopPos(frame, locInfo);
      if (ty > topPos) {
        return prevLine;
      }
      prevLine = locInfo.lineno;
      return null;
    }

    for (var i = 0; i < outline.length; i++) {
      var info = outline[i];
      var l = callback({
        sectionId: info.id,
        level: info.level,
        blockIndex: -1,
        lineno: info.lineno
      });
      if (l) {
        return l;
      }
      for (var j = 0; j < outline[i].blockInfo.length; j++) {
        l = callback({
          sectionId: info.id,
          level: info.level,
          blockIndex: j,
          lineno: info.blockInfo[j].lineno
        });
        if (l) {
          return l;
        }
      }
    }

    return prevLine;
  }
});