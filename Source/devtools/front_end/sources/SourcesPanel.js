/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.Panel}
 * @implements {WebInspector.ContextMenu.Provider}
 * @implements {WebInspector.TargetManager.Observer}
 * @param {!WebInspector.Workspace=} workspaceForTest
 */
WebInspector.SourcesPanel = function(workspaceForTest)
{
    WebInspector.Panel.call(this, "sources");
    this.registerRequiredCSS("sourcesPanel.css");
    new WebInspector.UpgradeFileSystemDropTarget(this.element);

    this._workspace = workspaceForTest || WebInspector.workspace;

    this.debugToolbar = this._createDebugToolbar();
    this._debugToolbarDrawer = this._createDebugToolbarDrawer();

    const initialDebugSidebarWidth = 225;
    this._splitView = new WebInspector.SplitView(true, true, "sourcesPanelSplitViewState", initialDebugSidebarWidth);
    this._splitView.enableShowModeSaving();
    this._splitView.show(this.element);

    // Create scripts navigator
    const initialNavigatorWidth = 225;
    this.editorView = new WebInspector.SplitView(true, false, "sourcesPanelNavigatorSplitViewState", initialNavigatorWidth);
    this.editorView.enableShowModeSaving();
    this.editorView.element.id = "scripts-editor-split-view";
    this.editorView.element.tabIndex = 0;
    this.editorView.show(this._splitView.mainElement());

    this._navigator = new WebInspector.SourcesNavigator(this._workspace);
    this._navigator.view.setMinimumSize(100, 25);
    this._navigator.view.show(this.editorView.sidebarElement());
    this._navigator.addEventListener(WebInspector.SourcesNavigator.Events.SourceSelected, this._sourceSelected, this);
    this._navigator.addEventListener(WebInspector.SourcesNavigator.Events.SourceRenamed, this._sourceRenamed, this);

    this._sourcesView = new WebInspector.SourcesView(this._workspace, this);
    this._sourcesView.addEventListener(WebInspector.SourcesView.Events.EditorSelected, this._editorSelected.bind(this));
    this._sourcesView.addEventListener(WebInspector.SourcesView.Events.EditorClosed, this._editorClosed.bind(this));
    this._sourcesView.registerShortcuts(this.registerShortcuts.bind(this));
    this._sourcesView.show(this.editorView.mainElement());

    this._debugSidebarResizeWidgetElement = document.createElementWithClass("div", "resizer-widget");
    this._debugSidebarResizeWidgetElement.id = "scripts-debug-sidebar-resizer-widget";
    this._splitView.addEventListener(WebInspector.SplitView.Events.ShowModeChanged, this._updateDebugSidebarResizeWidget, this);
    this._updateDebugSidebarResizeWidget();
    this._splitView.installResizer(this._debugSidebarResizeWidgetElement);

    // FIXME: This is a temporary solution which should be removed as soon as the documentation module is released from experiment.
    if (Runtime.experiments.isEnabled("documentation"))
        self.runtime.loadModule("documentation");

    this.sidebarPanes = {};
    this.sidebarPanes.threads = new WebInspector.ThreadsSidebarPane();
    this.sidebarPanes.watchExpressions = new WebInspector.WatchExpressionsSidebarPane();
    this.sidebarPanes.callstack = new WebInspector.CallStackSidebarPane();
    this.sidebarPanes.callstack.addEventListener(WebInspector.CallStackSidebarPane.Events.CallFrameSelected, this._callFrameSelectedInSidebar.bind(this));
    this.sidebarPanes.callstack.registerShortcuts(this.registerShortcuts.bind(this));

    this.sidebarPanes.scopechain = new WebInspector.ScopeChainSidebarPane();
    this.sidebarPanes.jsBreakpoints = new WebInspector.JavaScriptBreakpointsSidebarPane(WebInspector.breakpointManager, this.showUISourceCode.bind(this));
    this.sidebarPanes.domBreakpoints = WebInspector.domBreakpointsSidebarPane.createProxy(this);
    this.sidebarPanes.xhrBreakpoints = new WebInspector.XHRBreakpointsSidebarPane();
    this.sidebarPanes.eventListenerBreakpoints = new WebInspector.EventListenerBreakpointsSidebarPane();

    this._extensionSidebarPanes = [];
    this._installDebuggerSidebarController();

    WebInspector.dockController.addEventListener(WebInspector.DockController.Events.DockSideChanged, this._dockSideChanged.bind(this));
    WebInspector.settings.splitVerticallyWhenDockedToRight.addChangeListener(this._dockSideChanged.bind(this));
    this._dockSideChanged();

    this._updateDebuggerButtons();
    this._pauseOnExceptionEnabledChanged();
    WebInspector.settings.pauseOnExceptionEnabled.addChangeListener(this._pauseOnExceptionEnabledChanged, this);
    this._setTarget(WebInspector.context.flavor(WebInspector.Target));
    WebInspector.breakpointManager.addEventListener(WebInspector.BreakpointManager.Events.BreakpointsActiveStateChanged, this._breakpointsActiveStateChanged, this);
    WebInspector.context.addFlavorChangeListener(WebInspector.Target, this._onCurrentTargetChanged, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasEnabled, this._debuggerWasEnabled, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerWasDisabled, this._debuggerReset, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerPaused, this._debuggerPaused, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.DebuggerResumed, this._debuggerResumed, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.CallFrameSelected, this._callFrameSelected, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.ConsoleCommandEvaluatedInSelectedCallFrame, this._consoleCommandEvaluatedInSelectedCallFrame, this);
    WebInspector.targetManager.addModelListener(WebInspector.DebuggerModel, WebInspector.DebuggerModel.Events.GlobalObjectCleared, this._debuggerReset, this);
    WebInspector.targetManager.observeTargets(this);
}

WebInspector.SourcesPanel.minToolbarWidth = 215;

WebInspector.SourcesPanel._infobarSymbol = Symbol("infobar");

