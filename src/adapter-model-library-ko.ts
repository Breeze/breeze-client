import * as breeze from 'breeze-client';

let core = breeze.core;

let canIsolateES5Props = core.isES5Supported;
let ko: any;

export class ModelLibraryKnockoutAdapter implements breeze.ModelLibraryAdapter {
  name: string;
  constructor() {
    this.name = "ko";
  }

  static register(config?: breeze.BreezeConfig) {
    config = config || breeze.config;
    config.registerAdapter("modelLibrary", ModelLibraryKnockoutAdapter);
    return config.initializeAdapterInstance("modelLibrary", "ko", true) as ModelLibraryKnockoutAdapter;
  }

  initialize() {
    ko = core.requireLib("ko;knockout", "The Knockout library");
    ko.extenders.intercept = function (target: any, interceptorOptions: any) {
      let instance = interceptorOptions.instance;
      let property = interceptorOptions.property;

      // create a computed observable to intercept writes to our observable
      let result: any;
      if (target.splice) {
        result = ko.computed({
          read: target  //always return the original observables value
        });
      } else {
        result = ko.computed({
          read: target,  //always return the original observables value
          write: function (newValue: any) {
            instance._$interceptor(property, newValue, target);
            return instance;
          }
        });
      }
      //return the new computed observable
      return result;
    };

  }

  getTrackablePropertyNames(entity: any) {
    let names: string[] = [];
    for (let p in entity) {
      if (p === "entityType") continue;
      if (p === "_$typeName") continue;

      let propDescr = getES5PropDescriptor(entity, p);
      if (propDescr && propDescr.get) {
        names.push(p);
      } else {
        let val = entity[p];
        if (ko.isObservable(val)) {
          names.push(p);
        } else if (!core.isFunction(val)) {
          names.push(p);
        }
      }
    }
    return names;
  }

  initializeEntityPrototype(proto: any) {

    proto.getProperty = function (propertyName: string) {
      return this[propertyName]();
    };

    proto.setProperty = function (propertyName: string, value: any) {
      this[propertyName](value);
      // allow set property chaining.
      return this;
    };

    if (canIsolateES5Props) {
      isolateES5Props(proto);
    }

  }

  startTracking(entity: any, proto: any) {
    // create ko's for each property and assign defaultValues

    let stype = (entity.entityType || entity.complexType) as breeze.StructuralType;
    let es5Descriptors = stype._extra.es5Descriptors || {};

    // sort unmapped properties to the end
    stype.getProperties().sort(function (p1, p2) {
      let v1 = p1.isUnmapped ? 1 : 0;
      let v2 = p2.isUnmapped ? 1 : 0;
      return v1 - v2;
    }).forEach(function (prop) {
      let propName = prop.name;
      let val = entity[propName];
      let propDescr = es5Descriptors[propName];
      let koObj: any;

      // check if property is an ES5 property
      if (propDescr) {
        let getFn = propDescr.get.bind(entity);
        if (propDescr.set) {
          let setFn = propDescr.set.bind(entity);
          let rawAccessorFn = function (newValue: any) {
            if (arguments.length === 0) {
              getFn();
              return;
            } else {
              setFn(newValue);
            }
          };
          koObj = ko.computed({
            read: function () {
              (stype as any)._koDummy();
              return getFn();
            },
            write: function (newValue: any) {
              entity._$interceptor(prop, newValue, rawAccessorFn);
              (stype as any)._koDummy.valueHasMutated();
              return entity;
            }
          });
        } else {
          koObj = ko.computed({
            read: getFn,
            write: function () {
            }

          });
        }
        // check if property is already exposed as a ko object
      } else if (ko.isObservable(val)) {
        if (prop.isNavigationProperty) {
          throw new Error("Cannot assign a navigation property in an entity ctor.: " + propName);
        }
        koObj = val;
        // otherwise
      } else {
        val = initializeValueForProp(entity, prop, val);
        koObj = prop.isScalar ? ko.observable(val) : ko.observableArray(val);
      }


      if (prop.isScalar) {
        if (propDescr) {
          Object.defineProperty(entity, propName, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: koObj
          });
        } else {
          let koExt = koObj.extend({ intercept: { instance: entity, property: prop } });
          entity[propName] = koExt;
        }
      } else {
        val._koObj = koObj;
        // code to suppress extra breeze notification when
        // ko's array methods are called.
        koObj.subscribe(onBeforeChange, null, "beforeChange");
        // code to insure that any direct breeze changes notify ko
        val.arrayChanged.subscribe(onArrayChanged);

        koObj.equalityComparer = function () {
          throw new Error("Collection navigation properties may NOT be set.");
        };
        entity[propName] = koObj;
      }

    });

  }
}

breeze.config.registerAdapter("modelLibrary", ModelLibraryKnockoutAdapter);


// private fns

function getES5PropDescriptor(proto: any, propName: string): any {
  if (!canIsolateES5Props) {
    return null;
  }
  if (proto.hasOwnProperty(propName)) {
    return Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(proto, propName);
  } else {
    let nextProto = Object.getPrototypeOf(proto);
    return nextProto ? getES5PropDescriptor(nextProto, propName) : null;
  }
}

function initializeValueForProp(entity: any, prop: breeze.EntityProperty, val: any) {
  if (prop instanceof breeze.DataProperty) {
    if (prop.isComplexProperty) {
      // TODO: right now we create Empty complexObjects here - these should actually come from the entity
      if (prop.isScalar) {
        val = (prop.dataType as breeze.ComplexType)._createInstanceCore(entity, prop);
      } else {
        val = breeze.makeComplexArray([], entity, prop);
      }
    } else if (!prop.isScalar) {
      val = breeze.makePrimitiveArray([], entity, prop);
    } else if (val === undefined) {
      val = prop.defaultValue;
    }

  } else if (prop instanceof breeze.NavigationProperty) {
    if (val !== undefined) {
      throw new Error("Cannot assign a navigation property in an entity ctor.: " + prop.name);
    }
    if (prop.isScalar) {
      // TODO: change this to nullEntity later.
      val = null;
    } else {
      val = breeze.makeRelationArray([], entity, prop);
    }
  } else {
    throw new Error("unknown property: " + (prop as any).name);
  }
  return val;
}


function onBeforeChange(args: any) {
  args._koObj._suppressBreeze = true;
}

function onArrayChanged(args: any) {
  let koObj = args.array._koObj;
  if (koObj._suppressBreeze) {
    koObj._suppressBreeze = false;
  } else {
    koObj.valueHasMutated();
  }
}

function isolateES5Props(proto: any) {
  let stype = (proto.entityType || proto.complexType) as breeze.StructuralType;
  let es5Descriptors = {};
  stype.getProperties().forEach(function (prop) {
    let propDescr = getES5PropDescriptor(proto, prop.name);
    if (propDescr) {
      es5Descriptors[prop.name] = propDescr;
    }
  });
  if (!core.isEmpty(es5Descriptors)) {
    let extra = stype._extra;
    extra.es5Descriptors = es5Descriptors;
    (stype as any)._koDummy = ko.observable(null);
  }
}

