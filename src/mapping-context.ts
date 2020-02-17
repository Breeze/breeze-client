import { DataServiceAdapter } from './interface-registry';
import { core } from './core';
import { DataType  } from './data-type';
import { DataService, JsonResultsAdapter, NodeContext, NodeMeta } from './data-service';
import { EntityState  } from './entity-state';
import { EntityAction } from './entity-action';
import { MetadataStore, EntityType, StructuralType, DataProperty, NavigationProperty } from './entity-metadata';
import { EntityManager } from './entity-manager';
import { MergeStrategy } from './query-options';
import { Entity } from './entity-aspect';
import { EntityQuery } from './entity-query';


/**
For use by breeze plugin authors only. The class is for use in building a [[IDataServiceAdapter]] implementation. 
@adapter (see [[IDataServiceAdapter]])    
@hidden 
*/
export interface MergeOptions {
  mergeStrategy: MergeStrategy;
  includeDeleted?: boolean;
  noTracking?: boolean;
}

/** @hidden */
export interface MappingContextConfig {
  dataService: DataService;
  query?: EntityQuery | string;
  entityManager: EntityManager;
  mergeOptions: MergeOptions;
}

/**
For use by breeze plugin authors only. The class is for use in building a [[IDataServiceAdapter]] implementation. 
@adapter (see [[IDataServiceAdapter]])    
@hidden 
*/
export class MappingContext {
  /** @hidden @internal */
  _$typeName!: string; // on prototype

  rawValueFn = DataProperty.getRawValueFromServer; // think about passing this in later.

  dataService!: DataService;
  query: EntityQuery | string;
  entityManager!: EntityManager;
  mergeOptions!: MergeOptions;
  adapter: DataServiceAdapter;  // assigned in the AbstractDataServiceAdapter.

  refMap: Object; // TODO
  deferredFns: Function[]; // TODO
  jsonResultsAdapter: JsonResultsAdapter;
  metadataStore: MetadataStore;

  constructor(config: MappingContextConfig) {

    core.extend(this, config, [
      "query", "entityManager", "dataService", "mergeOptions"
    ]);

    // calc'd props
    this.refMap = {};
    this.deferredFns = [];
    this.jsonResultsAdapter = this.dataService.jsonResultsAdapter!;
    this.metadataStore = this.entityManager.metadataStore;
    this.rawValueFn = DataProperty.getRawValueFromServer; // think about passing this in later.
  }

  getUrl() {
    let query = this.query;
    if (!query) {
      throw new Error("query cannot be empty");
    }
    let uriString: string;
    if (typeof query === 'string') {
      uriString = query;
    } else if (query instanceof EntityQuery) {
      uriString = this.dataService.uriBuilder!.buildUri(query, this.metadataStore);
    } else {
      throw new Error("unable to recognize query parameter as either a string or an EntityQuery");
    }
    return this.dataService.qualifyUrl(uriString);
  }

  visitAndMerge(nodes: any[], nodeContext: any) {
    let query = this.query;
    let jra = this.jsonResultsAdapter;
    nodeContext = nodeContext || {};
    let that = this;
    return core.map(nodes, function (node) {
      if (query == null && node.entityAspect) {
        // don't bother merging a result from a save that was not returned from the server.
        if (node.entityAspect.entityState.isDeleted()) {
          that.entityManager.detachEntity(node);
        } else {
          node.entityAspect.acceptChanges();
        }
        return node;
      }

      let meta = jra.visitNode(node, that, nodeContext) || {};
      node = meta.node || node;
      if (query && nodeContext.nodeType === "root" && !meta.entityType) {
        meta.entityType = query instanceof EntityQuery &&  query._getToEntityType && query._getToEntityType(that.metadataStore);
      }
      return processMeta(that, node, meta);
    }, this.mergeOptions.includeDeleted);
  }

  processDeferred() {
    if (this.deferredFns.length > 0) {
      this.deferredFns.forEach((fn) => {
        fn();
      });
    }
  }
}
MappingContext.prototype._$typeName = "MappingContext";