WebInspector.SourcesPanel.prototype = {
    /**
     * @param {?WebInspector.Target} target
     */
    _setTarget: function(target)
    {
        if (!target)
            return;

        if (target.debuggerModel.isPaused()) {
            this._showDebuggerPausedDetails(/** @type {!WebInspector.DebuggerPausedDetails} */ (target.debuggerModel.debuggerPausedDetails()));
            var callFrame = target.debuggerModel.selectedCallFrame();
            if (callFrame)
                this._selectCallFrame(callFrame);
        } else {
            this._paused = false;
            this._clearInterface();
            this._toggleDebuggerSidebarButton.setEnabled(true);
        }
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onCurrentTargetChanged: function(event)
    {
        var target = /** @type {?WebInspector.Target} */ (event.data);
        this._setTarget(target);
    },

    /**
     * @return {!Element}
     */
    defaultFocusedElement: function()
    {
        return this._sourcesView.defaultFocusedElement();
    },

    /**
     * @return {boolean}
     */
    paused: function()
    {
        return this._paused;
    },

    wasShown: function()
    {
        WebInspector.context.setFlavor(WebInspector.SourcesPanel, this);
        WebInspector.Panel.prototype.wasShown.call(this);
    },

    willHide: function()
    {
        WebInspector.Panel.prototype.willHide.call(this);
        WebInspector.context.setFlavor(WebInspector.SourcesPanel, null);
    },

    /**
     * @return {!WebInspector.SearchableView}
     */
    searchableView: function()
    {
        return this._sourcesView.searchableView();
    },

    _consoleCommandEvaluatedInSelectedCallFrame: function(event)
    {
        var target = /** @type {!WebInspector.Target} */  (event.target.target());
        if (WebInspector.context.flavor(WebInspector.Target) !== target)
            return;
        this.sidebarPanes.scopechain.update(target.debuggerModel.selectedCallFrame());
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _debuggerPaused: function(event)
    {
        var details = /** @type {!WebInspector.DebuggerPausedDetails} */ (event.data);
        if (!this._paused)
            WebInspector.inspectorView.setCurrentPanel(this);

        if (WebInspector.context.flavor(WebInspector.Target) === details.target())
            this._showDebuggerPausedDetails(details);
        else if (!this._paused)
            WebInspector.context.setFlavor(WebInspector.Target, details.target());
    },

    /**
     * @param {!WebInspector.DebuggerPausedDetails} details
     */
    _showDebuggerPausedDetails: function(details)
    {
        this._paused = true;
        this._updateDebuggerButtons();

        this.sidebarPanes.callstack.update(details);

        /**
         * @param {!Element} element
         * @this {WebInspector.SourcesPanel}
         */
        function didCreateBreakpointHitStatusMessage(element)
        {
            this.sidebarPanes.callstack.setStatus(element);
        }

        /**
         * @param {!WebInspector.UILocation} uiLocation
         * @this {WebInspector.SourcesPanel}
         */
        function didGetUILocation(uiLocation)
        {
            var breakpoint = WebInspector.breakpointManager.findBreakpointOnLine(uiLocation.uiSourceCode, uiLocation.lineNumber);
            if (!breakpoint)
                return;
            this.sidebarPanes.jsBreakpoints.highlightBreakpoint(breakpoint);
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on a JavaScript breakpoint."));
        }

        if (details.reason === WebInspector.DebuggerModel.BreakReason.DOM) {
            WebInspector.domBreakpointsSidebarPane.highlightBreakpoint(details.auxData);
            WebInspector.domBreakpointsSidebarPane.createBreakpointHitStatusMessage(details, didCreateBreakpointHitStatusMessage.bind(this));
        } else if (details.reason === WebInspector.DebuggerModel.BreakReason.EventListener) {
            var eventName = details.auxData["eventName"];
            var targetName = details.auxData["targetName"];
            this.sidebarPanes.eventListenerBreakpoints.highlightBreakpoint(eventName, targetName);
            var eventNameForUI = WebInspector.EventListenerBreakpointsSidebarPane.eventNameForUI(eventName, details.auxData);
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on a \"%s\" Event Listener.", eventNameForUI));
        } else if (details.reason === WebInspector.DebuggerModel.BreakReason.XHR) {
            this.sidebarPanes.xhrBreakpoints.highlightBreakpoint(details.auxData["breakpointURL"]);
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on a XMLHttpRequest."));
        } else if (details.reason === WebInspector.DebuggerModel.BreakReason.Exception)
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on exception: '%s'.", details.auxData["description"]));
        else if (details.reason === WebInspector.DebuggerModel.BreakReason.Assert)
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on assertion."));
        else if (details.reason === WebInspector.DebuggerModel.BreakReason.CSPViolation)
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on a script blocked due to Content Security Policy directive: \"%s\".", details.auxData["directiveText"]));
        else if (details.reason === WebInspector.DebuggerModel.BreakReason.DebugCommand)
            this.sidebarPanes.callstack.setStatus(WebInspector.UIString("Paused on a debugged function"));
        else {
            if (details.callFrames.length)
                WebInspector.debuggerWorkspaceBinding.createCallFrameLiveLocation(details.callFrames[0], didGetUILocation.bind(this));
            else
                console.warn("ScriptsPanel paused, but callFrames.length is zero."); // TODO remove this once we understand this case better
        }

        this._splitView.showBoth(true);
        this._toggleDebuggerSidebarButton.setEnabled(false);
        window.focus();
        InspectorFrontendHost.bringToFront();
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _debuggerResumed: function(event)
    {
        var target = /** @type {!WebInspector.Target} */  (event.target.target());
        if (WebInspector.context.flavor(WebInspector.Target) !== target)
            return;
        this._paused = false;
        this._clearInterface();
        this._toggleDebuggerSidebarButton.setEnabled(true);
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _debuggerWasEnabled: function(event)
    {
        var target = /** @type {!WebInspector.Target} */  (event.target.target());
        if (WebInspector.context.flavor(WebInspector.Target) !== target)
            return;

        this._updateDebuggerButtons();
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _debuggerReset: function(event)
    {
        this._debuggerResumed(event);
    },

    /**
     * @return {!WebInspector.View}
     */
    get visibleView()
    {
        return this._sourcesView.visibleView();
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     * @param {number=} lineNumber 0-based
     * @param {number=} columnNumber
     * @param {boolean=} forceShowInPanel
     */
    showUISourceCode: function(uiSourceCode, lineNumber, columnNumber, forceShowInPanel)
    {
        this._showEditor(forceShowInPanel);
        this._sourcesView.showSourceLocation(uiSourceCode, lineNumber, columnNumber);
    },

    _showEditor: function(forceShowInPanel)
    {
        WebInspector.inspectorView.setCurrentPanel(this);
    },

    /**
     * @param {!WebInspector.UILocation} uiLocation
     * @param {boolean=} forceShowInPanel
     */
    showUILocation: function(uiLocation, forceShowInPanel)
    {
        this.showUISourceCode(uiLocation.uiSourceCode, uiLocation.lineNumber, uiLocation.columnNumber, forceShowInPanel);
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _revealInNavigator: function(uiSourceCode)
    {
        this._navigator.revealUISourceCode(uiSourceCode);
    },

    /**
     * @param {boolean} ignoreExecutionLineEvents
     */
    setIgnoreExecutionLineEvents: function(ignoreExecutionLineEvents)
    {
        this._ignoreExecutionLineEvents = ignoreExecutionLineEvents;
    },

    _executionLineChanged: function(uiLocation)
    {
        this._sourcesView.clearCurrentExecutionLine();
        this._sourcesView.setExecutionLine(uiLocation);
        if (this._ignoreExecutionLineEvents)
            return;
        this._sourcesView.showSourceLocation(uiLocation.uiSourceCode, uiLocation.lineNumber, 0, undefined, true);
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _callFrameSelected: function(event)
    {
        var callFrame = /** @type {?WebInspector.DebuggerModel.CallFrame} */ (event.data);

        if (!callFrame || callFrame.target() !== WebInspector.context.flavor(WebInspector.Target))
            return;

        this._selectCallFrame(callFrame);
    },

    /**
     * @param {!WebInspector.DebuggerModel.CallFrame}  callFrame
     */
    _selectCallFrame: function(callFrame)
    {
        this.sidebarPanes.scopechain.update(callFrame);
        this.sidebarPanes.watchExpressions.refreshExpressions();
        this.sidebarPanes.callstack.setSelectedCallFrame(callFrame);
        WebInspector.debuggerWorkspaceBinding.createCallFrameLiveLocation(callFrame, this._executionLineChanged.bind(this));
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _sourceSelected: function(event)
    {
        var uiSourceCode = /** @type {!WebInspector.UISourceCode} */ (event.data.uiSourceCode);
        this._sourcesView.showSourceLocation(uiSourceCode, undefined, undefined, !event.data.focusSource)
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _sourceRenamed: function(event)
    {
        var uiSourceCode = /** @type {!WebInspector.UISourceCode} */ (event.data);
        this._sourcesView.sourceRenamed(uiSourceCode);
    },

    _pauseOnExceptionEnabledChanged: function()
    {
        var enabled = WebInspector.settings.pauseOnExceptionEnabled.get();
        this._pauseOnExceptionButton.toggled = enabled;
        this._pauseOnExceptionButton.title = WebInspector.UIString(enabled ? "Don't pause on exceptions." : "Pause on exceptions.");
        this._debugToolbarDrawer.classList.toggle("expanded", enabled);
    },

    _updateDebuggerButtons: function()
    {
        var currentTarget = WebInspector.context.flavor(WebInspector.Target);
        if (!currentTarget)
            return;

        if (this._paused) {
            this._updateButtonTitle(this._pauseButton, WebInspector.UIString("Resume script execution (%s)."))
            this._pauseButton.state = true;
            this._pauseButton.setLongClickOptionsEnabled((function() { return [ this._longResumeButton ] }).bind(this));

            this._pauseButton.setEnabled(true);
            this._stepOverButton.setEnabled(true);
            this._stepIntoButton.setEnabled(true);
            this._stepOutButton.setEnabled(true);
        } else {
            this._updateButtonTitle(this._pauseButton, WebInspector.UIString("Pause script execution (%s)."))
            this._pauseButton.state = false;
            this._pauseButton.setLongClickOptionsEnabled(null);

            this._pauseButton.setEnabled(!currentTarget.debuggerModel.isPausing());
            this._stepOverButton.setEnabled(false);
            this._stepIntoButton.setEnabled(false);
            this._stepOutButton.setEnabled(false);
        }
    },

    _clearInterface: function()
    {
        this.sidebarPanes.callstack.update(null);
        this.sidebarPanes.scopechain.update(null);
        this.sidebarPanes.jsBreakpoints.clearBreakpointHighlight();
        WebInspector.domBreakpointsSidebarPane.clearBreakpointHighlight();
        this.sidebarPanes.eventListenerBreakpoints.clearBreakpointHighlight();
        this.sidebarPanes.xhrBreakpoints.clearBreakpointHighlight();

        this._sourcesView.clearCurrentExecutionLine();
        this._updateDebuggerButtons();
    },

    _togglePauseOnExceptions: function()
    {
        WebInspector.settings.pauseOnExceptionEnabled.set(!this._pauseOnExceptionButton.toggled);
    },

    /**
     * @return {boolean}
     */
    _runSnippet: function()
    {
        var uiSourceCode = this._sourcesView.currentUISourceCode();
        if (uiSourceCode.project().type() !== WebInspector.projectTypes.Snippets)
            return false;

        var currentExecutionContext = WebInspector.context.flavor(WebInspector.ExecutionContext);
        if (!currentExecutionContext)
            return false;

        WebInspector.scriptSnippetModel.evaluateScriptSnippet(currentExecutionContext, uiSourceCode);
        return true;
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _editorSelected: function(event)
    {
        var uiSourceCode = /** @type {!WebInspector.UISourceCode} */ (event.data);
        this._editorChanged(uiSourceCode);
        if (Runtime.experiments.isEnabled("suggestUsingWorkspace")) {
            if (this._editorSelectedTimer)
                clearTimeout(this._editorSelectedTimer);
            this._editorSelectedTimer = setTimeout(this._updateSuggestedMappingInfobar.bind(this, uiSourceCode), 3000);
        }
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _updateSuggestedMappingInfobar: function(uiSourceCode)
    {
        if (!this.isShowing())
            return;
        if (uiSourceCode[WebInspector.SourcesPanel._infobarSymbol])
            return;

        // First try mapping filesystem -> network.
        var uiSourceCodeFrame = this._sourcesView.viewForFile(uiSourceCode);
        if (uiSourceCode.project().type() === WebInspector.projectTypes.FileSystem) {
            var hasMappings = !!uiSourceCode.url;
            if (hasMappings)
                return;

            var targets = WebInspector.targetManager.targets();
            for (var i = 0; i < targets.length; ++i)
                targets[i].resourceTreeModel.forAllResources(matchResource.bind(this));
        }

        /**
         * @param {!WebInspector.Resource} resource
         * @return {boolean}
         * @this {WebInspector.SourcesPanel}
         */
        function matchResource(resource)
        {
            if (resource.contentURL().endsWith(uiSourceCode.name())) {
                createMappingInfobar.call(this, false);
                return true;
            }
            return false;
        }

        // Then map network -> filesystem.
        if (uiSourceCode.project().type() === WebInspector.projectTypes.Network || uiSourceCode.project().type() === WebInspector.projectTypes.ContentScripts) {
            if (this._workspace.uiSourceCodeForURL(uiSourceCode.url) !== uiSourceCode)
                return;

            var filesystemProjects = this._workspace.projectsForType(WebInspector.projectTypes.FileSystem);
            for (var i = 0; i < filesystemProjects.length; ++i) {
                var name = uiSourceCode.name();
                var fsUiSourceCodes = filesystemProjects[i].uiSourceCodes();
                for (var j = 0; j < fsUiSourceCodes.length; ++j) {
                    if (fsUiSourceCodes[j].name() === name) {
                        createMappingInfobar.call(this, true);
                        return;
                    }
                }
            }

            // There are no matching filesystems. Suggest adding a filesystem in case of localhost.
            var originURL = uiSourceCode.originURL().asParsedURL();
            if (originURL && originURL.host === "localhost")
                createWorkspaceInfobar();
        }

        /**
         * @param {boolean} isNetwork
         * @this {WebInspector.SourcesPanel}
         */
        function createMappingInfobar(isNetwork)
        {
            var title;
            if (isNetwork)
                title = WebInspector.UIString("Map network resource '%s' to workspace?", uiSourceCode.originURL());
            else
                title = WebInspector.UIString("Map workspace resource '%s' to network?", uiSourceCode.path());

            var infobar = new WebInspector.UISourceCodeFrame.Infobar(WebInspector.UISourceCodeFrame.Infobar.Level.Info, title);
            infobar.createDetailsRowMessage(WebInspector.UIString("You can map files in your workspace to the ones loaded over the network. As a result, changes made in DevTools will be persisted to disk."));
            infobar.createDetailsRowMessage(WebInspector.UIString("Use context menu to establish the mapping at any time."));
            var actionLink = infobar.createDetailsRowMessage("").createChild("a");
            actionLink.href = "";
            actionLink.onclick = establishTheMapping.bind(this);
            actionLink.textContent = WebInspector.UIString("Establish the mapping now...");
            appendInfobar(infobar);
        }

        /**
         * @param {?Event} event
         * @this {WebInspector.SourcesPanel}
         */
        function establishTheMapping(event)
        {
            event.consume(true);
            if (uiSourceCode.project().type() === WebInspector.projectTypes.FileSystem)
                this._mapFileSystemToNetwork(uiSourceCode);
            else
                this._mapNetworkToFileSystem(uiSourceCode);
        }

        function createWorkspaceInfobar()
        {
            var infobar = new WebInspector.UISourceCodeFrame.Infobar(WebInspector.UISourceCodeFrame.Infobar.Level.Info, WebInspector.UIString("Serving from the file system? Add your files into the workspace."));
            infobar.createDetailsRowMessage(WebInspector.UIString("If you add files into your DevTools workspace, your changes will be persisted to disk."));
            infobar.createDetailsRowMessage(WebInspector.UIString("To add a folder into the workspace, drag and drop it into the Sources panel."));
            appendInfobar(infobar);
        }

        /**
         * @param {!WebInspector.UISourceCodeFrame.Infobar} infobar
         */
        function appendInfobar(infobar)
        {
            infobar.createDetailsRowMessage("").createChild("br");
            var rowElement = infobar.createDetailsRowMessage(WebInspector.UIString("For more information on workspaces, refer to the "));
            var a = rowElement.createChild("a");
            a.textContent = "workspaces documentation";
            a.href = "https://developer.chrome.com/devtools/docs/workspaces";
            rowElement.createTextChild(".");
            uiSourceCode[WebInspector.SourcesPanel._infobarSymbol] = infobar;
            uiSourceCodeFrame.attachInfobars([infobar]);
        }
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _editorClosed: function(event)
    {
        var wasSelected = /** @type {boolean} */ (event.data.wasSelected);
        if (wasSelected)
            this._editorChanged(null);
    },

    /**
     * @param {?WebInspector.UISourceCode} uiSourceCode
     */
    _editorChanged: function(uiSourceCode)
    {
        var isSnippet = uiSourceCode && uiSourceCode.project().type() === WebInspector.projectTypes.Snippets;
        this._runSnippetButton.element.classList.toggle("hidden", !isSnippet);
    },

    /**
     * @return {boolean}
     */
    togglePause: function()
    {
        var target = WebInspector.context.flavor(WebInspector.Target);
        if (!target)
            return true;

        if (this._paused) {
            this._paused = false;
            target.debuggerModel.resume();
        } else {
            // Make sure pauses didn't stick skipped.
            target.debuggerModel.pause();
        }

        this._clearInterface();
        return true;
    },

    /**
     * @return {?WebInspector.DebuggerModel}
     */
    _prepareToResume: function()
    {
        if (!this._paused)
            return null;

        this._paused = false;

        this._clearInterface();
        var target = WebInspector.context.flavor(WebInspector.Target);
        return target ? target.debuggerModel : null;
    },

    /**
     * @return {boolean}
     */
    _longResume: function()
    {
        var debuggerModel = this._prepareToResume();
        if (!debuggerModel)
            return true;

        debuggerModel.skipAllPausesUntilReloadOrTimeout(500);
        debuggerModel.resume();
        return true;
    },

    /**
     * @return {boolean}
     */
    _stepOverClicked: function()
    {
        var debuggerModel = this._prepareToResume();
        if (!debuggerModel)
            return true;

        debuggerModel.stepOver();
        return true;
    },

    /**
     * @return {boolean}
     */
    _stepIntoClicked: function()
    {
        var debuggerModel = this._prepareToResume();
        if (!debuggerModel)
            return true;

        debuggerModel.stepInto();
        return true;
    },

    /**
     * @return {boolean}
     */
    _stepOutClicked: function()
    {
        var debuggerModel = this._prepareToResume();
        if (!debuggerModel)
            return true;

        debuggerModel.stepOut();
        return true;
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _callFrameSelectedInSidebar: function(event)
    {
        var callFrame = /** @type {!WebInspector.DebuggerModel.CallFrame} */ (event.data);
        callFrame.target().debuggerModel.setSelectedCallFrame(callFrame);
    },

    /**
     * @param {!WebInspector.DebuggerModel.Location} rawLocation
     */
    continueToLocation: function(rawLocation)
    {
        if (!this._prepareToResume())
            return;

        rawLocation.continueToLocation();
    },

    _toggleBreakpointsClicked: function(event)
    {
        WebInspector.breakpointManager.setBreakpointsActive(!WebInspector.breakpointManager.breakpointsActive());
    },

    _breakpointsActiveStateChanged: function(event)
    {
        var active = event.data;
        this._toggleBreakpointsButton.toggled = !active;
        this.sidebarPanes.jsBreakpoints.listElement.classList.toggle("breakpoints-list-deactivated", !active);
        this._sourcesView.toggleBreakpointsActiveState(active);
        if (active)
            this._toggleBreakpointsButton.title = WebInspector.UIString("Deactivate breakpoints.");
        else
            this._toggleBreakpointsButton.title = WebInspector.UIString("Activate breakpoints.");
    },

    _createDebugToolbar: function()
    {
        var debugToolbar = document.createElementWithClass("div", "scripts-debug-toolbar");

        var title, handler;
        var platformSpecificModifier = WebInspector.KeyboardShortcut.Modifiers.CtrlOrMeta;

        // Run snippet.
        title = WebInspector.UIString("Run snippet (%s).");
        handler = this._runSnippet.bind(this);
        this._runSnippetButton = this._createButtonAndRegisterShortcuts("scripts-run-snippet", title, handler, WebInspector.ShortcutsScreen.SourcesPanelShortcuts.RunSnippet);
        debugToolbar.appendChild(this._runSnippetButton.element);
        this._runSnippetButton.element.classList.add("hidden");

        // Continue.
        this._pauseButton = this._createButtonAndRegisterShortcutsForAction("scripts-pause", "", "debugger.toggle-pause");
        debugToolbar.appendChild(this._pauseButton.element);

        // Long resume.
        title = WebInspector.UIString("Resume with all pauses blocked for 500 ms");
        this._longResumeButton = new WebInspector.StatusBarButton(title, "scripts-long-resume");
        this._longResumeButton.addEventListener("click", this._longResume.bind(this), this);

        // Step over.
        title = WebInspector.UIString("Step over next function call (%s).");
        handler = this._stepOverClicked.bind(this);
        this._stepOverButton = this._createButtonAndRegisterShortcuts("scripts-step-over", title, handler, WebInspector.ShortcutsScreen.SourcesPanelShortcuts.StepOver);
        debugToolbar.appendChild(this._stepOverButton.element);

        // Step into.
        title = WebInspector.UIString("Step into next function call (%s).");
        handler = this._stepIntoClicked.bind(this);
        this._stepIntoButton = this._createButtonAndRegisterShortcuts("scripts-step-into", title, handler, WebInspector.ShortcutsScreen.SourcesPanelShortcuts.StepInto);
        debugToolbar.appendChild(this._stepIntoButton.element);

        // Step out.
        title = WebInspector.UIString("Step out of current function (%s).");
        handler = this._stepOutClicked.bind(this);
        this._stepOutButton = this._createButtonAndRegisterShortcuts("scripts-step-out", title, handler, WebInspector.ShortcutsScreen.SourcesPanelShortcuts.StepOut);
        debugToolbar.appendChild(this._stepOutButton.element);

        // Toggle Breakpoints
        this._toggleBreakpointsButton = new WebInspector.StatusBarButton(WebInspector.UIString("Deactivate breakpoints."), "scripts-toggle-breakpoints");
        this._toggleBreakpointsButton.toggled = false;
        this._toggleBreakpointsButton.addEventListener("click", this._toggleBreakpointsClicked, this);
        debugToolbar.appendChild(this._toggleBreakpointsButton.element);

        // Pause on Exception
        this._pauseOnExceptionButton = new WebInspector.StatusBarButton("", "scripts-pause-on-exceptions-status-bar-item");
        this._pauseOnExceptionButton.addEventListener("click", this._togglePauseOnExceptions, this);
        debugToolbar.appendChild(this._pauseOnExceptionButton.element);

        return debugToolbar;
    },

    _createDebugToolbarDrawer: function()
    {
        var debugToolbarDrawer = document.createElementWithClass("div", "scripts-debug-toolbar-drawer");

        var label = WebInspector.UIString("Pause On Caught Exceptions");
        var setting = WebInspector.settings.pauseOnCaughtException;
        debugToolbarDrawer.appendChild(WebInspector.SettingsUI.createSettingCheckbox(label, setting, true));

        return debugToolbarDrawer;
    },

    /**
     * @param {!WebInspector.StatusBarButton} button
     * @param {string} buttonTitle
     */
    _updateButtonTitle: function(button, buttonTitle)
    {
        var hasShortcuts = button.shortcuts && button.shortcuts.length;
        if (hasShortcuts)
            button.title = String.vsprintf(buttonTitle, [button.shortcuts[0].name]);
        else
            button.title = buttonTitle;
    },

    /**
     * @param {string} buttonId
     * @param {string} buttonTitle
     * @param {function(!Event=):boolean} handler
     * @param {!Array.<!WebInspector.KeyboardShortcut.Descriptor>} shortcuts
     * @return {!WebInspector.StatusBarButton}
     */
    _createButtonAndRegisterShortcuts: function(buttonId, buttonTitle, handler, shortcuts)
    {
        var button = new WebInspector.StatusBarButton(buttonTitle, buttonId);
        button.element.addEventListener("click", handler, false);
        button.shortcuts = shortcuts;
        this._updateButtonTitle(button, buttonTitle);
        this.registerShortcuts(shortcuts, handler);
        return button;
    },

    /**
     * @param {string} buttonId
     * @param {string} buttonTitle
     * @param {string} actionId
     * @return {!WebInspector.StatusBarButton}
     */
    _createButtonAndRegisterShortcutsForAction: function(buttonId, buttonTitle, actionId)
    {
        /**
         * @return {boolean}
         */
        function handler()
        {
            return WebInspector.actionRegistry.execute(actionId);
        }
        var shortcuts = WebInspector.shortcutRegistry.shortcutDescriptorsForAction(actionId);
        return this._createButtonAndRegisterShortcuts(buttonId, buttonTitle, handler, shortcuts);
    },

    addToWatch: function(expression)
    {
        this.sidebarPanes.watchExpressions.addExpression(expression);
    },

    _installDebuggerSidebarController: function()
    {
        this._toggleNavigatorSidebarButton = this.editorView.createShowHideSidebarButton("navigator", "scripts-navigator-show-hide-button");
        this.editorView.mainElement().appendChild(this._toggleNavigatorSidebarButton.element);

        this._toggleDebuggerSidebarButton = this._splitView.createShowHideSidebarButton("debugger", "scripts-debugger-show-hide-button");

        this._splitView.mainElement().appendChild(this._toggleDebuggerSidebarButton.element);
        this._splitView.mainElement().appendChild(this._debugSidebarResizeWidgetElement);
    },

    _updateDebugSidebarResizeWidget: function()
    {
        this._debugSidebarResizeWidgetElement.classList.toggle("hidden", this._splitView.showMode() !== WebInspector.SplitView.ShowMode.Both);
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _showLocalHistory: function(uiSourceCode)
    {
        WebInspector.RevisionHistoryView.showHistory(uiSourceCode);
    },

    /**
     * @param {!Event} event
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        this._appendUISourceCodeItems(event, contextMenu, target);
        this._appendRemoteObjectItems(contextMenu, target);
    },

    _suggestReload: function()
    {
        if (window.confirm(WebInspector.UIString("It is recommended to restart inspector after making these changes. Would you like to restart it?")))
            WebInspector.reload();
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _mapFileSystemToNetwork: function(uiSourceCode)
    {
        WebInspector.SelectUISourceCodeForProjectTypesDialog.show(uiSourceCode.name(), [WebInspector.projectTypes.Network, WebInspector.projectTypes.ContentScripts], mapFileSystemToNetwork.bind(this), this.editorView.mainElement())

        /**
         * @param {!WebInspector.UISourceCode} networkUISourceCode
         * @this {WebInspector.SourcesPanel}
         */
        function mapFileSystemToNetwork(networkUISourceCode)
        {
            this._workspace.addMapping(networkUISourceCode, uiSourceCode, WebInspector.fileSystemWorkspaceBinding);
            this._suggestReload();
        }
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _removeNetworkMapping: function(uiSourceCode)
    {
        if (confirm(WebInspector.UIString("Are you sure you want to remove network mapping?"))) {
            this._workspace.removeMapping(uiSourceCode);
            this._suggestReload();
        }
    },

    /**
     * @param {!WebInspector.UISourceCode} networkUISourceCode
     */
    _mapNetworkToFileSystem: function(networkUISourceCode)
    {
        WebInspector.SelectUISourceCodeForProjectTypesDialog.show(networkUISourceCode.name(), [WebInspector.projectTypes.FileSystem], mapNetworkToFileSystem.bind(this), this.editorView.mainElement())

        /**
         * @param {!WebInspector.UISourceCode} uiSourceCode
         * @this {WebInspector.SourcesPanel}
         */
        function mapNetworkToFileSystem(uiSourceCode)
        {
            this._workspace.addMapping(networkUISourceCode, uiSourceCode, WebInspector.fileSystemWorkspaceBinding);
            this._suggestReload();
        }
    },

    /**
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _appendUISourceCodeMappingItems: function(contextMenu, uiSourceCode)
    {
        if (uiSourceCode.project().type() === WebInspector.projectTypes.FileSystem) {
            var hasMappings = !!uiSourceCode.url;
            if (!hasMappings)
                contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Map to network resource\u2026" : "Map to Network Resource\u2026"), this._mapFileSystemToNetwork.bind(this, uiSourceCode));
            else
                contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Remove network mapping" : "Remove Network Mapping"), this._removeNetworkMapping.bind(this, uiSourceCode));
        }

        /**
         * @param {!WebInspector.Project} project
         */
        function filterProject(project)
        {
            return project.type() === WebInspector.projectTypes.FileSystem;
        }

        if (uiSourceCode.project().type() === WebInspector.projectTypes.Network || uiSourceCode.project().type() === WebInspector.projectTypes.ContentScripts) {
            if (!this._workspace.projects().filter(filterProject).length)
                return;
            if (this._workspace.uiSourceCodeForURL(uiSourceCode.url) === uiSourceCode)
                contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Map to file system resource\u2026" : "Map to File System Resource\u2026"), this._mapNetworkToFileSystem.bind(this, uiSourceCode));
        }
    },

    /**
     * @param {!Event} event
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     */
    _appendUISourceCodeItems: function(event, contextMenu, target)
    {
        if (!(target instanceof WebInspector.UISourceCode))
            return;

        var uiSourceCode = /** @type {!WebInspector.UISourceCode} */ (target);
        var projectType = uiSourceCode.project().type();
        if (projectType !== WebInspector.projectTypes.FileSystem)
            contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Local modifications\u2026" : "Local Modifications\u2026"), this._showLocalHistory.bind(this, uiSourceCode));
        this._appendUISourceCodeMappingItems(contextMenu, uiSourceCode);

        var contentType = uiSourceCode.contentType();
        if ((contentType === WebInspector.resourceTypes.Script || contentType === WebInspector.resourceTypes.Document) && projectType !== WebInspector.projectTypes.Snippets)
            this.sidebarPanes.callstack.appendBlackboxURLContextMenuItems(contextMenu, uiSourceCode.url, projectType === WebInspector.projectTypes.ContentScripts);

        if (!event.target.isSelfOrDescendant(this.editorView.sidebarElement())) {
            contextMenu.appendSeparator();
            contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Reveal in navigator" : "Reveal in Navigator"), this._handleContextMenuReveal.bind(this, uiSourceCode));
        }
    },

    /**
     * @param {!WebInspector.UISourceCode} uiSourceCode
     */
    _handleContextMenuReveal: function(uiSourceCode)
    {
        this.editorView.showBoth();
        this._revealInNavigator(uiSourceCode);
    },

    /**
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     */
    _appendRemoteObjectItems: function(contextMenu, target)
    {
        if (!(target instanceof WebInspector.RemoteObject))
            return;
        var remoteObject = /** @type {!WebInspector.RemoteObject} */ (target);
        contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Store as global variable" : "Store as Global Variable"), this._saveToTempVariable.bind(this, remoteObject));
        if (remoteObject.type === "function")
            contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Show function definition" : "Show Function Definition"), this._showFunctionDefinition.bind(this, remoteObject));
    },

    /**
     * @param {!WebInspector.RemoteObject} remoteObject
     */
    _saveToTempVariable: function(remoteObject)
    {
        var currentExecutionContext = WebInspector.context.flavor(WebInspector.ExecutionContext);
        if (!currentExecutionContext)
            return;

        currentExecutionContext.evaluate("this", "", false, true, false, false, didGetGlobalObject.bind(null, currentExecutionContext.target()));
        /**
         * @param {!WebInspector.Target} target
         * @param {?WebInspector.RemoteObject} global
         * @param {boolean=} wasThrown
         */
        function didGetGlobalObject(target, global, wasThrown)
        {
            /**
             * @suppressReceiverCheck
             * @this {Window}
             */
            function remoteFunction(value)
            {
                var prefix = "temp";
                var index = 1;
                while ((prefix + index) in this)
                    ++index;
                var name = prefix + index;
                this[name] = value;
                return name;
            }

            if (wasThrown || !global)
                failedToSave(target, global);
            else
                global.callFunction(remoteFunction, [WebInspector.RemoteObject.toCallArgument(remoteObject)], didSave.bind(null, global));
        }

        /**
         * @param {!WebInspector.RemoteObject} global
         * @param {?WebInspector.RemoteObject} result
         * @param {boolean=} wasThrown
         */
        function didSave(global, result, wasThrown)
        {
            var currentExecutionContext = WebInspector.context.flavor(WebInspector.ExecutionContext);
            global.release();
            if (!currentExecutionContext || wasThrown || !result || result.type !== "string")
                failedToSave(global.target(), result);
            else
                WebInspector.ConsoleModel.evaluateCommandInConsole(currentExecutionContext, result.value);
        }

        /**
         * @param {!WebInspector.Target} target
         * @param {?WebInspector.RemoteObject} result
         */
        function failedToSave(target, result)
        {
            var message = WebInspector.UIString("Failed to save to temp variable.");
            if (result) {
                message += " " + result.description;
                result.release();
            }
            WebInspector.console.error(message);
        }
    },

    /**
     * @param {!WebInspector.RemoteObject} remoteObject
     */
    _showFunctionDefinition: function(remoteObject)
    {
        var debuggerModel = remoteObject.target().debuggerModel;

        /**
         * @param {?WebInspector.DebuggerModel.FunctionDetails} response
         * @this {WebInspector.SourcesPanel}
         */
        function didGetFunctionDetails(response)
        {
            if (!response || !response.location)
                return;

            var location = response.location;
            if (!location)
                return;

            var uiLocation = WebInspector.debuggerWorkspaceBinding.rawLocationToUILocation(location);
            if (uiLocation)
                this.showUILocation(uiLocation, true);
        }
        debuggerModel.functionDetails(remoteObject, didGetFunctionDetails.bind(this));
    },

    showGoToSourceDialog: function()
    {
        this._sourcesView.showOpenResourceDialog();
    },

    _dockSideChanged: function()
    {
        var vertically = WebInspector.dockController.isVertical() && WebInspector.settings.splitVerticallyWhenDockedToRight.get();
        this._splitVertically(vertically);
    },

    /**
     * @param {boolean} vertically
     */
    _splitVertically: function(vertically)
    {
        if (this.sidebarPaneView && vertically === !this._splitView.isVertical())
            return;

        if (this.sidebarPaneView)
            this.sidebarPaneView.detach();

        this._splitView.setVertical(!vertically);

        if (!vertically)
            this._splitView.uninstallResizer(this._sourcesView.statusBarContainerElement());
        else
            this._splitView.installResizer(this._sourcesView.statusBarContainerElement());

        // Create vertical box with stack.
        var vbox = new WebInspector.VBox();
        vbox.element.appendChild(this._debugToolbarDrawer);
        vbox.element.appendChild(this.debugToolbar);
        vbox.setMinimumAndPreferredSizes(25, 25, WebInspector.SourcesPanel.minToolbarWidth, 100);
        var sidebarPaneStack = new WebInspector.SidebarPaneStack();
        sidebarPaneStack.element.classList.add("flex-auto");
        sidebarPaneStack.show(vbox.element);

        if (!vertically) {
            // Populate the only stack.
            for (var pane in this.sidebarPanes)
                sidebarPaneStack.addPane(this.sidebarPanes[pane]);
            this._extensionSidebarPanesContainer = sidebarPaneStack;
            this.sidebarPaneView = vbox;
        } else {
            var splitView = new WebInspector.SplitView(true, true, "sourcesPanelDebuggerSidebarSplitViewState", 0.5);
            vbox.show(splitView.mainElement());

            // Populate the left stack.
            sidebarPaneStack.addPane(this.sidebarPanes.threads);
            sidebarPaneStack.addPane(this.sidebarPanes.callstack);
            sidebarPaneStack.addPane(this.sidebarPanes.jsBreakpoints);
            sidebarPaneStack.addPane(this.sidebarPanes.domBreakpoints);
            sidebarPaneStack.addPane(this.sidebarPanes.xhrBreakpoints);
            sidebarPaneStack.addPane(this.sidebarPanes.eventListenerBreakpoints);

            var tabbedPane = new WebInspector.SidebarTabbedPane();
            tabbedPane.show(splitView.sidebarElement());
            tabbedPane.addPane(this.sidebarPanes.scopechain);
            tabbedPane.addPane(this.sidebarPanes.watchExpressions);
            this._extensionSidebarPanesContainer = tabbedPane;

            this.sidebarPaneView = splitView;
        }
        for (var i = 0; i < this._extensionSidebarPanes.length; ++i)
            this._extensionSidebarPanesContainer.addPane(this._extensionSidebarPanes[i]);

        this.sidebarPaneView.show(this._splitView.sidebarElement());
        this.sidebarPanes.threads.expand();
        this.sidebarPanes.scopechain.expand();
        this.sidebarPanes.jsBreakpoints.expand();
        this.sidebarPanes.callstack.expand();
        this._sidebarPaneStack = sidebarPaneStack;
        this._updateTargetsSidebarVisibility();
        if (WebInspector.settings.watchExpressions.get().length > 0)
            this.sidebarPanes.watchExpressions.expand();
    },

    /**
     * @param {string} id
     * @param {!WebInspector.SidebarPane} pane
     */
    addExtensionSidebarPane: function(id, pane)
    {
        this._extensionSidebarPanes.push(pane);
        this._extensionSidebarPanesContainer.addPane(pane);
        this.setHideOnDetach();
    },

    /**
     * @return {!WebInspector.SourcesView}
     */
    sourcesView: function()
    {
        return this._sourcesView;
    },

    /**
     * @param {!WebInspector.Target} target
     */
    targetAdded: function(target)
    {
        this._updateTargetsSidebarVisibility();
    },

    /**
     * @param {!WebInspector.Target} target
     */
    targetRemoved: function(target)
    {
        this._updateTargetsSidebarVisibility();
    },

    _updateTargetsSidebarVisibility: function()
    {
        if (!this._sidebarPaneStack)
            return;
        // FIXME(413886): We could remove worker frontend check here once we support explicit threads and do not send main thread for service/shared workers to frontend.
        this._sidebarPaneStack.togglePaneHidden(this.sidebarPanes.threads, WebInspector.targetManager.targets().length < 2 || WebInspector.isWorkerFrontend());
    },

    __proto__: WebInspector.Panel.prototype
}

/**
 * @constructor
 * @param {!Element} element
 */
WebInspector.UpgradeFileSystemDropTarget = function(element)
{
    element.addEventListener("dragenter", this._onDragEnter.bind(this), true);
    element.addEventListener("dragover", this._onDragOver.bind(this), true);
    this._element = element;
}

WebInspector.UpgradeFileSystemDropTarget.dragAndDropFilesType = "Files";

WebInspector.UpgradeFileSystemDropTarget.prototype = {
    _onDragEnter: function (event)
    {
        if (event.dataTransfer.types.indexOf(WebInspector.UpgradeFileSystemDropTarget.dragAndDropFilesType) === -1)
            return;
        event.consume(true);
    },

    _onDragOver: function (event)
    {
        if (event.dataTransfer.types.indexOf(WebInspector.UpgradeFileSystemDropTarget.dragAndDropFilesType) === -1)
            return;
        event.dataTransfer.dropEffect = "copy";
        event.consume(true);
        if (this._dragMaskElement)
            return;
        this._dragMaskElement = this._element.createChild("div", "fill drag-mask");
        this._dragMaskElement.createChild("div", "fill drag-mask-inner").textContent = WebInspector.UIString("Drop workspace folder here");
        this._dragMaskElement.addEventListener("drop", this._onDrop.bind(this), true);
        this._dragMaskElement.addEventListener("dragleave", this._onDragLeave.bind(this), true);
    },

    _onDrop: function (event)
    {
        event.consume(true);
        this._removeMask();
        var items = /** @type {!Array.<!DataTransferItem>} */ (event.dataTransfer.items);
        if (!items.length)
            return;
        var entry = items[0].webkitGetAsEntry();
        if (!entry.isDirectory)
            return;
        InspectorFrontendHost.upgradeDraggedFileSystemPermissions(entry.filesystem);
    },

    _onDragLeave: function (event)
    {
        event.consume(true);
        this._removeMask();
    },

    _removeMask: function ()
    {
        this._dragMaskElement.remove();
        delete this._dragMaskElement;
    }
}

/**
 * @constructor
 * @implements {WebInspector.ContextMenu.Provider}
 */
WebInspector.SourcesPanel.ContextMenuProvider = function()
{
}

WebInspector.SourcesPanel.ContextMenuProvider.prototype = {
    /**
     * @param {!Event} event
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        WebInspector.SourcesPanel.instance().appendApplicableItems(event, contextMenu, target);
    }
}

/**
 * @constructor
 * @implements {WebInspector.Revealer}
 */
WebInspector.SourcesPanel.UILocationRevealer = function()
{
}

WebInspector.SourcesPanel.UILocationRevealer.prototype = {
    /**
     * @param {!Object} uiLocation
     * @return {!Promise}
     */
    reveal: function(uiLocation)
    {
        if (uiLocation instanceof WebInspector.UILocation) {
            WebInspector.SourcesPanel.instance().showUILocation(uiLocation);
            return Promise.resolve();
        }
        return Promise.rejectWithError("Internal error: not a ui location");
    }
}

/**
 * @constructor
 * @implements {WebInspector.Revealer}
 */
WebInspector.SourcesPanel.UISourceCodeRevealer = function()
{
}

WebInspector.SourcesPanel.UISourceCodeRevealer.prototype = {
    /**
     * @param {!Object} uiSourceCode
     * @return {!Promise}
     */
    reveal: function(uiSourceCode)
    {
        if (uiSourceCode instanceof WebInspector.UISourceCode) {
            WebInspector.SourcesPanel.instance().showUISourceCode(uiSourceCode);
            return Promise.resolve();
        }
        return Promise.rejectWithError("Internal error: not a ui source code");
    }
}

/**
 * @constructor
 * @implements {WebInspector.Revealer}
 */
WebInspector.SourcesPanel.DebuggerPausedDetailsRevealer = function()
{
}

WebInspector.SourcesPanel.DebuggerPausedDetailsRevealer.prototype = {
    /**
     * @param {!Object} object
     * @return {!Promise}
     */
    reveal: function(object)
    {
        WebInspector.inspectorView.setCurrentPanel(WebInspector.SourcesPanel.instance());
        return Promise.resolve();
    }
}

/**
 * @constructor
 * @implements {WebInspector.ActionDelegate}
 */
WebInspector.SourcesPanel.ShowGoToSourceDialogActionDelegate = function() {}

WebInspector.SourcesPanel.ShowGoToSourceDialogActionDelegate.prototype = {
    /**
     * @return {boolean}
     */
    handleAction: function()
    {
        var panel = WebInspector.SourcesPanel.instance();
        WebInspector.inspectorView.setCurrentPanel(panel);
        panel.showGoToSourceDialog();
        return true;
    }
}

/**
 * @constructor
 * @extends {WebInspector.UISettingDelegate}
 */
WebInspector.SourcesPanel.DisableJavaScriptSettingDelegate = function()
{
    WebInspector.UISettingDelegate.call(this);
}

WebInspector.SourcesPanel.DisableJavaScriptSettingDelegate.prototype = {
    /**
     * @override
     * @return {!Element}
     */
    settingElement: function()
    {
        var disableJSElement = WebInspector.SettingsUI.createSettingCheckbox(WebInspector.UIString("Disable JavaScript"), WebInspector.settings.javaScriptDisabled);
        this._disableJSCheckbox = disableJSElement.getElementsByTagName("input")[0];
        WebInspector.settings.javaScriptDisabled.addChangeListener(this._settingChanged, this);
        var disableJSInfoParent = this._disableJSCheckbox.parentElement.createChild("span", "monospace");
        this._disableJSInfo = disableJSInfoParent.createChild("span", "object-info-state-note hidden");
        this._disableJSInfo.title = WebInspector.UIString("JavaScript is blocked on the inspected page (may be disabled in browser settings).");

        WebInspector.targetManager.addEventListener(WebInspector.TargetManager.Events.MainFrameNavigated, this._updateScriptDisabledCheckbox, this);
        this._updateScriptDisabledCheckbox();
        return disableJSElement;
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _settingChanged: function(event)
    {
        PageAgent.setScriptExecutionDisabled(event.data, this._updateScriptDisabledCheckbox.bind(this));
    },

    _updateScriptDisabledCheckbox: function()
    {
        PageAgent.getScriptExecutionStatus(executionStatusCallback.bind(this));

        /**
         * @param {?Protocol.Error} error
         * @param {string} status
         * @this {WebInspector.SourcesPanel.DisableJavaScriptSettingDelegate}
         */
        function executionStatusCallback(error, status)
        {
            if (error || !status)
                return;

            var forbidden = (status === "forbidden");
            var disabled = forbidden || (status === "disabled");

            this._disableJSInfo.classList.toggle("hidden", !forbidden);
            this._disableJSCheckbox.checked = disabled;
            this._disableJSCheckbox.disabled = forbidden;
        }
    },

    __proto__: WebInspector.UISettingDelegate.prototype
}

/**
 * @constructor
 * @implements {WebInspector.ActionDelegate}
 */
WebInspector.SourcesPanel.TogglePauseActionDelegate = function()
{
}

WebInspector.SourcesPanel.TogglePauseActionDelegate.prototype = {
    /**
     * @return {boolean}
     */
    handleAction: function()
    {
        var panel = WebInspector.SourcesPanel.instance();
        WebInspector.inspectorView.setCurrentPanel(panel);
        panel.togglePause();
        return true;
    }
}

WebInspector.SourcesPanel.show = function()
{
    WebInspector.inspectorView.setCurrentPanel(WebInspector.SourcesPanel.instance());
}

/**
 * @return {!WebInspector.SourcesPanel}
 */
WebInspector.SourcesPanel.instance = function()
{
    if (!WebInspector.SourcesPanel._instanceObject)
        WebInspector.SourcesPanel._instanceObject = new WebInspector.SourcesPanel();
    return WebInspector.SourcesPanel._instanceObject;
}

/**
 * @constructor
 * @implements {WebInspector.PanelFactory}
 */
WebInspector.SourcesPanelFactory = function()
{
}

WebInspector.SourcesPanelFactory.prototype = {
    /**
     * @return {!WebInspector.Panel}
     */
    createPanel: function()
    {
        return WebInspector.SourcesPanel.instance();
    }
}
