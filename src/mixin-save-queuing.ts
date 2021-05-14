//#region Copyright, Version, and Description
/*
 * Copyright 2015-2021 IdeaBlade, Inc.  All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the IdeaBlade Breeze license, available at http://www.breezejs.com/license
 *
 * Author: Ward Bell
 * Version: 2.0.6 Steve Schmitt - convert to TypeScript, move to breeze-client repo, change enableSaveQueuing function
 * Version: 2.0.5 Ward Bell
 * --------------------------------------------------------------------------------
 * Adds "Save Queuing" capability to new EntityManagers
 *
 * Save Queuing automatically queues and defers an EntityManager.saveChanges call
 * when another save is in progress for that manager and the server has not yet responded.
 * This feature is helpful when your app needs to allow rapid, continuous changes
 * to entities that may be in the process of being saved.
 *
 * Without "Save Queuing", an EntityManager will throw an exception
 * when you call saveChanges for an entity which is currently being saved.
 *
 * !!! Use with caution !!!
 * It is usually better to disable user input while a save is in progress.
 * Save Queuing may be appropriate for simple "auto-save" scenarios
 * when the save latency is "short" (under a few seconds).
 *
 * Save Queuing is NOT intended for occassionally disconnected or offline scenarios.
 *
 * Save Queuing is experimental. It will not become a part of BreezeJS core
 * but might become an official Breeze plugin in future
 * although not necessarily in this form or with this API
 *
 * Must call EntityManager.enableSaveQueuing(true) to turn it on;
 * EntityManager.enableSaveQueuing(false) restores the manager's original
 * saveChanges method as it was at the time saveQueuing was first enabled.
 *
 * This module adds "enableSaveQueuing" to the EntityManager prototype.
 * Calling "enableSaveQueuing(true)" adds a new _saveQueuing object
 * to the manager instance.
 *
 * See DocCode:saveQueuingTests.js
 * https://github.com/Breeze/breeze.js.samples/blob/master/net/DocCode/DocCode/tests/saveQueuingTests.js
 *
 * LIMITATIONS
 * - Can't handle changes to the primary key (dangerous in any case)
 * - Assumes promises. Does not support the (deprecated) success and fail callbacks
 * - Does not queue saveOptions. The first one is re-used for all queued saves.
 * - Does not deal with export/import of entities while save is inflight
 * - Does not deal with rejectChanges while save is in flight
 * - Does not support parallel saves even when the change-sets are independent.
 *   The native saveChanges allows such saves.
 *   SaveQueuing does not; too complex and doesn't fit the primary scenario anyway.
 * - The resolved saveResult is the saveResult of the last completed save
 * - A queued save that might have succeeded if saved immediately
 *   may fail because the server no longer accepts it later
 * - Prior to Breeze v.1.5.3, a queued save that might have succeeded
 *   if saved immediately will fail if subsequently attempt to save
 *   an invalid entity. Can detect and circumvent after v.1.5.3.
 *
 * All members of EntityManager._saveQueuing are internal;
 * touch them at your own risk.
 */
//#endregion
import { Entity, EntityManager, KeyMapping, EntityState, SaveResult, breeze } from 'breeze-client';


export function enableSaveQueuing(em: EntityManager, enable: boolean = true) {
  let saveQueuing = em['_saveQueueing'] ||
    (em['_saveQueuing'] = new SaveQueuing(em));

  enable = (enable === undefined) ? true : enable;
  saveQueuing._isEnabled = enable;
  if (enable) {
    // delegate to save changes queuing
    em.saveChanges = saveChangesWithQueuing;
  } else {
    // revert to the native EntityManager.saveChanges
    em.saveChanges = em['_saveQueuing'].baseSaveChanges;
  }
}

/**
 * Replacement for EntityManager.saveChanges
 * This version queues saveChanges calls while a real save is in progress
 **/
