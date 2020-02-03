import { Predicate, FilterQueryOp, MetadataStore, EntityType, core, OrderByClause, DataType } from 'breeze-client';
import { TestFns } from './test-fns';

// declare let console: any;

describe("EntityQuery - internal tests - no server", () => {
  let entities: any[];
  
  beforeEach(() => {
    entities = [
      { id: 0, OrderDate: new Date(88, 1, 12), ShipCity: "Los Angeles", Size: 100 },
      { id: 1, OrderDate: new Date(88, 2, 12), ShipCity: "Chicago" },
      { id: 2, OrderDate: new Date(88, 9, 12), ShipCity: "Cannes", Size: 2000 },
      { id: 3, OrderDate: new Date(88, 10, 12), ShipCity: "Fargo", Size: 2000 },
      { id: 4, OrderDate: new Date(88, 11, 12), Size: 4000 },
      { id: 5, OrderDate: new Date(89, 1, 1), Size: 3000, ShipCity: "Fresno" }
    ];
    entities.forEach(function (e) {
      e.getProperty = function (p: string) {
        return this[p];
      };
      e.setProperty = function (p: string, v: any) {
        this[p] = v;
      };
    });
  });

  test("predicateBuilder simple toString()", function () {
    const p = new Predicate("Freight", ">", 100);
    const txt = p.toString();
    expect(txt.length).toBeGreaterThan(5);
  });

  

  test("predicateBuilder simple toFunction()", function () {
    const dt = new Date(88, 9, 12);
    const dateStr = dt.toISOString();
    const ms = new MetadataStore();
    const nullEt = new EntityType(ms);
    const config = { entityType: nullEt };
    const p1 = Predicate.create("OrderDate", ">", dt);
    const func1 = p1.toFunction(config);
    const r1 = entities.filter(func1);
    expect(r1.length).toBe(3);

    const p2 = Predicate.create("OrderDate", "Gt", dt);
    const func2 = p2.toFunction(config);
    const r2 = entities.filter(func2);
    expect(core.arrayEquals(r1, r2)).toBe(true);

    const p3 = Predicate.create("OrderDate", "==", dt);
    const func3 = p3.toFunction(config);
    const r3 = entities.filter(func3);
    expect(r3.length).toBe(1);

    const p4 = Predicate.create("OrderDate", "ne", dt);
    const func4 = p4.toFunction(config);
    const r4 = entities.filter(func4);
    expect(r4.length).toBe(5);

    const p5 = Predicate.create("ShipCity", "stArtsWiTH", "C");
    const func5 = p5.toFunction(config);
    const r5 = entities.filter(func5);
    expect(r5.length).toBe(2);
  });


  test("predicateBuilder composite - toFunction", function () {
    const ms = new MetadataStore();
    const nullEt = new EntityType(ms);
    const config = { entityType: nullEt };
    const p1 = Predicate.create("ShipCity", "startswith", "F").and("Size", "gt", 2000);
    const func1 = p1.toFunction(config);
    const r1 = entities.filter(func1);
    expect(r1.length).toBe(1);

    const p2 = p1.not();
    const func2 = p2.toFunction(config);
    const r2 = entities.filter(func2);
    expect(r2.length).toBe(5);

    const p3 = Predicate.create("ShipCity", "stArtsWiTH", "F").or("ShipCity", "startswith", "C")
        .and("Size", 'ge', 2000);
    const func3 = p3.toFunction(config);
    const r3 = entities.filter(func3);
    expect(r3.length).toBe(3);

    const p4 = p3.not();
    const func4 = p4.toFunction(config);
    const r4 = entities.filter(func4);
    expect(r4.length).toBe(3);
  });

  test("orderByClause - comparer", function () {
    const obc = new OrderByClause(["ShipCity"]);

    let comparer = obc.getComparer(null);
    let ents = entities.sort(comparer);
    expect(TestFns.isSorted(ents, "ShipCity", DataType.String, false, false)).toBe(true);
    const obc2 = new OrderByClause(["ShipCity"], true);
    comparer = obc2.getComparer(null);
    ents = entities.sort(comparer);
    expect(TestFns.isSorted(ents, "ShipCity", DataType.String, true, false)).toBe(true);
  });

  test("orderByClause - comparer - 2 parts", function () {
    const obc = new OrderByClause(["Size", "ShipCity"]);

    let comparer = obc.getComparer(null);
    entities.sort(comparer);
    const e1 = entities.slice(0);
    expect(TestFns.isSorted(e1, "Size", DataType.Int32, false, false)).toBe(true);
    let cities = e1.filter(makeFilter("Size", 2000)).map(core.pluck("ShipCity"));
    expect(core.arrayEquals(cities, ["Cannes", "Fargo"])).toBe(true);
    const obc2 = new OrderByClause(["Size", "ShipCity"], true);
    comparer = obc2.getComparer(null);
    entities.sort(comparer);
    const e2 = entities.slice(0);
    expect(TestFns.isSorted(e2, "Size", DataType.Int32, true, false)).toBe(true);
    cities = e2.filter(makeFilter("Size", 2000)).map(core.pluck("ShipCity"));
    expect(core.arrayEquals(cities, ["Fargo", "Cannes"])).toBe(true);
  });

  function makeFilter(propName: string, value: any) {
    return (obj: object) => {
      return obj[propName] === value;
    };
  }


});