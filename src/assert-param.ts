// Converted v1
import { BreezeEnum } from './enum';
import { core } from './core';

/** @hidden @internal */
export interface IParamContext {
  typeName?: string;
  type?: Function;
  prevContext?: IParamContext;
  msg?: string | ((context: IParamContext, v: any) => string);
  mustNotBeEmpty?: boolean;
  enumType?: BreezeEnum;
  propertyName?: string;
  allowNull?: boolean;
  fn?(context: IParamContext, v: any): boolean;
}

/** @hidden @internal */
export interface IConfigParam {
  config: any;
  params: Param[];
  whereParam: (propName: string) => Param;
}

/** @hidden @internal */
export class Param {
  // The %1 parameter
  // is required
  // must be a %2
  // must be an instance of %2
  // must be an instance of the %2 enumeration
  // must have a %2 property
  // must be an array where each element
  // is optional or

  v: any;
  name: string;
  defaultValue: any;
  parent: IConfigParam;
  /** @hidden @internal */
  _context?: IParamContext;
  /** @hidden @internal */
  _contexts: IParamContext[];

  constructor(v: any, name: string) {
    this.v = v;
    this.name = name;
    this._contexts = [<any>null];
  }

  isObject(): Param {
    return this.isTypeOf('object');
  }

  isBoolean(): Param {
    return this.isTypeOf('boolean');
  }

  isString(): Param {
    return this.isTypeOf('string');
  }

  isNumber(): Param {
    return this.isTypeOf('number');
  }

  isFunction(): Param {
    return this.isTypeOf('function');
  }

  isNonEmptyString(): Param {
    return addContext(this, {
      fn: isNonEmptyString,
      msg: "must be a nonEmpty string"
    });
  }


  isTypeOf(typeName: string): Param {
    return addContext(this, {
      fn: isTypeOf,
      typeName: typeName,
      msg: "must be a '" + typeName + "'"
    });
  }


  isInstanceOf(type: Function, typeName?: string): Param {
    typeName = typeName || type.prototype._$typeName;
    return addContext(this, {
      fn: isInstanceOf,
      type: type,
      typeName: typeName,
      msg: "must be an instance of '" + typeName + "'"
    });
  }


  hasProperty(propertyName: string): Param {
    return addContext(this, {
      fn: hasProperty,
      propertyName: propertyName,
      msg: "must have a '" + propertyName + "' property"
    });
  }


  isEnumOf(enumType: any): Param {
    return addContext(this, {
      fn: isEnumOf,
      enumType: enumType,
      msg: "must be an instance of the '" + (enumType.name || 'unknown') + "' enumeration"
    });
  }

  isRequired(allowNull: boolean = false): Param {
    return addContext(this, {
      fn: isRequired,
      allowNull: allowNull,
      msg: "is required"
    });
  }

  isOptional(): Param {
    let context = {
      fn: isOptional,
      prevContext: <any>null,
      msg: isOptionalMessage
    };
    return addContext(this, context);
  }

  isNonEmptyArray(): Param {
    return this.isArray(true);
  }

  isArray(mustNotBeEmpty?: boolean): Param {
    let context = {
      fn: isArray,
      mustNotBeEmpty: mustNotBeEmpty,
      prevContext: <any>null,
      msg: isArrayMessage
    };
    return addContext(this, context);
  }

  or() {
    this._contexts.push(<any>null);
    this._context = <any>null;
    return this;
  }

  check(defaultValue?: any) {
    let ok = exec(this);
    if (ok === undefined) return;
    if (!ok) {
      throw new Error(this.getMessage());
    }

    if (this.v !== undefined) {
      return this.v;
    } else {
      return defaultValue;
    }
  }

  /** @hidden @internal */
  // called from outside this file.
  _addContext(context: IParamContext) {
    return addContext(this, context);
  }

  getMessage() {
    let message = this._contexts
      .map(context => getMessage(context, this.v))
      .join(", or it ");
    return `The ${this.name} parameter ${message}`;
  }

  withDefault(defaultValue: any) {
    this.defaultValue = defaultValue;
    return this;
  }

  whereParam(propName: string) {
    return this.parent.whereParam(propName);
  }

  applyAll(instance: any, checkOnly: boolean = false) {
    let parentTypeName = instance._$typeName;
    // allowUnknownProperty is set to true if the instance is the same type of object as the config object.
    let allowUnknownProperty = parentTypeName && this.parent.config._$typeName === parentTypeName;

    let clone = core.extend({}, this.parent.config);
    this.parent.params.forEach(p => {
      if (!allowUnknownProperty) delete clone[p.name];
      try {
        p.check();
      } catch (e) {
        throwConfigError(instance, e.message);
      }
      (!checkOnly) && p._applyOne(instance);
    });
    // should be no properties left in the clone
    if (!allowUnknownProperty) {
      for (let key in clone) {
        // allow props with an undefined value
        if (clone[key] !== undefined) {
          throwConfigError(instance, `Unknown property: ${key}.`);
        }
      }
    }
  }