function saveChangesWithQueuing(entities: Entity[] | null, saveOptions: any) {
  try {
    // `this` is an EntityManager
    let saveQueuing = this._saveQueuing;
    if (saveQueuing.isSaving) {
      // save in progress; queue the save for later
      return saveQueuing.queueSaveChanges(entities);
    } else {
      // note that save is in progress; then save
      saveQueuing.isSaving = true;
      saveQueuing.saveOptions = saveOptions;
      return saveQueuing.saveChanges(entities, saveOptions);
    }
  } catch (err) {
    return Promise.reject(err);
  }
}

///////// SaveQueuing /////////
class SaveQueuing {
  entityManager: EntityManager;
  baseSaveChanges: () => Promise<any>;
  isSaving: boolean;
  _isEnabled: boolean;
  activeSaveDeferred: Deferred<SaveResult>;
  nextSaveDeferred: Deferred<SaveResult>;
  activeSaveMemo: SaveMemo;
  nextSaveMemo: SaveMemo;
  saveOptions: any;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
    this.baseSaveChanges = entityManager.saveChanges;
    this.isSaving = false;
  }

  isEnabled() {
    return this._isEnabled;
  }

  getSavedNothingResult(): SaveResult {
    return { entities: [] as Entity[], keyMappings: [] as KeyMapping[] };
  }

  queueSaveChanges(entities: Entity[]) {
    let self = this; // `this` is a SaveQueuing
    let em = self.entityManager;

    let changes = entities || em.getChanges();
    if (changes.length === 0) {
      return Promise.resolve(this.getSavedNothingResult());
    }

    let valError = em.saveChangesValidateOnClient(changes);
    if (valError) {
      return Promise.reject(valError);
    }

    let saveMemo = self.nextSaveMemo || (self.nextSaveMemo = new SaveMemo());
    memoizeChanges();
    let deferred = self.nextSaveDeferred || (self.nextSaveDeferred = new Deferred<SaveResult>());
    return deferred.promise;

    function memoizeChanges() {
      if (changes.length === 0) { return; }
      let queuedChanges = saveMemo.queuedChanges;
      changes.forEach(e => {
        if (!e.entityAspect.isBeingSaved && queuedChanges.indexOf(e) === -1) {
          queuedChanges.push(e);
        }
      });

      saveMemo.updateEntityMemos(changes);
    }
  }

  saveChanges(entities: Entity[], saveOptions: any) {
    let self = this; // `this` is a SaveQueuing
    let promise = self.baseSaveChanges.call(self.entityManager, entities, saveOptions || self.saveOptions)
      .then(function (saveResult: SaveResult) { return self.saveSucceeded(saveResult); })
      .then(null, function (error: Error) { console.log(error); return self.saveFailed(error); });
    rememberAddedOriginalValues(entities); // do it after ... so don't send OrigValues to the server
    return promise;

    function rememberAddedOriginalValues(entities: Entity[]) {
      // added entities normally don't have original values but these will now
      let added = entities ?
        entities.filter(function (e) { return e.entityAspect.entityState.isAdded(); }) :
        self.entityManager.getEntities(null, EntityState.Added);
      added.forEach(entity => {
        let props = entity.entityType.dataProperties;
        let originalValues = entity.entityAspect.originalValues;
        props.forEach(dp => {
          if (dp.isPartOfKey) { return; }
          originalValues[dp.name] = entity.getProperty(dp.name);
        });
      });
    }
  }


  saveSucceeded(saveResult: SaveResult) {
    let self = this; // `this` is a SaveQueueing
    let activeSaveDeferred = self.activeSaveDeferred;
    let nextSaveDeferred = self.nextSaveDeferred;
    let nextSaveMemo = self.nextSaveMemo;


    // prepare as if nothing queued or left to save
    self.isSaving = false;
    self.activeSaveDeferred = null;
    self.activeSaveMemo = null;
    self.nextSaveDeferred = null;
    self.nextSaveMemo = null;

    if (nextSaveMemo) {
      // a save was queued since last save returned
      nextSaveMemo.pkFixup(saveResult.keyMappings);
      nextSaveMemo.applyToSavedEntities(self.entityManager, saveResult.entities);
      // remove detached entities from queuedChanges
      let queuedChanges = nextSaveMemo.queuedChanges.filter(e => {
        return !e.entityAspect.entityState.isDetached();
      });

      if (queuedChanges.length > 0) {
        // save again
        self.isSaving = true;
        // remember the queued changes that triggered this save
        self.activeSaveDeferred = nextSaveDeferred;
        self.activeSaveMemo = nextSaveMemo;
        self.saveChanges(queuedChanges, this.saveOptions);
      } else if (nextSaveDeferred) {
        nextSaveDeferred.resolve(this.getSavedNothingResult());
      }
    }

    if (activeSaveDeferred) { activeSaveDeferred.resolve(saveResult); }
    return saveResult;  // for the current promise chain
  }

  saveFailed(error: Error) {
    let self = this; // `this` is a SaveQueueing
    error = new QueuedSaveFailedError(error, self);

    let activeSaveDeferred = self.activeSaveDeferred;
    let nextSaveDeferred = self.nextSaveDeferred;

    self.isSaving = false;
    self.activeSaveDeferred = null;
    self.activeSaveMemo = null;
    self.nextSaveDeferred = null;
    self.nextSaveMemo = null;

    if (activeSaveDeferred) { activeSaveDeferred.reject(error); }
    if (nextSaveDeferred) { nextSaveDeferred.reject(error); }

    return Promise.reject(error); // let promise chain hear error
  }
}

