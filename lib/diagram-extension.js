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
      role = "" + (attrs['$[]']("role"));

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



function register(module_name, processor_name) {
  Opal.dynamic_require_severity = "ignore";
  var $a, $b, TMP_1, self = Opal.top,
    $scope = Opal;

  self.$require(module_name);
  return ($a = ($b = $scope.get('Extensions')).$register, $a.$$p = (TMP_1 = function () {
    var self = TMP_1.$$s || this;

    return self.$block($scope.get(processor_name));
  }, TMP_1.$$s = self, TMP_1), $a).call($b);
}

function defineExtension(processor_name, block_name) {
  return function ($opal) {
    var self = $opal.top,
      nil = $opal.nil,
      $scope = $opal;

    self.$include($opal.get('Asciidoctor'));

    return (function ($base, $super) {
      function Block() {}

      var self = $opal.klass($base, $super, processor_name, Block);
      var def = self.$$proto;

      self.$use_dsl();
      self.$named(block_name);
      self.$on_context(["literal", "open", "listing"]);
      self.$parse_content_as("literal");

      return (def.$process = process_function(block_name), nil) && 'process';
    })(self, (($scope.get('Extensions')).$$scope.get('BlockProcessor')));
  };
}

function createExtension(module_name, processor_name, block_name) {
  Opal.modules[module_name] = defineExtension(processor_name, block_name);
  register(module_name, processor_name);
}

/**
 * Create and register extensions for UML, ditaa, and graphviz
 * These extensions are not the original asciidoctor-diagram extensions.
 * They are only stubs, which delegate the actual conversion process to an external server.
 */

createExtension('brackets-uml-extension', 'UmlBlockProcessor', 'plantuml');
createExtension('brackets-ditaa-extension', 'DitaaBlockProcessor', 'ditaa');
createExtension('brackets-graphviz-extension', 'DotBlockProcessor', 'graphviz');