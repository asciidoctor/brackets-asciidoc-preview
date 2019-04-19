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

/*global define, $, brackets, window */

/** @Module ViewPanel */

define(function(require, exports, module) {
  'use strict'

  var FileUtils = brackets.getModule('file/FileUtils'),
    ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
    WorkspaceManager = brackets.getModule('view/WorkspaceManager'),
    Settings = require('lib/settings'),
    utils = require('lib/utils')

  var externalWindowUrl = utils.toUrl(ExtensionUtils.getModulePath(module) + '../templates/window.html'),
    panelHTML = require('text!../templates/panel.html'),
    bracketsDirectory = FileUtils.getNativeBracketsDirectoryPath(),
    internalPanel,
    externalWindow,
    viewClosedCallback,
    isDetachedView = false,
    viewActive = false,
    viewVisible = false

  function openExternalWindow(prefs, updateSettings, viewCreatedCb, viewClosedCb) {
    function configureWindow(win) {
      // use local style sheets (includes bootstrap css)
      var bracketsStyleSheetUrl = utils.toUrl(bracketsDirectory + '/styles/brackets.min.css')
      // use locally installed jquery 2.3.2
      var bracketsScriptUrl = utils.toUrl(bracketsDirectory + '/thirdparty/thirdparty.min.js')
      // need bootstrap.js 2.3.2 for tabs
      var bootstrapScriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/2.3.2/js/bootstrap.js'

      var script = win.document.createElement('script')
      script.src = bracketsScriptUrl
      script.type = 'text/javascript'
      win.document.getElementsByTagName('head')[0].appendChild(script)

      // jQuery and bootstrap.js were just loaded!
      $(script, win.document).load(function() {
        var bootstrap = win.document.createElement('script')
        bootstrap.src = bootstrapScriptUrl
        bootstrap.type = 'text/javascript'
        win.document.getElementsByTagName('head')[0].appendChild(bootstrap)

        $('head', win.document).append('<link href="' + bracketsStyleSheetUrl + '" rel="stylesheet"></link>')
        $('head', win.document).append('<link href="../styles/AsciidocPreview.css" rel="stylesheet"></link>')

        var $panel = $('#panel-asciidoc-preview', win.document)
        var $iframe = $('#panel-asciidoc-preview-frame', win.document)

        $(win).resize(function() {
          $iframe.attr('height', $(win).innerHeight())
        })
        $iframe.attr('height', $(win).innerHeight())

        viewVisible = true
        viewActive = true

        win.$iframe = $iframe
        win.$panel = $panel

        // create settings panel
        win.settings = Settings.create($panel, prefs, updateSettings)

        viewCreatedCb(win)
      })
    }

    if (!externalWindow || externalWindow.closed) {
      var x = prefs.get('posX')
      var y = prefs.get('posY')

      externalWindow = window.open(externalWindowUrl)
      externalWindow.moveTo(x, y)

      externalWindow.onbeforeunload = function() {
        viewVisible = false
        viewActive = false
        prefs.set('posX', externalWindow.screenX)
        prefs.set('posY', externalWindow.screenY)

        prefs.save()
        viewClosedCb(externalWindow)
      }

      externalWindow.onload = function() {
        configureWindow(externalWindow)
      }
    } else {
      viewActive = true
      viewCreatedCb(externalWindow)
    }
  }

  function openBottomPanel(prefs, updateSettings, viewCreatedCb, viewClosedCb) {
    if (!internalPanel) {
      viewClosedCallback = viewClosedCb

      var $panel = $(panelHTML)
      var $iframe = $panel.find('#panel-asciidoc-preview-frame')

      internalPanel = WorkspaceManager.createBottomPanel('asciidoc-preview-panel', $panel)
      $panel.on('panelResizeUpdate', function(e, newSize) {
        $iframe.attr('height', newSize + 'px')
      })
      $iframe.attr('height', $panel.height() + 'px')

      internalPanel.$iframe = $iframe
      internalPanel.$panel = $panel

      // create settings panel
      internalPanel.settings = Settings.create($panel, prefs, updateSettings)
    }

    viewVisible = true
    viewActive = true
    internalPanel.show()

    window.setTimeout(resizeIframe)

    viewCreatedCb(internalPanel)
  }

  function open(extView, prefs, updateSettings, viewCreatedCb, viewClosedCb) {
    isDetachedView = extView

    if (extView) {
      openExternalWindow(prefs, updateSettings, viewCreatedCb, viewClosedCb)
    } else {
      openBottomPanel(prefs, updateSettings, viewCreatedCb, viewClosedCb)
    }
  }

  function close() {
    if (viewVisible) {
      viewVisible = false
      viewActive = false
      if (isDetachedView) {
        externalWindow.close()
      } else {
        viewClosedCallback(internalPanel)
        internalPanel.hide()
      }
    }
  }

  function deactivate() {
    if (viewVisible) {
      viewActive = false
      if (!isDetachedView) {
        close()
      } else {
        externalWindow.$iframe.attr('srcdoc', '')
      }
    }
  }

  /**
   * Shows or hides a busy indicator
   * @param {Boolean} show busy indicator on true, hide on false
   */
  function displaySpinner(show) {
    var $spinner

    if (isDetachedView) {
      $spinner = externalWindow.$panel.find('#asciidoc-busy-spinner')
    } else {
      $spinner = internalPanel.$panel.find('#asciidoc-busy-spinner')
    }

    if (show) {
      $spinner.show()
    } else {
      $spinner.hide()
    }
  }

  /**
   * Shows or hides a location button
   * @param {Boolean} show button on true, hide on false
   */
  function displayLocationButton(show) {
    var $btn

    if (isDetachedView) {
      $btn = externalWindow.$panel.find('#asciidoc-sync-location-button')
    } else {
      $btn = internalPanel.$panel.find('#asciidoc-sync-location-button')
    }

    if (show) {
      $btn.show()
    } else {
      $btn.hide()
    }
  }

  function getSettings() {
    if (isDetachedView) {
      return externalWindow.settings
    } else {
      return internalPanel.settings
    }
  }

  function showSettings() {
    getSettings().show()
  }

  function hideSettings() {
    getSettings().hide()
  }

  function showWarning() {
    getSettings().showWarning()
  }

  function hideWarning() {
    getSettings().hideWarning()
  }

  function setDocDir(dir) {
    Settings.setDocDir(dir)
  }

  function isActive() {
    return viewActive
  }

  function isDetached() {
    return isDetachedView
  }

  function resizeIframe() {
    if (!isDetached() && isActive()) {
      if (internalPanel.$iframe && internalPanel.$panel) {
        var iframeWidth = internalPanel.$panel.innerWidth()
        internalPanel.$iframe.attr('width', iframeWidth + 'px')
      }
    }
  }

  // Listen for resize events (internal panel only)
  WorkspaceManager.on('workspaceUpdateLayout', resizeIframe)
  $('#sidebar').on('panelCollapsed panelExpanded panelResizeUpdate', resizeIframe)

  exports.open = open
  exports.close = close
  exports.deactivate = deactivate
  exports.isActive = isActive
  exports.isDetached = isDetached
  exports.showSettings = showSettings
  exports.hideSettings = hideSettings
  exports.showWarning = showWarning
  exports.hideWarning = hideWarning
  exports.displaySpinner = displaySpinner
  exports.displayLocationButton = displayLocationButton
  exports.setDocDir = setDocDir
})