/// for backward compat with older Promise implementation
class Deferred<T> {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  promise: Promise<T>;
  constructor() {
    this.promise = new Promise<T>(function (resolve: (val: any) => void, reject: (err: any) => void) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this));
  }
}


////////// QueuedSaveFailedError /////////
// Error sub-class thrown when rejecting queued saves.
export class QueuedSaveFailedError extends Error {
  name = "QueuedSaveFailedError";
  innerError: Error;
  message: string;
  failedSaveMemo: SaveMemo;
  nextSaveMemo: SaveMemo;

  // Error sub-class thrown when rejecting queued saves.
  // `innerError` is the actual save error
  // `failedSaveMemo` is the saveMemo that prompted this save
  // `nextSaveMemo` holds queued changes accumulated since that save.
  // You may try to recover using this info. Good luck with that.
  constructor(errObject: Error, saveQueuing: any) {
    super();
    this.innerError = errObject;
    this.message = "Queued save failed: " + errObject.message;
    this.failedSaveMemo = saveQueuing.activeSaveMemo;
    this.nextSaveMemo = saveQueuing.nextSaveMemo;
  }
}

////////// SaveMemo ////////////////
// SaveMemo is a record of changes for a queued save, consisting of:
//   entityMemos:   info about entities that are being saved and
//                  have been changed since the save started
//   queuedChanges: entities that are queued for save but
//                  are not currently being saved
class SaveMemo {
  entityMemos: { [key: string]: EntityMemo };
  queuedChanges: Entity[];
  constructor() {
    this.entityMemos = {};
    this.queuedChanges = [];
  }

  applyToSavedEntities(entityManager: EntityManager, savedEntities: Entity[]) {
    let entityMemos = this.entityMemos; // `this` is a SaveMemo
    let queuedChanges = this.queuedChanges;
    let restorePublishing = this.disableManagerPublishing(entityManager);
    try {
      savedEntities.forEach(saved => {
        let key = this.makeEntityMemoKey(saved);
        let entityMemo = entityMemos[key];
        let resave = entityMemo && entityMemo.applyToSavedEntity(saved);
        if (resave) {
          queuedChanges.push(saved);
        }
      });
    } finally {
      restorePublishing();
      // D#2651 hasChanges will be wrong if changes made while save in progress
      let hasChanges = queuedChanges.length > 0;
      // Must use breeze internal method to properly set this flag true
      if (hasChanges) { entityManager._setHasChanges(true); }
    }
  }

