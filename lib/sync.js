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
    exports.scrollPreview = scrollPreview;

    /**
     * Retrieves location information from document outline, based
     * on current line number in editor.
     */
    function findLocationInfo (outline, lineNumber) {
        var sectionInfo = outline.sections;
        for (var i = sectionInfo.length - 1; i >= 0; i--) {
            // this line is a section heading
            if (sectionInfo[i].lineno == lineNumber) {
                return { 
                    sectionId: sectionInfo[i].id, 
                    level: sectionInfo[i].level,
                    blockIndex: -1
                };
            // current line is in this section
            } else if (sectionInfo[i].lineno < lineNumber) {
                var info = sectionInfo[i];
                for (var j = info.blockInfo.length - 1; j >= 0; j--) {
                    // line is in current block
                    if (info.blockInfo[j].lineno <= lineNumber) {
                        return { 
                            sectionId: info.id, 
                            level: info.level,
                            blockIndex: j
                        };
                    }
                }
                
                return { 
                    sectionId: info.id, 
                    level: info.level,
                    blockIndex: -1
                };
            }
        }
    }
   
    /*
     * Scrolls preview frame to make specified position visible
     */
    function scrollPreview(frame, locationInfo) {
        if (locationInfo) {
            // find correct element based on htmlLocationInfo, section first
            var $element = $('#' + locationInfo.sectionId, frame.contentDocument.body);
            if (locationInfo.blockIndex >= 0) {
                // if we've got block information, find correct div or table
                var $paragraphs = null;
                if (locationInfo.level < 2) {
                    $paragraphs = $element.siblings("div.sectionbody").find("div,table");
                } else {
                    $paragraphs = $element.siblings("div,table");
                }
                if (locationInfo.blockIndex < $paragraphs.length) {
                    var p = $paragraphs[locationInfo.blockIndex];
                    var blockPos = $(p).position();
                
                    if (blockPos !== undefined) {
                        frame.contentWindow.scrollTo(0, blockPos.top);
                        return;
                    }
                }
            }
                
            // calculate pixel offset from top
            var headerPos = $element.position();
            if (headerPos !== undefined) {
                frame.contentWindow.scrollTo(0, headerPos.top);
            }
        }
    }
});
