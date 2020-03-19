// Converted to ES6

import { Entity } from './entity-aspect';
import { EntityType, DataProperty  } from './entity-metadata';
import { EntityKey } from './entity-key';
import { EntityState } from './entity-state';
import { EntityManager } from './entity-manager';
import { MergeStrategy } from './query-options';

// do not expose EntityGroup - internal only

/** @hidden @internal */
export class EntityGroup {
  entityManager: EntityManager;
  entityType: EntityType;
  _indexMap: Map<string, number>;
  _entities: (Entity | undefined)[];
  _emptyIndexes: number[];

  constructor(entityManager: EntityManager, entityType: EntityType) {
    this.entityManager = entityManager;
    this.entityType = entityType;
    // freeze the entityType after the first instance of this type is either created or queried.
    this.entityType.isFrozen = true;
    this._indexMap = new Map<string, number>();

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
    let ix = this._indexMap.get(keyInGroup);
    if (ix != null) {
      // safecast because key was found not ix will not return a null
      let targetEntity = this._entities[ix] as Entity;
      let targetEntityState = targetEntity.entityAspect.entityState;
      let wasUnchanged = targetEntityState.isUnchanged();
      if (targetEntity === entity) {
        aspect.entityState = entityState;
      } else if (mergeStrategy === MergeStrategy.Disallowed) {
        throw new Error(`A MergeStrategy of 'Disallowed' does not allow you to attach an entity when an entity with the same key is already attached: ${aspect.getKey()}`);
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
        ix = this._emptyIndexes.pop()!;
        this._entities[ix] = entity;
      }
      this._indexMap.set(keyInGroup, ix);
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
    let ix = this._indexMap.get(keyInGroup);
    if (ix === undefined) {
      // shouldn't happen.
      throw new Error("internal error - entity cannot be found in group");
    }
    this._indexMap.delete(keyInGroup);
    this._emptyIndexes.push(ix);
    this._entities[ix] = undefined;
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
    const ix = this._indexMap.get(keyInGroup);
    // can't use just (ix) below because 0 is valid
    const r = (ix !== undefined) ? this._entities[ix] : undefined;
    // coerce null to undefined
    return r == null ? undefined : r;
  }

  hasChanges() {
    return this._entities.some(e => e && e.entityAspect.entityState !== EntityState.Unchanged);
  }

  getChanges()  {
    return this._entities.filter(e => e && e.entityAspect.entityState !== EntityState.Unchanged) as Entity[];
  }

  getEntities(entityStates: EntityState[]) {
    let filter = getFilter(entityStates);
    return this._entities.filter(filter) as Entity[];
  }

  _checkOperation(operationName: string) {
    this._entities.forEach( e => e && e.entityAspect._checkOperation(operationName));
    // for chaining;
    return this;
  }

  // do not expose this method. It is doing a special purpose INCOMPLETE fast detach operation
  // just for the entityManager clear method - the entityGroup will be in an inconsistent state
  // after this op, which is ok because it will be thrown away.
  // TODO: rename this to be clear that it is UNSAFE...
  _clearUnsafe() {
    this._entities.forEach( e => e && e.entityAspect._detach()); 
    (this as any)._entities = null;
    (this as any)._indexMap = null;
    (this as any)._emptyIndexes = null;
  }

  _updateFkVal(fkProp: DataProperty, oldValue: any, newValue: any) {
    let fkPropName = fkProp.name;
    this._entities.forEach( e => {
      if (e != null) {
        if (e.getProperty(fkPropName) === oldValue) {
          e.setProperty(fkPropName, newValue);
        }
      }
    });
  }

  _fixupKey(tempValue: any, realValue: any) {
    // single part keys appear directly in map
    const tempKey = tempValue.toString();
    const ix = this._indexMap.get(tempKey);
    if (ix === undefined) {
      throw new Error("Internal Error in key fixup - unable to locate entity");
    }
    const entity = this._entities[ix]!;
    const keyPropName = entity.entityType.keyProperties[0].name;
    // fks on related entities will automatically get updated by this as well
    entity.setProperty(keyPropName, realValue);
    delete entity.entityAspect.hasTempKey;
    this._indexMap.delete(tempKey);
    this._indexMap.set(realValue.toString(), ix);
  }

  _replaceKey(oldKey: EntityKey, newKey: EntityKey) {
    let ix = this._indexMap.get(oldKey._keyInGroup);
    if (ix === undefined) return;
    this._indexMap.delete(oldKey._keyInGroup);
    this._indexMap.set(newKey._keyInGroup, ix);
  }

}

function getFilter(entityStates: EntityState[]) {
  if (entityStates.length === 0) {
    return  (e?: Entity)  => !!e;
  } else if (entityStates.length === 1) {
    return (e?: Entity) => !! (e && e.entityAspect.entityState === entityStates[0]);
  } else {
    return (e?: Entity | null) => !! (e && entityStates.includes(e.entityAspect.entityState));
  }
}





