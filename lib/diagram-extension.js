/*
 * Copyright (c) 2014-2017 Thomas Kern
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

/* global asciidoctor, Opal, createRequestUrl, plantUmlServerUrl */

/**
 * Return a function to request the specified diagram
 * from a plant UML server and create the appropriate
 * image block.
 * @param diagram One of "plantuml", "ditaa", or "graphviz"
 * @returns {Function}
 */
function process_function(self, diagram) {

  return function (parent, reader, attrs) {
    var nil = Opal.nil;

    // if server url was not set, create a literal block
    // and return
    if (plantUmlServerUrl == null || plantUmlServerUrl.length == 0) {
      return self.createBlock(parent, 'literal', reader.$read(), attrs, {
        "subs": subs
      });
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
      role = "" + (attrs['$[]']("role")),
      subs = "" + (attrs['$[]']("subs"));


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

    // read diagram code
    var code = reader.$read();
    // If "subs" attribute is specified, substitute accordingly.
    // Be careful not to specify "specialcharacters" or your diagram code won't be valid anymore!
    if (subs != "") {
      code = parent.$apply_subs(code, parent.$resolve_subs(subs), true);
    }

    // Create request URL for plant UML server
    var requestUrl = createRequestUrl(diagram, format, plantUmlServerUrl, code);
    if (format === "txt") {
      // This is just showing the request URL, not the picture as ascii art!
      return self.createBlock(parent, 'literal', requestUrl, attrs, {
        "subs": nil
      });
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
        if (attributes[key] == "") {
          delete attributes[key];
        }
      });
/*
      return self.createBlock(parent, 'image', nil, {
        "target": requestUrl,
        "title": title
      });*/

      return self.createBlock(parent, 'literal', code, attributes, {
       "subs": nil
      });
    }
  };
}

/**
 * Create and register extensions for UML, ditaa, and graphviz
 * These extensions are not the original asciidoctor-diagram extensions.
 * They are only stubs, which delegate the actual conversion process to an external server.
 */

asciidoctor.Extensions.register(function () {
  this.block(function () {
    var self = this;
    self.named('plantuml');
    self.onContext(["literal", "open", "listing"]);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'plantuml'));
  });
});

asciidoctor.Extensions.register(function () {
  this.block(function () {
    var self = this;
    self.named('ditaa');
    self.onContext(["literal", "open", "listing"]);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'ditaa'));
  });
});

asciidoctor.Extensions.register(function () {
  this.block(function () {
    var self = this;
    self.named('graphviz');
    self.onContext(["literal", "open", "listing"]);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'graphviz'));
  });
});
