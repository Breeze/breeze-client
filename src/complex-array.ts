import { core  } from './core';
import { ObservableArray, observableArray } from './observable-array';
import { BreezeEvent } from './event';
import { ComplexObject, StructuralObject } from './entity-aspect';
import { DataProperty } from './entity-metadata';

// TODO: mixin impl is not very typesafe

export interface ComplexArray extends ObservableArray {
  [index: number]: ComplexObject;
  parent?: StructuralObject;
  parentProperty?: DataProperty;
}

let complexArrayMixin = {

  // complexArray will have the following props
  //    parent
  //    propertyPath
  //    parentProperty
  //    addedItems  - only if modified
  //    removedItems  - only if modified
  //  each complexAspect of any entity within a complexArray
  //  will have its own _complexState = "A/M";

  /**
   Complex arrays are not actually classes, they are objects that mimic arrays. A complex array is collection of
   complexTypes associated with a data property on a single entity or other complex object. i.e. customer.orders or order.orderDetails.
   This collection looks like an array in that the basic methods on arrays such as 'push', 'pop', 'shift', 'unshift', 'splice'
   are all provided as well as several special purpose methods.
   @class {complexArray}
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
          var addedEntities = arrayChangedArgs.added;
          var removedEntities = arrayChanged.removed;
      });
  @event arrayChanged
  @param added {Array of Entity} An array of all of the entities added to this collection.
  @param removed {Array of Entity} An array of all of the removed from this collection.
  @readOnly
  **/

    // virtual impls
  _getGoodAdds: function(adds: any[]) {
    return getGoodAdds(this, adds);
  },

  _beforeChange: function() {
    observableArray.updateEntityState(this);
  },

  _processAdds: function(adds: any[]) {
    processAdds(this, adds);
  },

  _processRemoves: function(removes: any[]) {
    processRemoves(this, removes);
  },

  _rejectChanges: function() {
    if (!this._origValues) return;
    let that = this;
    this.forEach(function (co: ComplexObject) {
      clearAspect(co, that);
    });
    this.length = 0;
    this._origValues.forEach(function (co: ComplexObject) {
      that.push(co);
    });
  },

  _acceptChanges: function() {
    this._origValues = null;
  }
};

// local functions


function getGoodAdds(complexArray: ComplexArray, adds: ComplexObject[]) {
  // remove any that are already added here
  return adds.filter(function (a) {
    // return a.parent !== complexArray.parent;  // TODO: check if this is actually a bug in original breezejs ???
    return a.complexAspect == null || a.complexAspect.parent !== complexArray.parent;
  });
}

function processAdds(complexArray: ComplexArray, adds: ComplexObject[]) {
  adds.forEach(function (a) {
    // if (a.parent != null) { // TODO: check if this is actually a bug in original breezejs ???
    if (a.complexAspect && a.complexAspect.parent != null) {
      throw new Error("The complexObject is already attached. Either clone it or remove it from its current owner");
    }
    setAspect(a, complexArray);
  });
}

function processRemoves(complexArray: ComplexArray, removes: ComplexObject[]) {
  removes.forEach(function (a) {
    clearAspect(a, complexArray);
  });
}

function clearAspect(co: ComplexObject, arr: ComplexArray) {
  let coAspect = co.complexAspect;
  // if not already attached - exit
  if (coAspect.parent !== arr.parent) return null;

  coAspect.parent = undefined;
  coAspect.parentProperty = undefined;
  return coAspect;
}

function setAspect(co: ComplexObject, arr: ComplexArray) {
  let coAspect = co.complexAspect;
  // if already attached - exit
  if (coAspect.parent === arr.parent) return null;
  coAspect.parent = arr.parent;
  coAspect.parentProperty = arr.parentProperty;

  return coAspect;
}


/** For use by breeze plugin authors only. The class is for use in building a [[IModelLibraryAdapter]] implementation. 
@adapter (see [[IModelLibraryAdapter]])    
@hidden 
*/
export function makeComplexArray(arr: any[], parent: StructuralObject, parentProperty: DataProperty) {
  let arrX = arr as any;
  observableArray.initializeParent(arrX, parent, parentProperty);
  arrX.arrayChanged = new BreezeEvent("arrayChanged", arrX);
  core.extend(arrX, observableArray.mixin);
  return core.extend(arrX, complexArrayMixin) as ComplexArray;
}

