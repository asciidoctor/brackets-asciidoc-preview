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

/*
 * This file contains everything necessary to execute asciidoctor.js in a
 * a webworker thread. It is completely self-contained and contains copies
 * of opal.js and asciidoctor.js.
 * Currently, opal and asciidoctor are included manually, but we might create
 * this from its parts through a build process in the future.
 */

/*global Opal, importScripts, postMessage */
/*jshint -W079, -W098 */

// Webworkers do not have access to 'console', but Opal needs it.

var console = {
    messages: [],
    log: function (m) {
        this.messages.push(m);
    },
    info: function (m) {
        this.messages.push(m);
    },
    warn: function (m) {
        this.messages.push(m);
    },
    error: function (m) {
        this.messages.push(m);
    },
    debug: function (m) {
        this.messages.push(m);
    },
    clear: function() {
        this.messages = [];
    }
};

// mapping for class names
// in generated HTML
var classNames = {
    stem: 'stemblock',
    admonition: 'admonitionblock',
    audio: 'audioblock',
    video: 'videoblock',
    colist: 'colist',
    dlist: function(style) { 
        if (style === 'qanda') {
            return 'qlist';
        } else if (style === 'horizontal') {
            return 'hdlist';
        } else {
            return 'dlist';
        }
    },
    olist: 'olist',
    ulist: 'ulist',
    example: 'exampleblock',
    image: 'imageblock',
    listing: 'listingblock',
    literal: 'literalblock',
    open: function(style) { 
        return (style === 'abstract')?'quoteblock':'openblock'; 
    },
    paragraph: 'paragraph',
    quote: 'quoteblock',
    table: 'tableblock',
    verse: 'verseblock'   
};

// onmessage is invoked by 'postMessage' on the worker
var onmessage = function (e) {
    postMessage(convert(e.data));
};

// Actual conversion is done here
function convert(data) {

    var startTime = new Date().getTime();
    console.clear();
    
    // communicate to Asciidoctor that the working directory is not the same as the preview file
    Opal.ENV['$[]=']("PWD", data.pwd);
    
    // options and attributes
    var opts = Opal.hash2(['base_dir', 'safe', 'doctype', 'sourcemap', 'attributes'], {
        'base_dir': data.basedir,
        'safe': data.safemode,
        'doctype': data.doctype,
        'sourcemap': true, // generate source map
        'attributes': data.attributes
    });
    
    var doc = Opal.Asciidoctor.$load(data.docText, opts);
    return {
        html: doc.$convert(), // convert!
        outline: outline(doc, opts),
        messages: console.messages,
        duration: new Date().getTime() - startTime
    };
}

function outline(doc, opts) {
    
    var sectionInfo = [];
    
    var getBlockInfo = function(blocks) {
        var blockInfo = [];
        for (var i = 0; i < blocks.length && blocks[i].$node_name() != 'section'; i++) {
            var ln = blocks[i].$lineno();
            // HACK: Line number of last block seems to be off by one
            if (i + 1 == blocks.length) {
                ln--;
            } 
            blockInfo.push({
                lineno: ln
            });
        }
        return blockInfo;
    };
    
    var fillSections = function self (level, sections) {
        level++;
        if (level > 5) {
            return;
        }
        for (var i = 0; i < sections.length; i++) {
            sectionInfo.push({ 
                level: level,
                //titleHtml: Opal.Asciidoctor.$convert(sections[i].title, opts), 
                title: sections[i].$captioned_title(), 
                lineno: sections[i].$lineno(),
                id: sections[i].$id(),
                blockInfo: getBlockInfo(sections[i].blocks)
            });
            self(level, sections[i].$sections());
        } 
    };
    
    fillSections(0, doc.$sections());
    
    return {
        //titleHtml: Opal.Asciidoctor.$convert(doc.$doctitle(), opts),
        title: doc.$doctitle(Opal.hash2(['sanitize'], { 'sanitize': true })),
        sections: sectionInfo
    };
}

// Import Opal and Asciidoctor.js
importScripts('opal.js', 'asciidoctor.js');
