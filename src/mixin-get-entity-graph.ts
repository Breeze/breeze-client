//#region Copyright, Version, and Description
/*
 * Copyright 2015-2019 IdeaBlade, Inc.  All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the IdeaBlade Breeze license, available at http://www.breezejs.com/license
 *
 * Author: Ward Bell
 * Version: 0.9.5 - Steve Schmitt - convert to TypeScript, migrate to breeze-client repo, add HasEntityGraph and mixinEntityGraph
 * Version: 0.9.4 - Marcel Good - fix UMD module name
 * --------------------------------------------------------------------------------
 * Adds getEntityGraph method to Breeze EntityManager prototype.
 * Call   mixinEntityGraph(EntityManager)   to apply the mixin in a tree-shaking-resistant way.
 * Then   (manager as any).getEntityGraph(entity, "child");
 *
 * Depends on Breeze which it patches
 *
 * For discussion, see:
 * http://www.breezejs.com/documentation/getentitygraph
 *
 * For example usage, see:
 * https://github.com/Breeze/breeze.js.samples/tree/master/net/DocCode/DocCode/tests/getEntityGraphTests.js
 */
//#endregion
import { Entity, EntityManager, EntityQuery, EntityState, EntityType, ExpandClause } from 'breeze-client';

interface EntityGroup {
  _entities: (Entity | null)[];
  _indexMap: Map<string, number>;
}

// module augmentation failed to build with ng-packagr, so we have a separate interface
export interface HasEntityGraph extends EntityManager {
  /**
  Get related entities of root entity (or root entities) as specified by expand.
  @example
      var graph = breeze.EntityManager.getEntityGraph(customer, 'Orders.OrderDetails');
      // graph will be the customer, all of its orders and their details even if deleted.
  @method getEntityGraph
  @param roots {Entity|Array of Entity} The root entity or root entities.
  @param expand {String|Array of String|Object} an expand string, a query expand clause, or array of string paths
  @return {Array of Entity} root entities and their related entities, including deleted entities. Duplicates are removed and entity order is indeterminate.
  **/
  getEntityGraph(roots: Entity | Array<Entity>, expand: string | Array<string> | ExpandClause): Array<Entity>;

  /**
  Execute query locally and return both the query results and their related entities as specified by the optional expand parameter or the query's expand clause.
  @example
      var query = breeze.EntityQuery.from('Customers')
                  .where('CompanyName', 'startsWith', 'Alfred')
                  .expand('Orders.OrderDetails');
      var graph = manager.getEntityGraph(query);
      // graph will be the 'Alfred' customers, their orders and their details even if deleted.
  @method getEntityGraph
  @param query {EntityQuery} A query to be executed against the manager's local cache.
  @param [expand] {String|Array of String|Object} an expand string, a query expand clause, or array of string paths
  @return {Array of Entity} local queried root entities and their related entities, including deleted entities. Duplicates are removed and entity order is indeterminate.
  **/
  getEntityGraph(query: EntityQuery, expand: string | Array<string> | ExpandClause): Array<Entity>;

}

export function mixinEntityGraph(emclass: { new(): EntityManager }) {
  const proto = EntityManager.prototype;

  if (!(proto as any).getEntityGraph) {
    (proto as any).getEntityGraph = getEntityGraph;
  }
}

mixinEntityGraph(EntityManager);


function getEntityGraph(roots: Entity | Array<Entity> | EntityQuery, expand: string | Array<string> | ExpandClause) {
  if (roots instanceof EntityQuery) {
    let newRoots = this.executeQueryLocally(roots);
    return getEntityGraphCore(newRoots, expand || roots.expandClause);
  } else {
    return getEntityGraphCore(roots, expand);
  }
}

