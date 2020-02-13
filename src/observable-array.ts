import { core } from './core';
import { BreezeEvent } from './event';
import { EntityAspect, StructuralObject, Entity, ComplexObject } from './entity-aspect';
import { DataProperty } from './entity-metadata';

export interface ArrayChangedArgs {
  array: any[];
  added?: any[]; 
  removed?: any[];
}

/** @hidden */
export abstract class ObservableArray<T> extends Array<T> {
  arrayChanged: BreezeEvent<ArrayChangedArgs>;
  _origValues: T[];
  _pendingArgs: any;
  _inProgress: boolean;

  abstract _getEventParent(): Object;
  abstract _getPendingPubs(): Object[];
  abstract _getGoodAdds(adds: T[]): Array<T>;
  abstract _processAddsCore(items: T[]): void;
  abstract _processRemovesCore(items: T[]): void;

  constructor(...args: T[]) { 
    super(...args); 
    Object.setPrototypeOf(this, ObservableArray.prototype);
    this.arrayChanged = new BreezeEvent("arrayChanged", this);
  }

  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
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
    this._processAdds(goodAdds);
    return result;
  }

  _pushUnsafe(...goodAdds: T[]) {
    if (this._inProgress) {
      return -1;
    }
    this._beforeChange();
   
    const result = Array.prototype.push.apply(this, goodAdds);
    this._processAdds(goodAdds);
    return result;
  }

  unshift(...args: any[]) {
    let goodAdds = this._getGoodAdds(args);
    if (!goodAdds.length) {
      return this.length;
    }
    this._beforeChange();
    
    const result = Array.prototype.unshift.apply(this, goodAdds);
    this._processAdds(goodAdds);
    return result;
  }

  pop() {
    this._beforeChange();
    
    const result = Array.prototype.pop.apply(this);
    this._processRemoves([result]);
    return result;
  }

  shift() {
    this._beforeChange();
    
    const result = Array.prototype.shift.apply(this);
    this._processRemoves([result]);
    return result;
  }

  splice(...args: any[]) {
    let goodAdds = this._getGoodAdds(core.arraySlice(args, 2));
    let newArgs = core.arraySlice(args, 0, 2).concat(goodAdds);
    this._beforeChange();
    
    const result = Array.prototype.splice.apply(this, newArgs);
    this._processRemoves(result);

    if (goodAdds.length) {
      this._processAdds(goodAdds);
    }
    return result;
  }

  _beforeChange () {
    // default is to do nothing
  }

  private _processAdds(adds: T[]) {
    this._processAddsCore(adds);
    this._publish( "arrayChanged", { array: this, added: adds });
  }
  
  private _processRemoves(removes: T[]) {
    this._processRemovesCore(removes);
    this._publish( "arrayChanged", { array: this, removed: removes });
  }

  // ------------------------

  private _publish(eventName: string, eventArgs: any) {
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

