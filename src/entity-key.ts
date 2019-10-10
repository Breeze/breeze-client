import { core } from './core';
import { assertParam } from './assert-param';
import { EntityType, MetadataStore } from './entity-metadata';
import { DataType } from './data-type';

/**
An EntityKey is an object that represents the unique identity of an entity.  EntityKey's are immutable.


**/
export class EntityKey {
  /** @hidden @internal */
  _$typeName: string; // actually placed on prototype
  /** @hidden @internal */
  static ENTITY_KEY_DELIMITER = ":::";
  /**  The 'EntityType' that this is a key for. __Read Only__ */
  entityType: EntityType;
  /**  An array of the values for this key. This will usually only have a single element, 
  unless the entity type has a multipart key. __Read Only__ */
  values: any[];
  /** @hidden @internal */
  _keyInGroup: string;
  /** @hidden @internal */
  _subtypes: EntityType[];

  /**
  Constructs a new EntityKey.  Each entity within an EntityManager will have a unique EntityKey.
  >     // assume em1 is an EntityManager containing a number of existing entities.
  >     var empType = em1.metadataStore.getEntityType("Employee");
  >     var entityKey = new EntityKey(empType, 1);

  EntityKey's may also be found by calling EntityAspect.getKey()
  >     // assume employee1 is an existing Employee entity
  >     var empKey = employee1.entityAspect.getKey();

  Multipart keys are created by passing an array as the 'keyValues' parameter
  >     var empTerrType = em1.metadataStore.getEntityType("EmployeeTerritory");
  >     var empTerrKey = new EntityKey(empTerrType, [ 1, 77]);
  >     // The order of the properties in the 'keyValues' array must be the same as that
  >     // returned by empTerrType.keyProperties
  @param entityType - The [[EntityType]] of the entity.
  @param keyValues - A single value or an array of values. 
  */
  constructor(entityType: EntityType, keyValues: any) {
    assertParam(entityType, "entityType").isInstanceOf(EntityType).check();
    let subtypes = entityType.getSelfAndSubtypes();
    if (subtypes.length > 1) {
      this._subtypes = subtypes.filter(function (st) {
        return st.isAbstract === false;
      });
    }

    if (!Array.isArray(keyValues)) {
      keyValues = [keyValues];
    }

    this.entityType = entityType;
    entityType.keyProperties.forEach(function (kp, i) {
      // insure that guid keys are comparable.
      if (kp.dataType === DataType.Guid) {
        keyValues[i] = keyValues[i] && keyValues[i].toLowerCase ? keyValues[i].toLowerCase() : keyValues[i];
      }
    });

    this.values = keyValues;
    this._keyInGroup = EntityKey.createKeyString(keyValues);

  }


  toJSON() {
    return {
      entityType: this.entityType.name,
      values: this.values
    };
  }

  static fromJSON(json: any, metadataStore: MetadataStore) {
    let et = metadataStore._getStructuralType(json.entityType, true) as EntityType;
    return new EntityKey(et, json.values);
  }

  /**
  Used to compare EntityKeys are determine if they refer to the same Entity.
  There is also an static version of 'equals' with the same functionality.
  
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      var empType = em1.metadataStore.getEntityType("Employee");
  >      var empKey1 = new EntityKey(empType, 1);
  >      // assume employee1 is an existing Employee entity
  >      var empKey2 = employee1.entityAspect.getKey();
  >      if (empKey1.equals(empKey2)) {
  >          // do something  ...
  >      }
  **/
  equals(entityKey: EntityKey): boolean {
    if (!(entityKey instanceof EntityKey)) return false;
    return (this.entityType === entityKey.entityType) &&
      core.arrayEquals(this.values, entityKey.values);
  }

  /*
  Returns a human readable representation of this EntityKey.
  */
  toString(altEntityType?: EntityType) {
    return (altEntityType || this.entityType).name + '-' + this._keyInGroup;
  }

  /**
  Used to compare EntityKeys are determine if they refer to the same Entity.
  There is also an instance version of 'equals' with the same functionality.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      var empType = em1.metadataStore.getEntityType("Employee");
  >      var empKey1 = new EntityKey(empType, 1);
  >      // assume employee1 is an existing Employee entity
  >      var empKey2 = employee1.entityAspect.getKey();
  >      if (EntityKey.equals(empKey1, empKey2)) {
  >          // do something  ...
  >      }
  **/
  static equals(k1: EntityKey, k2: EntityKey) {
    if (!(k1 instanceof EntityKey)) return false;
    return k1.equals(k2);
  }

  /** @hidden @internal */
  // TODO: we may want to compare to default values later.
  _isEmpty() {
    return this.values.join("").length === 0;
  }

  /** hidden */
  // TODO: think about giving _ prefix or documenting.
  static createKeyString(keyValues: any[]) {
    return keyValues.join(EntityKey.ENTITY_KEY_DELIMITER);
  }

}
EntityKey.prototype._$typeName = "EntityKey";


