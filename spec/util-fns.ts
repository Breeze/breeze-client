import { Entity, DataType, core } from 'breeze-client';

export class UtilFns {

  static containSameItems(a1: any[], a2: any[]) {
    const areBothArrays = Array.isArray(a1) && Array.isArray(a2);
    if (!areBothArrays) return false;
    if (a1.length !== a2.length) return false;
    return a1.every( v => a2.indexOf(v) >= 0);
  }

  static getDups(items: any[]) {
    let uniqueItems: any[] = [];
    let dups: any[] = [];
    items.forEach((item) => {
      if (uniqueItems.indexOf(item) === -1) {
        uniqueItems.push(item);
      } else {
        dups.push(item);
      }
    });
    return dups;
  }

  static sizeOf(value: any, level?: number): any {
    if (level == undefined) level = 0;
    let bytes = 0, keyBytes = 0;
    let children = null;
    if (value == null) {
      bytes = 1; // not sure how much space a null or undefined take.
    } else if (typeof value === 'boolean') {
      bytes = 4;
    } else if (typeof value === 'string') {
      bytes = value.length * 2;
    } else if (typeof value === 'number') {
      bytes = 8;
    } else if (typeof value === 'object') {
      if (value['__visited__']) return null;
      value['__visited__'] = 1;
      children = [];
      for (const propName in value) {
        if (propName !== "__visited__") {
          let r = UtilFns.sizeOf(value[propName], 1);
          if (r != null && r.size !== 0) {
            bytes += r.size;
            r.name = propName;
            children.push(r);
          }
        }
      }
    }

    if (level === 0) {
      UtilFns.clearVisited(value);
    }
    if (children) {
      children.sort(function (a, b) {
        return b.size - a.size;
      });
      const alt = {};
      children.forEach(function (c) {
        alt[c.name] = c;
      });
      children = alt;
    }
    return {
      size: bytes,
      children: children
    };
  }

  static sizeOfDif(s1: any, s2: any): any {

    const dif = (s1.size || 0) - (s2.size || 0);
    let s1Val, s2Val, oDif;
    if (dif === 0) return { dif: 0, children: [] };
    let children = [] as any;
    const s1Children = s1.children || {};
    const s2Children = s2.children || {};
    for (const s1Key in s1Children) {
      s1Val = s1Children[s1Key];
      s2Val = s2Children[s1Key];
      if (s2Val) {
        s2Val.visited = true;
        oDif = UtilFns.sizeOfDif(s1Val, s2Val);
        if (oDif) {
          oDif.name = s1Key;
          children.push(oDif);
        }
      } else {
        oDif = { name: s1Key, dif: s1Val.size, s1Children: s1Val.children };
        children.push(oDif);
      }
    }
    for (const s2Key in s2Children) {
      s2Val = s2Children[s2Key];
      if (!s2Val.visited) {
        oDif = { name: "-" + s2Key, dif: -1 * s2Val.size, s2Children: s2Val.children };
        children.push(oDif);
      }
    }

    const alt = {};
    children.forEach((c: any) => {
      alt[c.name] = c;
    });
    children = alt;

    return { dif: dif, children: children };
  }

  private static clearVisited(value: any) {
    if (value == null) return;
    if (typeof value === 'object' && value["__visited__"]) {
      delete value['__visited__'];
      for (const i in value) {
        UtilFns.clearVisited(value[i]);
      }
    }
  }

  static morphStringProp(entity: Entity, propName: string) {
    const val = entity.getProperty(propName);
    const newVal = UtilFns.morphString(val);
    entity.setProperty(propName, newVal);
    return newVal;
  }

  static morphString(str: string) {
    if (!str) {
      return "_X";
    }
    if (str.length > 1 && (core.stringEndsWith(str, "_X") || core.stringEndsWith(str, "__"))) {
      return str.substr(0, str.length - 2);
    } else {
      return str + "_X";
    }
  }

  static removeAccents(s: string) {
    let r = s.toLowerCase();
    r = r.replace(new RegExp(/[àáâãäå]/g), "a");
    r = r.replace(new RegExp(/æ/g), "ae");
    r = r.replace(new RegExp(/ç/g), "c");
    r = r.replace(new RegExp(/[èéêë]/g), "e");
    r = r.replace(new RegExp(/[ìíîï]/g), "i");
    r = r.replace(new RegExp(/ñ/g), "n");
    r = r.replace(new RegExp(/[òóôõö]/g), "o");
    r = r.replace(new RegExp(/œ/g), "oe");
    r = r.replace(new RegExp(/[ùúûü]/g), "u");
    r = r.replace(new RegExp(/[ýÿ]/g), "y");
    return r;
  }

  static isSorted(collection: any[], propertyName?: string, dataType?: DataType, isDescending?: boolean, isCaseSensitive?: boolean) {
    let extractFn: (obj: any) => string = null;
    if (propertyName) {
      extractFn = function (obj) { return obj && obj.getProperty(propertyName); };
    }
    isCaseSensitive = isCaseSensitive == null ? true : isCaseSensitive;
    const compareFn = function (a: any, b: any) {
      // localeCompare has issues in Chrome.
      // const compareResult = a[propertyName].localeCompare(b.propertyName);
      return UtilFns.compare(a, b, extractFn, dataType, isDescending, isCaseSensitive);
    };
    const isOk = UtilFns.isSortedCore(collection, compareFn);

    return isOk;
  }

  private static isSortedCore(collection: any[], compareFn: (a: any, b: any) => number) {
    let firstTime = true;
    let prevItem: any;
    const isOk = collection.every(function (item) {
      if (firstTime) {
        firstTime = false;
      } else {
        const r = compareFn(prevItem, item);
        if (r > 0) {
          return false;
        }
      }
      prevItem = item;
      return true;
    });
    return isOk;
  }

  static compareByProperty(a: any, b: any, propertyName: string, dataType?: DataType, isDescending?: boolean, isCaseSensitive?: boolean) {
    const value1 = a && a.getProperty(propertyName);
    const value2 = b && b.getProperty(propertyName);
    return UtilFns.compare(value1, value2, null, dataType, isDescending, isCaseSensitive);
  }

  static compare(a: any, b: any, extractValueFn: (a: any) => any, dataType?: DataType, isDescending?: boolean, isCaseSensitive?: boolean) {
    extractValueFn = extractValueFn || function (x) { return x; };
    let value1 = extractValueFn(a);
    let value2 = extractValueFn(b);
    value1 = value1 === undefined ? null : value1;
    value2 = value2 === undefined ? null : value2;
    if (dataType === DataType.String) {
      if (!isCaseSensitive) {
        value1 = (value1 || "").toLowerCase();
        value2 = (value2 || "").toLowerCase();
      }
    } else {
      const normalize = DataType.getComparableFn(dataType);
      value1 = normalize(value1);
      value2 = normalize(value2);
    }
    if (value1 === value2) {
      return 0;
    } else if (value1 > value2 || value2 === undefined) {
      return isDescending ? -1 : 1;
    } else {
      return isDescending ? 1 : -1;
    }

  }

}


