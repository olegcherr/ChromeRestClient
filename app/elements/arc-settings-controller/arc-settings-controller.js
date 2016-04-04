(function() {
'use strict';

Polymer({
  is: 'arc-settings-controller',
  behaviors: [
    ArcBehaviors.ArcControllerBehavior
  ],
  properties: {
    /**
     * System settings object.
     * This keeps values saved in sync storage.
     *
     * @type {Object.<string, boolean>}
     */
    values: {
      type: Object
    },
    /**
     * A handler for a storage change event.
     *
     * @type {Function}
     */
    _storageObserver: {
      type: Function,
      value: function() {
        return this._onStorageChanged.bind(this);
      }
    },
    /**
     * True when the settings object has been initialized.
     */
    initialized: {
      type: Boolean,
      value: false
    },
    /**
     * State of the GA tracking.
     * It's outside the regular app's settings system since it's controled by the library.
     * Therefore it must be set in the UI as a different object.
     *
     * @type {Boolean}
     */
    gaEnabled: {
      type: Boolean,
      value: true
    },

    showNotifications: {
      type: Boolean,
      value: false,
      readOnly: true
    },

    notificationsEnabled: {
      type: Boolean,
      value: false
    }
  },
  observers: [
    '_onValueChange(values.*)'
  ],

  onShow: function() {
    this._setPageTitle('Settings');
    this.set('gaEnabled', arc.app.analytics.enabled);
  },

  onHide: function() {
    this._setPageTitle('');
  },

  ready: function() {
    if (!arc.app.settings || !arc.app.settings.getConfig) {
      throw new Error('The arc.app.settings library not ready');
    }
    arc.app.settings.getConfig()
      .then(function(values) {
        this.set('values', values);
        //propagate value changes first on initialize time.
        window.setTimeout(function() {
          this.initialized = true;
        }.bind(this), 0);
      }.bind(this));
    chrome.storage.onChanged.addListener(this._storageObserver);
    var channel  = arc.app.utils.releaseChannel;
    if (channel !== 'stable') {
      this._setShowNotifications(true);
      this._checkNotificationsPermissions();
    }
  },
  /**
   * Check if user allowed desktop notifications.
   */
  _checkNotificationsPermissions: function() {
    chrome.permissions.contains({permissions: ['notifications']}, (granted) => {
      this.set('notificationsEnabled', granted);
    });
  },

  /**
   * A callback called when the value of any storage change.
   * This view should handle external changes to the store.
   */
  _onStorageChanged: function(changes) {
    var keys = Object.keys(changes);
    var accepted = ['HISTORY_ENABLED', 'MAGICVARS_ENABLED'];
    keys.forEach(function(key) {
      if (accepted.indexOf(key) !== -1 && this.values[key] !== changes[key].newValue) {
        this.set('values.' + key, changes[key].newValue);
      }
    }.bind(this));
  },

  /**
   * A function called when any value change.
   */
  _onValueChange: function(changeRecord) {
    if (!this.initialized) {
      return;
    }
    var key = changeRecord.path.replace('values.', '');
    var value = changeRecord.value;
    arc.app.settings.saveConfig(key, value);
    var o = {
      'key': key,
      'value': value
    };
    console.log('Setting changed', key, value);
    this.fire('settings-saved', o);
    arc.app.analytics.sendEvent('Settings usage', key, value + '');
  },
  /**
   * Open the dialog with magic variables explanation.
   */
  openMagicVariablesDialog: function() {
    this.$.magicVatDialog.open();
  },

  showTutorial: function() {
    var tutorial = document.querySelector('#onboarding');
    if (!tutorial) {
      return;
    }
    tutorial.open();
  },

  historyClearClick: function() {
    this.$.historyClearDialog.open();
  },

  onClearDialogResult: function(e) {
    if (e.detail.canceled || !e.detail.confirmed) {
      return;
    }
    var _db;
    arc.app.db.idb.open().then((db) => {
      _db = db;
      return db.requestObject.where('type').equals('history').delete();
    })
    .then((deleteCount) => {
      console.log('Deleted ' + deleteCount + ' objects');
    })
    .then(() => {
      _db.close();
    })
    .catch((e) => {
      console.error('Error clearing the history', e);
      throw e;
    });

    arc.app.analytics.sendEvent('Settings usage', 'Clear history', 'true');
  },

  _gaSettingTapped: function() {
    arc.app.analytics.setAnalyticsPermitted(this.gaEnabled);
  },

  _notificationsTapped: function() {
    if (this.notificationsEnabled) {
      chrome.permissions.request({permissions: ['notifications']}, (granted) => {
        if (!granted) {
          this.set('notificationsEnabled', false);
        }
      });
    } else {
      console.info('Removing notifications permission');
      chrome.permissions.remove({permissions: ['notifications']});
    }
  },

  _showAddToDesktopTutotial: function() {
    this.$.addShortcutsToDesktop.open();
  },

  _openApps: function() {
    window.open('chrome://apps');
  }
});
})();
