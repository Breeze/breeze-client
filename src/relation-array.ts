import { core } from './core';
import { Entity } from './entity-aspect';
import { QueryErrorCallback, QueryResult, QuerySuccessCallback } from './entity-manager';
import { DataProperty, NavigationProperty } from './entity-metadata';
import { EntityQuery } from './entity-query';
import { EntityState } from './entity-state';
import { BreezeEvent } from './event';
import { ObservableArray, observableArray } from './observable-array';

// TODO: mixin impl is not very typesafe

export interface RelationArray extends ObservableArray {
  [index: number]: Entity;
  parentEntity: Entity;
  parentProperty?: DataProperty;
  navigationProperty: NavigationProperty;
  _inProgress?: boolean;
  _addsInProcess: Entity[];
  load(querySuccessCallback?: QuerySuccessCallback, queryErrorCallback?: QueryErrorCallback): Promise<QueryResult>; 
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
  load: function(callback?: QuerySuccessCallback, errorCallback?: QueryErrorCallback): Promise<QueryResult> {
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
  _getGoodAdds: function(adds: Entity[]) {
    return getGoodAdds(this, adds);
  },

  _processAdds: function(adds: Entity[]) {
    processAdds(this, adds);
  },

  _processRemoves: function(removes: Entity[]) {
    processRemoves(this, removes);
  }

};

function getGoodAdds(relationArray: RelationArray, adds: Entity[]) {
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

function processAdds(relationArray: RelationArray, adds: Entity[]) {
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

function processRemoves(relationArray: RelationArray, removes: Entity[]) {
  let inp = relationArray.navigationProperty.inverse;
  if (inp) {
    removes.forEach(function (childEntity) {
      childEntity.setProperty(inp!.name, null);
    });
  }
}

function checkForDups(relationArray: RelationArray, adds: Entity[]) {
  // don't allow dups in this array. - also prevents recursion
  let parentEntity = relationArray.parentEntity;
  let navProp = relationArray.navigationProperty;
  let inverseProp = navProp.inverse;
  let goodAdds: Entity[];
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
@hidden 
*/
export function makeRelationArray(arr: any[], parentEntity: Entity, navigationProperty: NavigationProperty): RelationArray {
  let arrX = arr as any;
  arrX.parentEntity = parentEntity;
  arrX.navigationProperty = navigationProperty;
  arrX.arrayChanged = new BreezeEvent("arrayChanged", arrX);
  // array of pushes currently in process on this relation array - used to prevent recursion.
  arrX._addsInProcess = [];
  // need to use mixins here instead of inheritance because we are starting from an existing array object.
  core.extend(arrX, observableArray.mixin);
  return core.extend(arrX, relationArrayMixin) as RelationArray;
}
