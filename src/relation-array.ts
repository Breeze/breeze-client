import { core, Callback, ErrorCallback } from './core';
import { IObservableArray, observableArray } from './observable-array';
import { BreezeEvent } from './event';
import { IEntity  } from './entity-aspect';
import { DataProperty, NavigationProperty } from './entity-metadata';
import { EntityState } from './entity-state';
import { EntityQuery } from './entity-query';

// TODO: mixin impl is not very typesafe

/** @hidden */
export interface IRelationArray extends IObservableArray {
  [index: number]: IEntity;
  parentEntity: IEntity;
  parentProperty?: DataProperty;
  navigationProperty: NavigationProperty;
  _inProgress?: boolean;
  _addsInProcess: IEntity[];
}

let relationArrayMixin = {

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
  load: function(callback: Callback, errorCallback: ErrorCallback) {
    let parent = this.parentEntity;
    let query = EntityQuery.fromEntityNavigation(this.parentEntity, this.navigationProperty);
    let em = parent.entityAspect.entityManager;
    return em.executeQuery(query, callback, errorCallback);
  },

  _getEventParent: function() {
    return this.parentEntity.entityAspect;
  },

  _getPendingPubs: function() {
    let em = this.parentEntity.entityAspect.entityManager;
    return em && em._pendingPubs;
  },

  // virtual impls
  _getGoodAdds: function(adds: IEntity[]) {
    return getGoodAdds(this, adds);
  },

  _processAdds: function(adds: IEntity[]) {
    processAdds(this, adds);
  },

  _processRemoves: function(removes: IEntity[]) {
    processRemoves(this, removes);
  }

};

function getGoodAdds(relationArray: IRelationArray, adds: IEntity[]) {
  let goodAdds = checkForDups(relationArray, adds);
  if (!goodAdds.length) {
    return goodAdds;
  }
  let parentEntity = relationArray.parentEntity;
  let entityManager = parentEntity.entityAspect.entityManager;
  // we do not want to attach an entity during loading
  // because these will all be 'attached' at a later step.
  if (entityManager && !entityManager.isLoading) {
    goodAdds.forEach(function (add) {
      if (add.entityAspect.entityState.isDetached()) {
        relationArray._inProgress = true;
        try {
          entityManager!.attachEntity(add, EntityState.Added);
        } finally {
          relationArray._inProgress = false;
        }
      }
    });
  }
  return goodAdds;
}

function processAdds(relationArray: IRelationArray, adds: IEntity[]) {
  let parentEntity = relationArray.parentEntity;
  let np = relationArray.navigationProperty;
  let addsInProcess = relationArray._addsInProcess;

  let invNp = np.inverse;
  let startIx = addsInProcess.length;
  try {
    adds.forEach(function (childEntity) {
      addsInProcess.push(childEntity);
      if (invNp) {
        childEntity.setProperty(invNp.name, parentEntity);
      } else {
        // This occurs with a unidirectional 1-n navigation - in this case
        // we need to update the fks instead of the navProp
        let pks = parentEntity.entityType.keyProperties;
        np.invForeignKeyNames.forEach(function (fk, i) {
          childEntity.setProperty(fk, parentEntity.getProperty(pks[i].name));
        });
      }
    });
  } finally {
    addsInProcess.splice(startIx, adds.length);
  }

}

function processRemoves(relationArray: IRelationArray, removes: IEntity[]) {
  let inp = relationArray.navigationProperty.inverse;
  if (inp) {
    removes.forEach(function (childEntity) {
      childEntity.setProperty(inp!.name, null);
    });
  }
}

function checkForDups(relationArray: IRelationArray, adds: IEntity[]) {
  // don't allow dups in this array. - also prevents recursion
  let parentEntity = relationArray.parentEntity;
  let navProp = relationArray.navigationProperty;
  let inverseProp = navProp.inverse;
  let goodAdds: IEntity[];
  if (inverseProp) {
    goodAdds = adds.filter(function (a) {
      if (relationArray._addsInProcess.indexOf(a) >= 0) {
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
    goodAdds = adds.filter(function (a) {
      if (relationArray._addsInProcess.indexOf(a) >= 0) {
        return false;
      }
      return fkPropNames.some(function (fk, i) {
        let keyProp = keyProps[i].name;
        let keyVal = parentEntity.getProperty(keyProp);
        let fkVal = a.getProperty(fk);
        return keyVal !== fkVal;
      });
    });
  }
  return goodAdds;
}

/** For use by breeze plugin authors only. The class is for use in building a [[IModelLibraryAdapter]] implementation. 
@adapter (see [[IModelLibraryAdapter]])    
@hidden @internal 
*/
export function makeRelationArray(arr: any[], parentEntity: IEntity, navigationProperty: NavigationProperty): IRelationArray {
  let arrX = arr as any;
  arrX.parentEntity = parentEntity;
  arrX.navigationProperty = navigationProperty;
  arrX.arrayChanged = new BreezeEvent("arrayChanged", arrX);
  // array of pushes currently in process on this relation array - used to prevent recursion.
  arrX._addsInProcess = [];
  // need to use mixins here instead of inheritance because we are starting from an existing array object.
  core.extend(arrX, observableArray.mixin);
  return core.extend(arrX, relationArrayMixin) as IRelationArray;
}