  /** @hidden @internal */
  _applyOne = function (this: Param, instance: any) {
    if (this.v !== undefined) {
      instance[this.name] = this.v;
    } else {
      if (this.defaultValue !== undefined) {
        instance[this.name] = this.defaultValue;
      }
    }
  };

  

}

/** @hidden @internal */
export function assertParam(v: any, name: string) {
  return new Param(v, name);
}

function isTypeOf(context: IParamContext, v: any) {
  if (v == null) return false;
  if (typeof (v) === context.typeName) return true;
  return false;
}

function isNonEmptyString(context: IParamContext, v: any) {
  if (v == null) return false;
  return (typeof (v) === 'string') && v.length > 0;
}

function isInstanceOf(context: IParamContext, v: any) {
  if (v == null || context.type == null) return false;
  return (v instanceof context.type);
}

function isEnumOf(context: IParamContext, v: any) {
  if (v == null || context.enumType == null) return false;
  return (context.enumType as any).contains(v);
}

function hasProperty(context: IParamContext, v: any) {
  if (v == null || context.propertyName == null) return false;
  return (v[context.propertyName] !== undefined);
}

function isRequired(context: IParamContext, v: any) {
  if (context.allowNull) {
    return v !== undefined;
  } else {
    return v != null;
  }
}

function isOptional(context: IParamContext, v: any) {
  if (v == null) return true;
  let prevContext = context.prevContext;
  if (prevContext && prevContext.fn) {
    return prevContext.fn(prevContext, v);
  } else {
    return true;
  }
}

function isOptionalMessage(context: IParamContext, v: any) {
  let prevContext = context.prevContext;
  let element = prevContext ? " or it " + getMessage(prevContext, v) : "";
  return "is optional" + element;
}

function isArray(context: IParamContext, v: any) {
  if (!Array.isArray(v)) {
    return false;
  }
  if (context.mustNotBeEmpty) {
    if (v.length === 0) return false;
  }
  // allow standalone is array call.
  let prevContext = context.prevContext;
  if (!prevContext) return true;

  let pc = <any>prevContext;
  return v.every(function (v1: any) {
    return pc.fn && pc.fn(pc, v1);
  });
}

function isArrayMessage(context: IParamContext, v: any) {
  let arrayDescr = context.mustNotBeEmpty ? "a nonEmpty array" : "an array";
  let prevContext = context.prevContext;
  let element = prevContext ? " where each element " + getMessage(prevContext, v) : "";
  return " must be " + arrayDescr + element;
}

function getMessage(context: IParamContext, v: any) {
  let msg = context.msg;
  if (typeof (msg) === "function") {
    msg = (<any>msg)(context, v);
  }
  return msg;
}

function addContext(that: Param, context: IParamContext) {
  if (that._context) {
    let curContext = that._context;

    while (curContext.prevContext != null) {
      curContext = curContext.prevContext;
    }

    if (curContext.prevContext === null) {
      curContext.prevContext = context;
      // just update the prevContext but don't change the curContext.
      return that;
    } else if (context.prevContext == null) {
      context.prevContext = that._context;
    } else {
      throw new Error("Illegal construction - use 'or' to combine checks");
    }
  }
  return setContext(that, context);
}

function setContext(that: Param, context: IParamContext) {
  that._contexts[that._contexts.length - 1] = context;
  that._context = context;
  return that;
}


function exec(self: Param) {
  // clear off last one if null
  let contexts = self._contexts;
  if (contexts[contexts.length - 1] == null) {
    contexts.pop();
  }
  if (contexts.length === 0) {
    return undefined;
  }
  return contexts.some((context: IParamContext) => {
    return context.fn ? context.fn(context, self.v) : false;
  });
}

function throwConfigError(instance: any, message: string) {
  const typeName = (instance && instance._$typeName) || "object";
  throw new Error(`Error configuring an instance of '${typeName}'. ${message}`);
}

class ConfigParam {
  config: any;
  params: Param[];
  constructor(config: Object) {
    if (typeof (config) !== "object") {
      throw new Error(`Configuration parameter should be an object, instead it is a: ${typeof (config)}`);
    }
    this.config = config;
    this.params = [];
  }

  whereParam(propName: string) {
    let param = new Param(this.config[propName], propName);
    param.parent = this;
    this.params.push(param);
    return param;
  }
}

/** @hidden @internal */
export let assertConfig = function (config: Object) {
  return new ConfigParam(config) as IConfigParam;
};


// Param is exposed so that additional 'is' methods can be added to the prototype.
(core as any).Param = Param;
(core as any).assertParam = assertParam;
(core as any).assertConfig = assertConfig;
