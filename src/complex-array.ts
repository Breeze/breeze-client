// Converted to ES6

import { ObservableArray } from './observable-array';
import { ComplexObject, StructuralObject, Entity } from './entity-aspect';
import { DataProperty } from './entity-metadata';

// ComplexArray will have the following props
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
export class ComplexArray extends ObservableArray<ComplexObject> {
  parent: StructuralObject;
  parentProperty: DataProperty;

  constructor(...args: ComplexObject[]) {
    super(...args);
    Object.setPrototypeOf(this, ComplexArray.prototype);
  }

  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
  }

  getEntityAspect() {
    return (this.parent as Entity).entityAspect || (this.parent as ComplexObject).complexAspect.getEntityAspect();
  }

  // impl abstract methods

  _getEventParent() {
    return this.getEntityAspect();
  }

  _getPendingPubs() {
    let em = this.getEntityAspect().entityManager;
    return em && em._pendingPubs;
  }

  _getGoodAdds(adds: ComplexObject[]) {
    // remove any that are already added here
    return adds.filter(a => {
      // return a.parent !== complexArray.parent;  // TODO: check if this is actually a bug in original breezejs ???
      return a.complexAspect == null || a.complexAspect.parent !== this.parent;
    });
  }

  _beforeChange() {
    this._updateEntityState();
  }

  _processAddsCore(adds: ComplexObject[]) {
    adds.forEach(a => {
      if (a.complexAspect && a.complexAspect.parent != null) {
        throw new Error("The complexObject is already attached. Either clone it or remove it from its current owner");
      }
      this._setAspect(a);
    });
  }

  _processRemovesCore(removes: ComplexObject[]) {
    removes.forEach(a => this._clearAspect(a));
  }


  // ----------------------

  _updateEntityState() {
    let entityAspect = this.getEntityAspect();
    if (entityAspect.entityState.isUnchanged()) {
      entityAspect.setModified();
    }
    if (entityAspect.entityState.isModified()) {
      this._origValues = this.slice(0);
    }
  }

  _rejectChanges() {
    if (this._origValues.length === 0) return;

    this.forEach(co => this._clearAspect(co));
    this.length = 0;
    this._origValues.forEach(co => this.push(co));
  }

  _acceptChanges() {
    this._origValues.length = 0;
  }

  _clearAspect(co: ComplexObject) {
    let coAspect = co.complexAspect;
    // if not already attached - exit
    if (coAspect.parent !== this.parent) return null;

    coAspect.parent = undefined;
    coAspect.parentProperty = undefined;
    return coAspect;
  }

  _setAspect(co: ComplexObject) {
    let coAspect = co.complexAspect;
    // if already attached - exit
    if (coAspect.parent === this.parent) return null;
    coAspect.parent = this.parent;
    coAspect.parentProperty = this.parentProperty;

    return coAspect;
  }
}


/** For use by breeze plugin authors only. The class is for use in building a [[IModelLibraryAdapter]] implementation. 
@adapter (see [[IModelLibraryAdapter]])    
@hidden 
*/
export function makeComplexArray(arr: ComplexObject[], parent: StructuralObject, parentProperty: DataProperty) {
  let complexArray = new ComplexArray(...arr);
  complexArray.parent = parent;
  complexArray.parentProperty = parentProperty;
  return complexArray;
}

