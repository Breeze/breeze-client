import { core } from './core';
import { BreezeEvent } from './event';
import { EntityAspect, StructuralObject, Entity, ComplexObject } from './entity-aspect';
import { DataProperty } from './entity-metadata';


/** @hidden */
export abstract class ObservableArray<T> extends Array<T> {
  arrayChanged: BreezeEvent<ArrayChangedArgs>;
  parent?: StructuralObject;
  parentProperty?: DataProperty;
  _origValues: T[];
  _pendingArgs: any;
  _inProgress: boolean;

  abstract _getGoodAdds(adds: T[]): Array<T>;
  abstract _processAdds(items: T[]): void;
  abstract _processRemoves(items: T[]): void;

  constructor(...args: T[]) { 
    super(...args); 
    Object.setPrototypeOf(this, ObservableArray.prototype);
  }

  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
  }

  initializeParent(parent: StructuralObject, parentProperty: DataProperty) {
    this.parent = parent;
    this.parentProperty = parentProperty;
  }

  push(...args: T[]) {
    if (this._inProgress) {
      return -1;
    }
    let goodAdds = this._getGoodAdds(args);
    if (!goodAdds.length) {
      return this.length;
    }
    this._beforeChange();
    
    const result = Array.prototype.push.apply(this, goodAdds);
    this.processAdds(goodAdds);
    return result;
  }

  _push(...args: any[]) {
    if (this._inProgress) {
      return -1;
    }
    let goodAdds = args;
    this._beforeChange();
   
    const result = Array.prototype.push.apply(this, goodAdds);
    this.processAdds(goodAdds);
    return result;
  }

  unshift(...args: any[]) {
    let goodAdds = this._getGoodAdds(args);
    if (!goodAdds.length) {
      return this.length;
    }
    this._beforeChange();
    
    const result = Array.prototype.unshift.apply(this, goodAdds);
    this.processAdds(goodAdds);
    return result;
  }

  pop() {
    this._beforeChange();
    
    const result = Array.prototype.pop.apply(this);
    this.processRemoves([result]);
    return result;
  }

  shift() {
    this._beforeChange();
    
    const result = Array.prototype.shift.apply(this);
    this.processRemoves([result]);
    return result;
  }

  splice(...args: any[]) {
    let goodAdds = this._getGoodAdds(core.arraySlice(args, 2));
    let newArgs = core.arraySlice(args, 0, 2).concat(goodAdds);
    this._beforeChange();
    
    const result = Array.prototype.splice.apply(this, newArgs);
    this.processRemoves(result);

    if (goodAdds.length) {
      this.processAdds(goodAdds);
    }
    return result;
  }

  getEntityAspect() {
    return (this.parent as Entity).entityAspect || (this.parent as ComplexObject).complexAspect.getEntityAspect();
  }

  _getEventParent() {
    return this.getEntityAspect();
  }

  _getPendingPubs() {
    let em = this.getEntityAspect().entityManager;
    return em && em._pendingPubs;
  }

  _beforeChange () {
    // default is to do nothing
  }

  processAdds(adds: T[]) {
    this._processAdds(adds);
    // this is referencing the name of the method on the complexArray not the name of the event
    //var args = { added: adds };
    //args[obsArray._typeName] = obsArray;
    this.publish( "arrayChanged", { array: this, added: adds });
  }
  
  processRemoves(removes: T[]) {
    this._processRemoves(removes);
    // this is referencing the name of the method on the array not the name of the event
    this.publish( "arrayChanged", { array: this, removed: removes });
  }

  publish(eventName: string, eventArgs: any) {
    let pendingPubs = this._getPendingPubs();
    if (pendingPubs) {
      if (!this._pendingArgs) {
        this._pendingArgs = eventArgs;
        pendingPubs.push( () => {
          this[eventName].publish(this._pendingArgs);
          this._pendingArgs = null;
        });
      } else {
        combineArgs(this._pendingArgs, eventArgs);
      }
    } else {
      this[eventName].publish(eventArgs);
    }
  }

  updateEntityState() {
    let entityAspect = this.getEntityAspect();
    if (entityAspect.entityState.isUnchanged()) {
      entityAspect.setModified();
    }
    if (entityAspect.entityState.isModified() && !this._origValues) {
      this._origValues = this.slice(0);
    }
  }

  
}

export interface ArrayChangedArgs {
  array: any[];
  added?: any[]; 
  removed?: any[];
}


// TODO: see if this function already exists in core and can be imported.
function combineArgs(target: Object, source: Object) {
  for (let key in source) {
    if (key !== "array" && target.hasOwnProperty(key)) {
      let sourceValue = source[key];
      let targetValue = target[key];
      if (targetValue) {
        if (!Array.isArray(targetValue)) {
          throw new Error("Cannot combine non array args");
        }
        Array.prototype.push.apply(targetValue, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    }
  }
}