function processMeta(mc: MappingContext, node: any, meta: NodeMeta, assignFn?: (val: any) => void) {
  // == is deliberate here instead of ===
  if (meta.ignore || node == null) {
    return null;
  } else if (meta.nodeRefId) {
    let refValue = resolveEntityRef(mc, meta.nodeRefId);
    if (typeof refValue === "function" && assignFn != null) {
      mc.deferredFns.push(function () {
        assignFn(refValue);
      });
      return undefined; // deferred and will be set later;
    }
    return refValue;
  } else if (meta.entityType) {
    let entityType = meta.entityType;
    if (mc.mergeOptions.noTracking) {
      node = processNoMerge(mc, entityType, node);
      if (entityType.noTrackingFn) {
        node = entityType.noTrackingFn(node, entityType);
      }
      if (meta.nodeId) {
        mc.refMap[meta.nodeId] = node;
      }
      return node;
    } else {
      if (entityType.isComplexType) {
        // because we still need to do serverName to client name processing
        return processNoMerge(mc, entityType, node);
      } else {
        return mergeEntity(mc, node, meta);
      }
    }
  } else {

    if ((!meta.passThru) && typeof node === 'object' && ! core.isDate(node)) {
      node = processAnonType(mc, node);
    }

    // updating the refMap for entities is handled by updateEntityRef for entities.
    if (meta.nodeId) {
      mc.refMap[meta.nodeId] = node;
    }
    return node;
  }
}

function processNoMerge(mc: MappingContext, stype: StructuralType, node: any) {
  let result = {};

  stype.dataProperties.forEach(function (dp) {
    if (dp.isComplexProperty) {
      result[dp.name] = core.map(node[dp.nameOnServer], (v: any) => {
        return processNoMerge(mc, dp.dataType as any, v);
      });
    } else {
      result[dp.name] = DataType.parseRawValue(node[dp.nameOnServer], dp.dataType as DataType);
    }
  });

  (stype instanceof EntityType) && stype.navigationProperties.forEach( (np) => {
    let nodeContext = { nodeType: "navProp", navigationProperty: np };
    visitNode(node[np.nameOnServer], mc, nodeContext, result, np.name);
  });

  return result;
}

function processAnonType(mc: MappingContext, node: any) {
  // node is guaranteed to be an object by this point, i.e. not a scalar
  let keyFn = mc.metadataStore.namingConvention.serverPropertyNameToClient;
  let result = {};

  core.objectForEach(node, function (key, value) {
    let newKey = keyFn(key);
    let nodeContext = { nodeType: "anonProp", propertyName: newKey };
    visitNode(value, mc, nodeContext, result, newKey);
  });
  return result;
}

function visitNode(node: any, mc: MappingContext, nodeContext: NodeContext, result: Object, key: string) {
  let jra = mc.jsonResultsAdapter;
  let meta = jra.visitNode(node, mc, nodeContext) || {};
  // allows visitNode to change the value;
  node = meta.node || node;

  if (meta.ignore) return;
  if (meta.passThru) return node;
  if (Array.isArray(node)) {
    nodeContext.nodeType = nodeContext.nodeType + "Item";
    result[key] = node.map(function (v, ix) {
      meta = jra.visitNode(v, mc, nodeContext) || {};
      v = meta.node || v;
      return processMeta(mc, v, meta, function (refValue) {
        result[key][ix] = refValue();
      });
    });
  } else {
    result[key] = processMeta(mc, node, meta, function (refValue) {
      result[key] = refValue();
    });
  }
}

function resolveEntityRef(mc: MappingContext, nodeRefId: string) {
  let entity = mc.refMap[nodeRefId];
  if (entity === undefined) {
    return function () {
      return mc.refMap[nodeRefId];
    };
  } else {
    return entity;
  }
}

function updateEntityRef(mc: MappingContext, targetEntity: any, node: any) {
  let nodeId = node._$meta.nodeId;
  if (!nodeId && node._$meta.extraMetadata) {
    // odata case.  refMap isn't really used, but is returned as data.retrievedEntities, so we populated it anyway.
    nodeId = node._$meta.extraMetadata.uriKey;
  }
  if (nodeId != null) {
    mc.refMap[nodeId] = targetEntity;
  }
}

