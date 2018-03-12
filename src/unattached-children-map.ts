import { core } from './core';
import { IEntity } from './entity-aspect';
import { NavigationProperty } from './entity-metadata';
import { EntityKey } from './entity-key';

/** @hidden @internal */
export interface INavTuple {
  navigationProperty: NavigationProperty;
  children: IEntity[];
}

/** @hidden @internal */
// Represents entities not yet attached to navigationProperties. 
export class UnattachedChildrenMap {
  // key is EntityKey.toString(), value is array of { navigationProperty, children }
  map: { [index: string]: INavTuple[] } = {};


  addChild(parentEntityKey: EntityKey, navigationProperty: NavigationProperty, child: IEntity) {
    let tuple = this.getTuple(parentEntityKey, navigationProperty);
    if (!tuple) {
      tuple = { navigationProperty: navigationProperty, children: [] };
      core.getArray(this.map, parentEntityKey.toString()).push(tuple);
    }
    tuple.children.push(child);
  }

  removeChildren(parentEntityKeyString: string, navigationProperty: NavigationProperty) {
    let tuples = this.map[parentEntityKeyString];
    if (!tuples) return;
    core.arrayRemoveItem(tuples, (t: any) => {
      return t.navigationProperty === navigationProperty;
    });
    if (!tuples.length) {
      delete this.map[parentEntityKeyString];
    }
  }

  getTuple(parentEntityKey: EntityKey, navigationProperty: NavigationProperty) {
    let tuples = this.getTuples(parentEntityKey);
    if (!tuples) return null;
    let tuple = core.arrayFirst(tuples, function (t) {
      return t.navigationProperty === navigationProperty;
    });
    return tuple;
  }

  getTuples(parentEntityKey: EntityKey) {
    let allTuples: INavTuple[] = [];
    let tuples = this.map[parentEntityKey.toString()];
    if (tuples) {
      allTuples = allTuples.concat(tuples);
    }
    let entityType = parentEntityKey.entityType;
    while (entityType.baseEntityType) {
      entityType = entityType.baseEntityType;
      let baseKey = parentEntityKey.toString(entityType);
      tuples = this.map[baseKey];
      if (tuples) {
        allTuples = allTuples.concat(tuples);
      }
    }
    return (allTuples.length) ? allTuples : undefined;
  }

  getTuplesByString(parentEntityKeyString: string) {
    return this.map[parentEntityKeyString];
  }

}
