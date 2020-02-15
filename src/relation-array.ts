// Converted to ES6

import { Entity } from './entity-aspect';
import { QueryErrorCallback, QueryResult, QuerySuccessCallback } from './entity-manager';
import { NavigationProperty } from './entity-metadata';
import { EntityQuery } from './entity-query';
import { EntityState } from './entity-state';
import { ObservableArray  } from './observable-array';

  /**
  Relation arrays are not actually classes, they are objects that mimic arrays. A relation array is collection of
  entities associated with a navigation property on a single entity. i.e. customer.orders or order.orderDetails.
  This collection looks like an array in that the basic methods on arrays such as 'push', 'pop', 'shift', 'unshift', 'splice'
  are all provided as well as several special purpose methods.
  @class {relationArray}
  **/

  /**
  An [[Event]] that fires whenever the contents of this array changed.  This event
  is fired any time a new entity is attached or added to the EntityManager and happens to belong to this collection.
  Adds that occur as a result of query or import operations are batched so that all of the adds or removes to any individual
  collections are collected into a single notification event for each relation array.
  @example
      // assume order is an order entity attached to an EntityManager.
      orders.arrayChanged.subscribe(
      function (arrayChangedArgs) {
          let addedEntities = arrayChangedArgs.added;
          let removedEntities = arrayChanged.removed;
      });
  @event arrayChanged
  @param added {Array of Entity} An array of all of the entities added to this collection.
  @param removed {Array of Entity} An array of all of the removed from this collection.
  @readOnly
  **/


export class RelationArray extends ObservableArray<Entity> {
  parentEntity: Entity;
  navigationProperty: NavigationProperty;
  // array of pushes currently in process on this relation array - used to prevent recursion.
  _addsInProcess: Entity[] = [];

  constructor(...args: Entity[]) { 
    super(...args); 
    Object.setPrototypeOf(this, RelationArray.prototype);
  }

  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
  }

  /**
  Performs an asynchronous load of all other the entities associated with this relationArray.
  @example
      // assume orders is an empty, as yet unpopulated, relation array of orders
      // associated with a specific customer.
      orders.load().then(...)
  @method load
  @param [callback] {Function}
  @param [errorCallback] {Function}
  @return {Promise}
  **/
  load(callback?: QuerySuccessCallback, errorCallback?: QueryErrorCallback): Promise<QueryResult> {
    let parent = this.parentEntity;
    let query = EntityQuery.fromEntityNavigation(this.parentEntity, this.navigationProperty);
    let em = parent.entityAspect.entityManager;
    return em!.executeQuery(query, callback, errorCallback);
  }

  // Impl of abstract methods

  _getEventParent() {
    return this.parentEntity.entityAspect;
  }

  _getPendingPubs() {
    let em = this.parentEntity.entityAspect.entityManager;
    return em && em._pendingPubs;
  }

  // virtual impls
  _getGoodAdds(adds: Entity[]) {
    let goodAdds = this._checkForDups(adds);
    if (!goodAdds.length) {
      return goodAdds;
    }
    let parentEntity = this.parentEntity;
    let entityManager = parentEntity.entityAspect.entityManager;
    // we do not want to attach an entity during loading
    // because these will all be 'attached' at a later step.
    if (entityManager && !entityManager.isLoading) {
      goodAdds.forEach( add => {
        if (add.entityAspect.entityState.isDetached()) {
          this._inProgress = true;
          try {
            entityManager!.attachEntity(add, EntityState.Added);
          } finally {
            this._inProgress = false;
          }
        }
      });
    }
    return goodAdds;
  }

  _processAddsCore(adds: Entity[]) {
    let parentEntity = this.parentEntity;
    let np = this.navigationProperty;
    let addsInProcess = this._addsInProcess;
  
    let invNp = np.inverse;
    let startIx = addsInProcess.length;
    try {
      adds.forEach( (childEntity) => {
        addsInProcess.push(childEntity);
        if (invNp) {
          childEntity.setProperty(invNp.name, parentEntity);
        } else {
          // This occurs with a unidirectional 1-n navigation - in this case
          // we need to update the fks instead of the navProp
          let pks = parentEntity.entityType.keyProperties;
          np.invForeignKeyNames.forEach( (fk, i) => {
            childEntity.setProperty(fk, parentEntity.getProperty(pks[i].name));
          });
        }
      });
    } finally {
      addsInProcess.splice(startIx, adds.length);
    }
  
  }

  _processRemovesCore(removes: Entity[]) {
    let inp = this.navigationProperty.inverse;
    if (inp) {
      removes.forEach( childEntity => childEntity.setProperty(inp!.name, null));
    }
  }

  // --------------------------------------
  _checkForDups(adds: Entity[]) {
    // don't allow dups in this array. - also prevents recursion
    let parentEntity = this.parentEntity;
    let navProp = this.navigationProperty;
    let inverseProp = navProp.inverse;
    let goodAdds: Entity[];
    if (inverseProp) {
      goodAdds = adds.filter( a => {
        if (this._addsInProcess.indexOf(a) >= 0) {
          return false;
        }
        let inverseValue = a.getProperty(inverseProp!.name);
        return inverseValue !== parentEntity;
      });
    } else {
      // This occurs with a unidirectional 1->N relation ( where there is no n -> 1)
      // in this case we compare fks.
      let fkPropNames = navProp.invForeignKeyNames;
      let keyProps = parentEntity.entityType.keyProperties;
      goodAdds = adds.filter( a => {
        if (this._addsInProcess.indexOf(a) >= 0) {
          return false;
        }
        return fkPropNames.some( (fk, i) => {
          let keyProp = keyProps[i].name;
          let keyVal = parentEntity.getProperty(keyProp);
          let fkVal = a.getProperty(fk);
          return keyVal !== fkVal;
        });
      });
    }
    return goodAdds;
  }

}

/** For use by breeze plugin authors only. The class is for use in building a [[IModelLibraryAdapter]] implementation. 
@adapter (see [[IModelLibraryAdapter]])    
@hidden 
*/
export function makeRelationArray(arr: Entity[], parentEntity: Entity, navigationProperty: NavigationProperty): RelationArray {
  let relationArray = new RelationArray(...arr);
  relationArray.parentEntity = parentEntity;
  relationArray.navigationProperty = navigationProperty;
  return relationArray;
}