// can return null for a deleted entity if includeDeleted == false
function mergeEntity(mc: MappingContext, node: any, meta: NodeMeta) {
  node._$meta = meta;
  let em = mc.entityManager;

  let entityType = meta.entityType as EntityType;
  if (typeof (entityType) === 'string') {
    entityType = mc.metadataStore._getStructuralType(entityType, false) as EntityType;
  }
  node.entityType = entityType;

  let mergeStrategy = mc.mergeOptions.mergeStrategy;
  let isSaving = mc.query == null;

  let entityKey = entityType.getEntityKeyFromRawEntity(node, mc.rawValueFn);
  let targetEntity = em.findEntityByKey(entityKey);
  if (targetEntity) {
    if (isSaving && targetEntity.entityAspect.entityState.isDeleted()) {
      em.detachEntity(targetEntity);
      return targetEntity;
    }
    let targetEntityState = targetEntity.entityAspect.entityState;
    if (mergeStrategy === MergeStrategy.Disallowed) {
      throw new Error("A MergeStrategy of 'Disallowed' prevents " + entityKey.toString() + " from being merged");
    } else if (mergeStrategy === MergeStrategy.SkipMerge) {
      updateEntityNoMerge(mc, targetEntity, node);
    } else {
      if (mergeStrategy === MergeStrategy.OverwriteChanges
        || targetEntityState.isUnchanged()) {
        updateEntity(mc, targetEntity, node);
        targetEntity.entityAspect.wasLoaded = true;
        if (meta.extraMetadata) {
          targetEntity.entityAspect.extraMetadata = meta.extraMetadata;
        }
        targetEntity.entityAspect.entityState = EntityState.Unchanged;
        clearOriginalValues(targetEntity);
        // propertyName not specified because multiple props EntityChangedEventArgs
        targetEntity.entityAspect.propertyChanged.publish({ entity: targetEntity, propertyName: null });
        let action = isSaving ? EntityAction.MergeOnSave : EntityAction.MergeOnQuery;
        em.entityChanged.publish({ entityAction: action, entity: targetEntity });
        // this is needed to handle an overwrite of a modified entity with an unchanged entity
        // which might in turn cause _hasChanges to change.
        if (!targetEntityState.isUnchanged()) {
          em._notifyStateChange(targetEntity, false);
        }
      } else {
        if (targetEntityState === EntityState.Deleted && !mc.mergeOptions.includeDeleted) {
          return null;
        }
        updateEntityNoMerge(mc, targetEntity, node);
      }
    }
  } else {
    targetEntity = entityType._createInstanceCore() as Entity;

    updateEntity(mc, targetEntity, node);

    if (meta.extraMetadata) {
      targetEntity.entityAspect.extraMetadata = meta.extraMetadata;
    }
    // em._attachEntityCore(targetEntity, EntityState.Unchanged, MergeStrategy.Disallowed);
    em._attachEntityCore(targetEntity, EntityState.Unchanged, mergeStrategy);
    targetEntity.entityAspect.wasLoaded = true;
    em.entityChanged.publish({ entityAction: EntityAction.AttachOnQuery, entity: targetEntity });
  }
  return targetEntity;
}

// copied from entityAspect
function clearOriginalValues(target: any) {
  let aspect = target.entityAspect || target.complexAspect;
  aspect.originalValues = {};
  let stype = target.entityType || target.complexType;
  stype.complexProperties.forEach(function (cp: any) {
    let cos = target.getProperty(cp.name);
    if (cp.isScalar) {
      clearOriginalValues(cos);
    } else {
      cos._acceptChanges();
      cos.forEach(clearOriginalValues);
    }
  });
}


function updateEntityNoMerge(mc: MappingContext, targetEntity: Entity, node: any) {
  updateEntityRef(mc, targetEntity, node);
  // we still need to merge related entities even if top level entity wasn't modified.
  node.entityType.navigationProperties.forEach(function (np: NavigationProperty) {
    if (np.isScalar) {
      mergeRelatedEntityCore(mc, node, np);
    } else {
      mergeRelatedEntitiesCore(mc, node, np);
    }
  });
}

function updateEntity(mc: MappingContext, targetEntity: Entity, node: any) {
  updateEntityRef(mc, targetEntity, node);
  let entityType = targetEntity.entityType;
  entityType._updateTargetFromRaw(targetEntity, node, mc.rawValueFn);

  entityType.navigationProperties.forEach(function (np) {
    if (np.isScalar) {
      mergeRelatedEntity(mc, np, targetEntity, node);
    } else {
      mergeRelatedEntities(mc, np, targetEntity, node);
    }
  });
}

