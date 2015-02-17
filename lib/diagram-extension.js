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
 * Return a function to request the specified diagram
 * from a plant UML server and create the appropriate
 * image block.
 * @param diagram One of "plantuml", "ditaa", or "graphviz"
 * @returns {Function}
 */
function process_function(diagram) {

    return function (parent, reader, attrs) {
        var nil = Opal.nil,
            $hash2 = Opal.hash2,
            self = this;

        // if server url was not set, create a literal block
        // and return
        if (plantUmlServerUrl == null || plantUmlServerUrl.length == 0) {
            return self.$create_literal_block(parent, reader.$read(), attrs, $hash2(["subs"], {
                "subs": nil
            }));
        }

        var title = "" + (attrs['$[]']("title")),
            alt = "" + (attrs['$[]']("alt")),
            caption = "" + (attrs['$[]']("caption")),
            width = "" + (attrs['$[]']("width")),
            height = "" + (attrs['$[]']("height")),
            scale = "" + (attrs['$[]']("scale")),
            align = "" + (attrs['$[]']("align")),
            float = "" + (attrs['$[]']("float")),
            link = "" + (attrs['$[]']("link")),
            role = "" + (attrs['$[]']("type"));

        /*
         var target = (attrs['$[]']("target"));
         if (target == nil) {
         target = attrs['$[]'](2);
         }
         */

        var format = (attrs['$[]']("format"));
        if (format == nil) {
            format = attrs['$[]'](3);
        }
        if (format == nil) {
            format = "img";
        } else {
            format = "" + format;
        }

        // Create request URL for plant UML server
        var requestUrl = createRequestUrl(diagram, format, plantUmlServerUrl, reader.$read());
        if (format === "txt") {
            // This is just showing the request URL, not the picture as ascii art!
            return self.$create_literal_block(parent, requestUrl, attrs, $hash2(["subs"], {
                "subs": nil
            }));
        } else {
            var attributes = {
                "target": requestUrl,
                "title": title,
                "role": role,
                "alt": alt,
                "link": link,
                "caption": caption,
                "width": width,
                "height": height,
                "scale": scale,
                "float": float,
                "align": align
            };

            var keys = Object.keys(attributes);

            keys.forEach(function (key) {
                if (attributes[key] == "")
                    delete attributes[key];
            });

            return self.$create_image_block(parent, $hash2(Object.keys(attributes), attributes));
        }
    };
}

/**
 * Create and register extension for UML diagrams
 */

(function ($opal) {
    var $a, self = $opal.top,
        nil = $opal.nil,
        $scope = $opal;

    self.$include((($a = $opal.Object._scope.Asciidoctor) == null ? $opal.cm('Asciidoctor') : $a));
    return (function ($base, $super) {
        function $UmlBlock() {
        }

        var self = $opal.klass($base, $super, 'UmlBlock', $UmlBlock);

        self.$use_dsl();
        self.$named("plantuml");
        self.$on_context(["literal", "open"]);
        self.$parse_content_as("literal");

        return (self._proto.$process = process_function("plantuml"), nil) && 'process';
    })(self, ($scope.Extensions)._scope.BlockProcessor);
})(Opal);

(function ($opal) {
    var $a, $b, TMP_1, self = $opal.top,
        $scope = $opal;

    return ($a = ($b = $scope.Extensions).$register, $a._p = (TMP_1 = function () {
        var self = TMP_1._s || this;

        return self.$block($scope.UmlBlock);
    }, TMP_1._s = self, TMP_1), $a).call($b);
})(Opal);

/**
 * Create and register extension for ditaa
 */

(function ($opal) {
    var $a, self = $opal.top,
        nil = $opal.nil,
        $scope = $opal;

    self.$include((($a = $opal.Object._scope.Asciidoctor) == null ? $opal.cm('Asciidoctor') : $a));
    return (function ($base, $super) {
        function $DitaaBlock() {
        }

        var self = $opal.klass($base, $super, 'DitaaBlock', $DitaaBlock);

        self.$use_dsl();
        self.$named("ditaa");
        self.$on_context(["literal", "open"]);
        self.$parse_content_as("literal");

        return (self._proto.$process = process_function("ditaa"), nil) && 'process';
    })(self, ($scope.Extensions)._scope.BlockProcessor);
})(Opal);

(function ($opal) {
    var $a, $b, TMP_1, self = $opal.top,
        $scope = $opal;

    return ($a = ($b = $scope.Extensions).$register, $a._p = (TMP_1 = function () {
        var self = TMP_1._s || this;

        return self.$block($scope.DitaaBlock);
    }, TMP_1._s = self, TMP_1), $a).call($b);
})(Opal);


/**
 * Create and register extension for Graphviz
 */

(function ($opal) {
    var $a, self = $opal.top,
        nil = $opal.nil,
        $scope = $opal;

    self.$include((($a = $opal.Object._scope.Asciidoctor) == null ? $opal.cm('Asciidoctor') : $a));
    return (function ($base, $super) {
        function $DotBlock() {
        }

        var self = $opal.klass($base, $super, 'DotBlock', $DotBlock);

        self.$use_dsl();
        self.$named("graphviz");
        self.$on_context(["literal", "open"]);
        self.$parse_content_as("literal");

        return (self._proto.$process = process_function("graphviz"), nil) && 'process';
    })(self, ($scope.Extensions)._scope.BlockProcessor);
})(Opal);

(function ($opal) {
    var $a, $b, TMP_1, self = $opal.top,
        $scope = $opal;

    return ($a = ($b = $scope.Extensions).$register, $a._p = (TMP_1 = function () {
        var self = TMP_1._s || this;

        return self.$block($scope.DotBlock);
    }, TMP_1._s = self, TMP_1), $a).call($b);
})(Opal);