/**
 * Copyright (C) 2015 Laverna project Authors.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global define */
define([
    'underscore',
    'marionette',
    'backbone.radio',
    'apps/notes/show/noteView'
], function(_, Marionette, Radio, View) {
    'use strict';

    /**
     * The controller that shows a note.
     *
     * Triggers the following:
     * Events:
     * 1. channel: `appNote`, event: `model:active`
     * Request:
     * 1. channel: editor, request: task:toggle
     * request:
     * 1. channel: notes, request: save
     * 2. channel: appNote, request: `remove:note`
     *    in order to destroy a model
     * 3. channel: global, request: `set:title`
     */
    var Controller = Marionette.Object.extend({

        initialize: function(options) {
            _.bindAll(this, '_show');
            this.options = options;

            // Fetch the note by ID
            Radio.request('notes', 'get:model:full', options)
            .spread(this._show);
        },

        onDestroy: function() {
            this.stopListening(this.view);
            Radio.request('global', 'region:empty', 'content');
        },

        _show: function(note, notebook) {
            // Trigger an event that the model is active
            Radio.trigger('appNote', 'model:active', note);

            this.view = new View({
                model    : note,
                notebook : notebook,
                args     : this.options,
                files    : [],
            });

            // Show the view in the `content` region
            Radio.request('global', 'region:show', 'content', this.view);

            // Set document title
            Radio.request('global', 'set:title', note.get('title'));

            // Events
            this.listenTo(Radio.channel('notes'), 'synced:' + note.id, this.onSync);
            this.listenTo(this.view, 'toggle:task', this.toggleTask);
            this.listenTo(this.view, 'model:remove', this.modelRemove);
            this.listenTo(this.view, 'model:restore', this.modelRestore);
        },

        onSync: function(model) {
            this.view.model.set(model.attributes);
            this.view.model.trigger('synced');
        },

        modelRestore: function() {
            Radio.request('notes', 'restore', this.view.model);
        },

        /**
         * Triggers an event and expects that a model will be destroyed
         */
        modelRemove: function() {
            Radio.request('appNote', 'remove:note', this.view.model.id);
        },

        /**
         * Tries to get new content with toggled task.
         * It is expected that such editor modules as Pagedown
         * replies to the request `task:toggle` and returns an object with
         * counts of completed tasks and content with toggled task.
         */
        toggleTask: function(taskId) {
            var model = this.view.model,

                // Request the content with toggled task.
                task = Radio.request('editor', 'task:toggle', {
                    content : model.get('content'),
                    taskId  : taskId
                });

            // No reply
            if (!task) {
                return;
            }

            // Save the note
            Radio.request('notes', 'save', model, {
                content       : task.content,
                taskCompleted : task.completed
            });
        }
    });

    return Controller;
});