function mergeRelatedEntity(mc: MappingContext, navigationProperty: NavigationProperty, targetEntity: Entity, rawEntity: any) {

  let relatedEntity = mergeRelatedEntityCore(mc, rawEntity, navigationProperty);
  if (relatedEntity == null) return;
  if (typeof relatedEntity === 'function') {
    mc.deferredFns.push(function () {
      relatedEntity = relatedEntity();
      updateRelatedEntity(relatedEntity, targetEntity, navigationProperty);
    });
  } else {
    updateRelatedEntity(relatedEntity, targetEntity, navigationProperty);
  }
}

function mergeRelatedEntities(mc: MappingContext, navigationProperty: NavigationProperty, targetEntity: Entity, rawEntity: any) {
  let relatedEntities = mergeRelatedEntitiesCore(mc, rawEntity, navigationProperty);
  if (relatedEntities == null) return;

  let inverseProperty = navigationProperty.inverse;
  if (!inverseProperty) return;

  let originalRelatedEntities = targetEntity.getProperty(navigationProperty.name);
  originalRelatedEntities.wasLoaded = true;

  relatedEntities.forEach(function (relatedEntity: any) {
    if (typeof relatedEntity === 'function') {
      mc.deferredFns.push(function () {
        relatedEntity = relatedEntity();
        updateRelatedEntityInCollection(mc, relatedEntity, originalRelatedEntities, targetEntity, inverseProperty as NavigationProperty);
      });
    } else {
      updateRelatedEntityInCollection(mc, relatedEntity, originalRelatedEntities, targetEntity, inverseProperty as NavigationProperty);
    }
  });
}

function mergeRelatedEntityCore(mc: MappingContext, rawEntity: any, navigationProperty: NavigationProperty) {
  let relatedRawEntity = rawEntity[navigationProperty.nameOnServer];
  if (!relatedRawEntity) return null;

  let relatedEntity = mc.visitAndMerge(relatedRawEntity, { nodeType: "navProp", navigationProperty: navigationProperty });
  return relatedEntity;
}

function mergeRelatedEntitiesCore(mc: MappingContext, rawEntity: any, navigationProperty: NavigationProperty) {
  let relatedRawEntities = rawEntity[navigationProperty.nameOnServer];
  if (!relatedRawEntities) return null;

  // needed if what is returned is not an array and we expect one - this happens with __deferred in OData.
  if (!Array.isArray(relatedRawEntities)) {
    // return null;
    relatedRawEntities = relatedRawEntities.results; // OData v3 will look like this with an expand
    if (!relatedRawEntities) {
      return null;
    }
  }

  let relatedEntities = mc.visitAndMerge(relatedRawEntities, { nodeType: "navPropItem", navigationProperty: navigationProperty });
  return relatedEntities;
}

function updateRelatedEntity(relatedEntity: Entity, targetEntity: Entity, navigationProperty: NavigationProperty) {
  if (!relatedEntity) return;
  let propName = navigationProperty.name;
  let currentRelatedEntity = targetEntity.getProperty(propName);

  // check if the related entity is already hooked up
  if (currentRelatedEntity !== relatedEntity) {
    // if not hook up both directions.
    targetEntity.setProperty(propName, relatedEntity);
    let inverseProperty = navigationProperty.inverse;
    if (!inverseProperty) return;
    if (inverseProperty.isScalar) {
      relatedEntity.setProperty(inverseProperty.name, targetEntity);
    } else {
      let collection = relatedEntity.getProperty(inverseProperty.name);
      collection.push(targetEntity);

    }
  }
}

function updateRelatedEntityInCollection(mc: MappingContext, relatedEntity: Entity | undefined,
    relatedEntities: Entity[], targetEntity: Entity, inverseProperty: NavigationProperty) {
  if (!relatedEntity) return;

  // don't update relatedCollection if preserveChanges & relatedEntity has an fkChange.
  if (relatedEntity.entityAspect.entityState === EntityState.Modified
    && mc.mergeOptions.mergeStrategy === MergeStrategy.PreserveChanges) {
    let origValues = relatedEntity.entityAspect.originalValues;
    let fkWasModified = inverseProperty.relatedDataProperties.some(function (dp) {
      return origValues[dp.name] != undefined;
    });
    if (fkWasModified) return;
  }
  // check if the related entity is already hooked up
  let thisEntity = relatedEntity.getProperty(inverseProperty.name);

  if (thisEntity !== targetEntity) {
    // if not - hook it up.
    relatedEntities.push(relatedEntity);
    relatedEntity.setProperty(inverseProperty.name, targetEntity);
  }
}