function getEntityGraphCore(root: Entity | Array<Entity>, expand: string | Array<string> | ExpandClause) {
  let entityGroupMap: { [index: string]: EntityGroup };
  let graph = [] as Array<Entity>;
  let rootType: EntityType;
  let roots = Array.isArray(root) ? root : [root];
  addToGraph(roots);     // removes dups & nulls
  roots = graph.slice(); // copy of de-duped roots
  if (roots.length) {
    getRootInfo();
    getExpand();
    buildGraph();
  }
  return graph;

  function addToGraph(entities: Array<Entity>) {
    entities.forEach(function (entity) {
      if (entity && graph.indexOf(entity) < 0) {
        graph.push(entity);
      }
    });
  }

  function getRootInfo() {
    let compatTypes: Array<EntityType>;

    roots.forEach(function (root, ix) {
      let aspect;
      if (!root || !(aspect = root.entityAspect)) {
        throw getRootErr(ix, 'is not an entity');
      }
      if (aspect.entityState === EntityState.Detached) {
        throw getRootErr(ix, 'is a detached entity');
      }

      let em = aspect.entityManager;
      if (entityGroupMap) {
        if (entityGroupMap !== em._entityGroupMap) {
          throw getRootErr(ix, "has a different 'EntityManager' than other roots");
        }
      } else {
        entityGroupMap = em._entityGroupMap;
      }
      getRootType(root, ix);

    });

    function getRootErr(ix: number, msg: string) {
      return new Error("'getEntityGraph' root[" + ix + "] " + msg);
    }

    function getRootType(root: Entity, ix: number) {
      let thisType = root.entityType;
      if (!rootType) {
        rootType = thisType;
        return;
      } else if (rootType === thisType) {
        return;
      }
      // Types differs. Look for closest common base type
      // does thisType derive from current rootType?
      let baseType = rootType;
      do {
        compatTypes = compatTypes || baseType.getSelfAndSubtypes();
        if (compatTypes.indexOf(thisType) > -1) {
          rootType = baseType;
          return;
        }
        baseType = baseType.baseEntityType;
        compatTypes = null;
      } while (baseType);

      // does current rootType derives from thisType?
      baseType = thisType;
      do {
        compatTypes = baseType.getSelfAndSubtypes();
        if (compatTypes.indexOf(rootType) > -1) {
          rootType = baseType;
          return;
        }
        baseType = baseType.baseEntityType;
      } while (baseType);

      throw getRootErr(ix, "is not EntityType-compatible with other roots");
    }
  }

  function getExpand() {
    try {
      if (!expand) {
        expand = [];
      } else if (typeof expand === 'string') {
        // tricky because Breeze expandClause not exposed publically
        expand = new EntityQuery().expand(expand).expandClause;
      }
      if (expand instanceof ExpandClause && expand.propertyPaths) { // expand clause
        expand = expand.propertyPaths;
      } else if (Array.isArray(expand)) {
        if (!expand.every(function (elem) { return typeof elem === 'string'; })) {
          throw '';
        }
      } else {
        throw '';
      }
    } catch (_) {
      throw new Error(
        "expand must be an expand string, array of string paths, or a query expand clause");
    }
  }

  function buildGraph() {
    if (expand && expand instanceof Array && expand.length) {
      let fns = expand.map(makePathFn);
      fns.forEach(function (fn) { fn(roots); });
    }
  }

  // Make function to get entities along a single expand path
  // such as 'Orders.OrderDetails.Product'
  function makePathFn(path: string) {
    let fns = [] as Array<Function>,
      segments = path.split('.'),
      type = rootType;

    for (let i = 0, slen = segments.length; i < slen; i++) {
      let f = makePathSegmentFn(type, segments[i]);
      type = (f as any).navType;
      fns.push(f);
    }

    return function pathFn(entities: Array<Entity>) {
      for (let j = 0, flen = fns.length; j < flen; j++) {
        let elen = entities.length;
        if (elen === 0) { return; } // nothing left to explore
        // fn to get related entities for this path segment
        let fn = fns[j];
        // get entities related by this path segment
        let related = [] as Array<Entity>;
        for (let k = 0; k < elen; k++) {
          related = related.concat(fn(entities[k]));
        }
        addToGraph(related);
        if (j >= flen - 1) { return; } // no more path segments

        // reset entities to deduped related entities
        entities = [];
        for (let l = 0, rlen = related.length; l < rlen; l++) {
          let r = related[l];
          if (entities.indexOf(r) < 0) { entities.push(r); }
        }
      }
    };
  }

  // Make function to get entities along a single expand path segment
  // such as the 'OrderDetails' in the 'Orders.OrderDetails.Product' path
  function makePathSegmentFn(baseType: EntityType, segment: string) {
    let baseTypeName: string, fn = undefined, navType;
    try {
      baseTypeName = baseType.name;
      let nav = baseType.getNavigationProperty(segment);
      let fkName = nav.foreignKeyNames[0];
      if (!nav) {
        throw new Error(segment + " is not a navigation property of " + baseTypeName);
      }
      navType = nav.entityType;
      // add derived types
      let navTypes = navType.getSelfAndSubtypes();
      let grps = [] as Array<EntityGroup>; // non-empty groups for these types
      navTypes.forEach(function (t) {
        let grp = entityGroupMap[t.name];
        if (grp && grp._entities.length > 0) {
          grps.push(grp);
        }
      });
      let grpCount = grps.length;
      if (grpCount === 0) {
        // no related entities in cache
        fn = function () { return [] as Array<Entity>; };
      } else if (fkName) {
        fn = function (entity: Entity) {
          let val = null;
          try {
            let keyValue = entity.getProperty(fkName);
            for (let i = 0; i < grpCount; i += 1) {
              val = grps[i]._entities[grps[i]._indexMap.get(keyValue)];
              if (val) { break; }
            }
          } catch (e) { rethrow(e); }
          return val;
        };
      } else {
        fkName = nav.inverse ?
          nav.inverse.foreignKeyNames[0] :
          nav.invForeignKeyNames[0];
        if (!fkName) { throw new Error("No inverse keys"); }
        fn = function (entity: Entity) {
          let vals = [] as Array<Entity>;
          try {
            let keyValue = entity.entityAspect.getKey().values[0];
            grps.forEach(function (grp) {
              vals = vals.concat(grp._entities.filter(function (en) {
                return en && en.getProperty(fkName) === keyValue;
              }));
            });
          } catch (e) { rethrow(e); }
          return vals;
        };
      }
      (fn as any).navType = navType;
      (fn as any).path = segment;

    } catch (err) { rethrow(err); }
    return fn;

    function rethrow(e: Error) {
      let typeName = baseTypeName || baseType;
      let error = new Error("'getEntityGraph' can't expand '" + segment + "' for " + typeName);
      (error as any).innerError = e;
      throw error;
    }
  }
}


