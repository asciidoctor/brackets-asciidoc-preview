/*
 * Copyright (c) 2014-2019 Thomas Kern
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

/* Code based on PlantUML integration from https://github.com/asciidocfx/AsciidocFX */

/* global asciidoctor, Opal, createRequestUrl, plantUmlServerUrl */

/**
 * Return a function to request the specified diagram
 * from a PlantUML server and create the appropriate
 * image block.
 * @param diagram One of "plantuml", "ditaa", or "graphviz"
 * @returns {Function}
 */
function process_function(self, diagram) {

  return function (parent, reader, attrs) {

    // if server url was not set, create a literal block
    // and return
    if (plantUmlServerUrl == null || plantUmlServerUrl.length == 0) {
      return self.createBlock(parent, 'literal', reader.$read(), attrs, {
        "subs": subs
      });
    }

    var format = attrs.format || 'png';
    var subs = attrs.subs;

    // read diagram code
    var code = reader.$read();
    // If "subs" attribute is specified, substitute accordingly.
    // Be careful not to specify "specialcharacters" or your diagram code won't be valid anymore!
    if (subs != null) {
      code = parent.$apply_subs(code, parent.$resolve_subs(subs), true);
    }

    // Create request URL for plant UML server
    var requestUrl = createRequestUrl(diagram, format, plantUmlServerUrl, code);
    if (format === "txt") {
      // This is just showing the request URL, not the picture as ascii art!
      return self.createBlock(parent, 'literal', requestUrl, attrs, {
        "subs": Opal.nil
      });
    } else {
      var attributes = {
        "target": requestUrl,
        "title": attrs.title, // required attribute, even if null
        "alt": attrs.alt || requestUrl // alt is mandatory 
      };

      if (attrs.id) attributes.id = attrs.id;
      if (attrs.role) attributes.role = attrs.role;
      if (attrs.link) attributes.link = attrs.link;
      if (attrs.caption) attributes.caption = attrs.caption;
      if (attrs.width) attributes.width = attrs.width;
      if (attrs.height) attributes.height = attrs.height;
      if (attrs.scale) attributes.scale = attrs.scale;
      if (attrs.float) attributes.float = attrs.float;
      if (attrs.align) attributes.align = attrs.align;

      return self.createImageBlock(parent, attributes);
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
    self.positionalAttributes(['target', 'format']);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'plantuml'));
  });
});

asciidoctor.Extensions.register(function () {
  this.block(function () {
    var self = this;
    self.named('ditaa');
    self.onContext(["literal", "open", "listing"]);
    self.positionalAttributes(['target', 'format']);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'ditaa'));
  });
});

asciidoctor.Extensions.register(function () {
  this.block(function () {
    var self = this;
    self.named('graphviz');
    self.onContext(["literal", "open", "listing"]);
    self.positionalAttributes(['target', 'format']);
    self.$parse_content_as("literal");

    self.process(process_function(self, 'graphviz'));
  });
});