  private disableManagerPublishing(manager: EntityManager) {
    let Event = breeze.Event;
    Event.enable('entityChanged', manager, false);
    Event.enable('hasChangesChanged', manager, false);

    return function restorePublishing() {
      Event.enable('entityChanged', manager, true);
      Event.enable('hasChangesChanged', manager, true);
    };
  }

  pkFixup(keyMappings: KeyMapping[]) {
    let entityMemos = this.entityMemos;  // `this` is a SaveMemo
    keyMappings.forEach(km => {
      let type = km.entityTypeName;
      let tempKey = type + '|' + km.tempValue;
      if (entityMemos[tempKey]) {
        entityMemos[type + '|' + km.realValue] = entityMemos[tempKey];
        delete entityMemos[tempKey];
      }
      for (let memoKey in entityMemos) {
        entityMemos[memoKey].fkFixup(km);
      }
    });
  }

  makeEntityMemoKey(entity: Entity) {
    let entityKey = entity.entityAspect.getKey();
    return entityKey.entityType.name + '|' + entityKey.values;
  }

  updateEntityMemos(changes: Entity[]) {
    let entityMemos = this.entityMemos;  // `this` is a SaveMemo
    changes.forEach(change => {
      // only update entityMemo for entity being save
      if (!change.entityAspect.isBeingSaved) { return; }

      let key = this.makeEntityMemoKey(change);
      let entityMemo = entityMemos[key] || (entityMemos[key] = new EntityMemo(change));
      entityMemo.update();
    });
  }

}



///////// EntityMemo Type ///////////////
// Information about an entity that is being saved
// and which has been changed since that save started
class EntityMemo {
  entity: Entity;
  pendingChanges: any;
  isDeleted: boolean;
  constructor(entity: Entity) {
    this.entity = entity;
    this.pendingChanges = {};
  }


  applyToSavedEntity(saved: Entity) {
    let entityMemo = this;
    let aspect = saved.entityAspect;
    if (aspect.entityState.isDetached()) {
      return false;
    } else if (entityMemo.isDeleted) {
      aspect.setDeleted();
      return true;
    }
    // treat entity with pending changes as modified
    let props = Object.keys(entityMemo.pendingChanges);
    if (props.length === 0) {
      return false;
    }
    let originalValues = aspect.originalValues;
    props.forEach(name => {
      originalValues[name] = saved.getProperty(name);
      saved.setProperty(name, entityMemo.pendingChanges[name]);
    });
    aspect.setModified();
    return true;
  }

  fkFixup(keyMapping: KeyMapping) {
    let entityMemo = this;
    let type = entityMemo.entity.entityType;
    let fkProps = type.foreignKeyProperties;
    fkProps.forEach(fkProp => {
      if (fkProp.parentType.name === keyMapping.entityTypeName &&
        entityMemo.pendingChanges[fkProp.name] === keyMapping.tempValue) {
        entityMemo.pendingChanges[fkProp.name] = keyMapping.realValue;
      }
    });
  }

  // update the entityMemo of changes to an entity being saved
  // so that we know how to save it again later
  update() {
    let entityMemo = this;
    let props;
    let entity = entityMemo.entity;
    let aspect = entity.entityAspect;
    let stateName = aspect.entityState.name;
    switch (stateName) {
      case 'Added':
        let originalValues = aspect.originalValues;
        props = entity.entityType.dataProperties;
        props.forEach(dp => {
          if (dp.isPartOfKey) { return; }
          let name = dp.name;
          let value = entity.getProperty(name);
          if (originalValues[name] !== value) {
            entityMemo.pendingChanges[name] = value;
          }
        });
        break;

      case 'Deleted':
        entityMemo.isDeleted = true;
        entityMemo.pendingChanges = {};
        break;

      case 'Modified':
        props = Object.keys(aspect.originalValues);
        props.forEach(name => {
          entityMemo.pendingChanges[name] = entity.getProperty(name);
        });
        break;
    }
  }
}
