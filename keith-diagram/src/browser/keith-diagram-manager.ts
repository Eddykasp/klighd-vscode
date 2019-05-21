/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2018-2019 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */

import { SynthesisRegistry } from '@kieler/keith-sprotty/lib/syntheses/synthesis-registry';
import { Emitter, Event } from '@theia/core';
import { OpenerOptions, Widget, WidgetManager, WidgetOpenerOptions } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { Workspace } from '@theia/languages/lib/browser';
import { inject, injectable } from 'inversify';
import { DiagramManager, DiagramWidget, DiagramWidgetOptions, LSTheiaSprottyConnector, TheiaFileSaver } from 'sprotty-theia/lib';
import { KeithDiagramLanguageClient } from './keith-diagram-language-client';
import { KeithDiagramWidget } from './keith-diagram-widget';
import { KeithTheiaSprottyConnector } from './keith-theia-sprotty-connector';

/**
 * Class managing the creation of KEITH diagram widgets and connecting them to their diagram server.
 * Based on the theia-yang-extension implementation by TypeFox.
 * @see https://github.com/theia-ide/yangster/blob/master/theia-yang-extension/src/frontend/yangdiagram/yang-diagram-manager.ts
 */
@injectable()
export class KeithDiagramManager extends DiagramManager {

    public static DIAGRAM_TYPE = 'keith-diagram'
    readonly diagramType = KeithDiagramManager.DIAGRAM_TYPE
    readonly iconClass = 'fa fa-square-o'

    _diagramConnector: LSTheiaSprottyConnector

    protected readonly onDiagramOpenedEmitter = new Emitter<URI>()

    get onDiagramOpened(): Event<URI> {
        return this.onDiagramOpenedEmitter.event
    }

    constructor(
        @inject(KeithDiagramLanguageClient) diagramLanguageClient: KeithDiagramLanguageClient,
        @inject(TheiaFileSaver) fileSaver: TheiaFileSaver,
        @inject(EditorManager) editorManager: EditorManager,
        @inject(WidgetManager) widgetManager: WidgetManager,
        @inject(Workspace) workspace: Workspace,
        @inject(SynthesisRegistry) synthesisRegistry: SynthesisRegistry
        ) {
        super()
        this._diagramConnector = new KeithTheiaSprottyConnector({
            diagramLanguageClient, fileSaver, editorManager, widgetManager, workspace, diagramManager: this,
            synthesisRegistry
        })
        editorManager.onCurrentEditorChanged(this.onCurrentEditorChanged.bind(this))
    }

    /**
     * Reloads the diagram widget automatically if the current editor has changed.
     *
     * @param editorWidget The editor that is now active.
     */
    async onCurrentEditorChanged(editorWidget: EditorWidget | undefined): Promise<void> {
        const diagramWidget = this.widgetManager.getWidgets(this.id).pop()
        if (diagramWidget && editorWidget) {
            const uri = editorWidget.getResourceUri()
            if (uri instanceof URI) {
                this.drawDiagram(uri)
            }
        }
    }

    /**
     * Reveals the diagram-widget and draws a diagram for a uri.
     * @param uri uri of model
     */
    public drawDiagram(uri: URI) {
        const diagramWidgetPromise = this.open(uri)
        diagramWidgetPromise.then(widget => {
            if (widget instanceof KeithDiagramWidget) {
                widget.reInitialize(uri)
            }
        })
    }

    open(uri: URI, input?: OpenerOptions): Promise<DiagramWidget> {
        const widgetPromise =  super.open(uri, {...input, mode: 'reveal'})
        widgetPromise.then(() => {
            this.onDiagramOpenedEmitter.fire(uri)
        })
        return widgetPromise
    }

    createWidgetOptions(uri: URI, options?: WidgetOpenerOptions) {
        return {
            ...super.createWidgetOptions(uri, options),
            label: 'Diagram'
        }
    }

    async createWidget(options?: any): Promise<Widget> {
        if (DiagramWidgetOptions.is(options)) {
            const clientId = this.createClientId();
            const config = this.diagramConfigurationRegistry.get(options.diagramType);
            const diContainer = config.createContainer(clientId + '_sprotty');
            const diagramWidget = new KeithDiagramWidget(options, clientId, diContainer, this.diagramConnector);
            return diagramWidget;
        }
        throw Error('DiagramWidgetFactory needs DiagramWidgetOptions but got ' + JSON.stringify(options));
    }

    get diagramConnector() {
        return this._diagramConnector
    }

    get label() {
        return 'Keith diagram'
    }

    createClientId() {
        return this.diagramType
    }
}