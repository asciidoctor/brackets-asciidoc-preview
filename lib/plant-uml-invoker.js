/*
 * Copyright (c) 2014-2015 Thomas Kern
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

/**
 * Send ascii diagram to a PlantUml server and return a URL
 * pointing to the generated diagram image.
 * See http://plantuml.sourceforge.net/codejavascript2.html
 * @param diagram diagram type: "plantuml", "ditaa", or "graphviz"
 * @param format the requested diagram format: png, svg, or txt
 * @param serverUrl PlantUml server URL
 * @param code diagram ascii input source
 * @returns {*}
 */
function plantUml(diagram, format, serverUrl, code) {

    if (diagram === "ditaa") {
        code = "@startditaa\n" + code + "\n@endditaa";
    } else if (diagram === "graphviz") {
        code = "@startdot\n" + code + "\n@enddot";
    }
    code = unescape(encodeURIComponent(code));
    var encoded_code = encode64(deflate(code, 9));

    return serverUrl + '/' + encoded_code;
}

var encode64 = function (data) {
    r = "";
    for (i = 0; i < data.length; i += 3) {
        if (i + 2 == data.length) {
            r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
        } else if (i + 1 == data.length) {
            r += append3bytes(data.charCodeAt(i), 0, 0);
        } else {
            r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2));
        }
    }
    return r;
};

append3bytes = function (b1, b2, b3) {
    c1 = b1 >> 2;
    c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    c4 = b3 & 0x3F;
    r = "";
    r += encode6bit(c1 & 0x3F);
    r += encode6bit(c2 & 0x3F);
    r += encode6bit(c3 & 0x3F);
    r += encode6bit(c4 & 0x3F);
    return r;
};

encode6bit = function (b) {
    if (b < 10) {
        return String.fromCharCode(48 + b);
    }
    b -= 10;
    if (b < 26) {
        return String.fromCharCode(65 + b);
    }
    b -= 26;
    if (b < 26) {
        return String.fromCharCode(97 + b);
    }
    b -= 26;
    if (b == 0) {
        return '-';
    }
    if (b == 1) {
        return '_';
    }
    return '?';
};
	