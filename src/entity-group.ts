import { Entity } from './entity-aspect';
import { EntityType, DataProperty  } from './entity-metadata';
import { EntityKey } from './entity-key';
import { EntityState } from './entity-state';
import { EntityManager } from './entity-manager';
import { MergeStrategy } from './query-options';

/** @hidden @internal */
export class EntityGroup {
  entityManager: EntityManager;
  entityType: EntityType;
  _indexMap: Object; //  = {};
  _entities: (Entity | null)[];
  _emptyIndexes: number[];

  constructor(entityManager: EntityManager, entityType: EntityType) {
    this.entityManager = entityManager;
    this.entityType = entityType;
    // freeze the entityType after the first instance of this type is either created or queried.
    this.entityType.isFrozen = true;
    this._indexMap = {};
    this._entities = [];
    this._emptyIndexes = [];
  }


  attachEntity(entity: Entity, entityState: EntityState, mergeStrategy?: MergeStrategy) {
    // entity should already have an aspect.
    let aspect = entity.entityAspect;

    if (!aspect._initialized) {
      this.entityType._initializeInstance(entity);
    }
    delete aspect._initialized;

    let keyInGroup = aspect.getKey()._keyInGroup;
    let ix = this._indexMap[keyInGroup];
    if (ix >= 0) {
      // safecast because key was found not ix will not return a null
      let targetEntity = this._entities[ix] as Entity;
      let targetEntityState = targetEntity.entityAspect.entityState;
      let wasUnchanged = targetEntityState.isUnchanged();
      if (targetEntity === entity) {
        aspect.entityState = entityState;
      } else if (mergeStrategy === MergeStrategy.Disallowed) {
        throw new Error("A MergeStrategy of 'Disallowed' does not allow you to attach an entity when an entity with the same key is already attached: " + aspect.getKey());
      } else if (mergeStrategy === MergeStrategy.OverwriteChanges || (mergeStrategy === MergeStrategy.PreserveChanges && wasUnchanged)) {
        // unwrapInstance returns an entity with server side property names - so we need to use DataProperty.getRawValueFromServer these when we apply
        // the property values back to the target.
        let rawServerEntity = this.entityManager.helper.unwrapInstance(entity);
        this.entityType._updateTargetFromRaw(targetEntity, rawServerEntity, DataProperty.getRawValueFromServer);
        targetEntity.entityAspect.setEntityState(entityState);
      }
      return targetEntity;
    } else {
      if (this._emptyIndexes.length === 0) {
        ix = this._entities.push(entity) - 1;
      } else {
        ix = this._emptyIndexes.pop();
        this._entities[ix] = entity;
      }
      this._indexMap[keyInGroup] = ix;
      aspect.entityState = entityState;
      aspect.entityGroup = this;
      aspect.entityManager = this.entityManager;
      return entity;
    }
  }

  detachEntity(entity: Entity) {
    // by this point we have already determined that this entity
    // belongs to this group.
    let aspect = entity.entityAspect;
    let keyInGroup = aspect.getKey()._keyInGroup;
    let ix = this._indexMap[keyInGroup];
    if (ix === undefined) {
      // shouldn't happen.
      throw new Error("internal error - entity cannot be found in group");
    }
    delete this._indexMap[keyInGroup];
    this._emptyIndexes.push(ix);
    this._entities[ix] = null;
    return entity;
  }


  // returns entity based on an entity key defined either as an array of key values or an EntityKey
  findEntityByKey(entityKey: EntityKey) {
    let keyInGroup: string;
    if (entityKey instanceof EntityKey) {
      keyInGroup = entityKey._keyInGroup;
    } else {
      keyInGroup = EntityKey.createKeyString(entityKey);
    }
    let ix = this._indexMap[keyInGroup];
    // can't use just (ix) below because 0 is valid
    let r = (ix !== undefined) ? this._entities[ix] : undefined;
    // coerce null to undefined
    return r == null ? undefined : r;
  }

  hasChanges() {
    let entities = this._entities;
    let unchanged = EntityState.Unchanged;
    for (let i = 0, len = entities.length; i < len; i++) {
      let e = entities[i];
      if (e && e.entityAspect.entityState !== unchanged) {
        return true;
      }
    }
    return false;
  }

  getChanges() {
    let entities = this._entities;
    let unchanged = EntityState.Unchanged;
    let changes: Entity[] = [];
    for (let i = 0, len = entities.length; i < len; i++) {
      let e = entities[i];
      if (e && e.entityAspect.entityState !== unchanged) {
        changes.push(e);
      }
    }
    return changes;
  }

  getEntities(entityStates: EntityState[]) {
    let filter = getFilter(entityStates);
    return this._entities.filter(filter) as Entity[];
  }

  _checkOperation(operationName: string) {
    this._entities.forEach(function (entity) {
      entity && entity.entityAspect._checkOperation(operationName);
    });
    // for chaining;
    return this;
  }

  // do not expose this method. It is doing a special purpose INCOMPLETE fast detach operation
  // just for the entityManager clear method - the entityGroup will be in an inconsistent state
  // after this op, which is ok because it will be thrown away.
  // TODO: rename this to be clear that it is UNSAFE...
  _clear() {
    this._entities.forEach(function (entity) {
      if (entity != null) {
        entity.entityAspect._detach();
      }
    });
    (this as any)._entities = null;
    (this as any)._indexMap = null;
    (this as any)._emptyIndexes = null;
  }

  _updateFkVal(fkProp: DataProperty, oldValue: any, newValue: any) {
    let fkPropName = fkProp.name;
    this._entities.forEach(function (entity) {
      if (entity != null) {
        if (entity.getProperty(fkPropName) === oldValue) {
          entity.setProperty(fkPropName, newValue);
        }
      }
    });
  }

  _fixupKey(tempValue: any, realValue: any) {
    // single part keys appear directly in map
    let ix = this._indexMap[tempValue];
    if (ix === undefined) {
      throw new Error("Internal Error in key fixup - unable to locate entity");
    }
    let entity = this._entities[ix] as Entity;
    let keyPropName = entity.entityType.keyProperties[0].name;
    // fks on related entities will automatically get updated by this as well
    entity.setProperty(keyPropName, realValue);
    delete entity.entityAspect.hasTempKey;
    delete this._indexMap[tempValue];
    this._indexMap[realValue] = ix;
  }

  _replaceKey(oldKey: EntityKey, newKey: EntityKey) {
    let ix = this._indexMap[oldKey._keyInGroup];
    delete this._indexMap[oldKey._keyInGroup];
    this._indexMap[newKey._keyInGroup] = ix;
  }

}

function getFilter(entityStates: EntityState[]) {
  if (entityStates.length === 0) {
    return function (e: Entity) {
      return !!e;
    };
  } else if (entityStates.length === 1) {
    let entityState = entityStates[0];
    return function (e: Entity) {
      return !!e && e.entityAspect.entityState === entityState;
    };
  } else {
    return function (e: Entity) {
      return !!e && -1 !== entityStates.indexOf(e.entityAspect.entityState);
    };
  }
}


// do not expose EntityGroup - internal only


