import { Predicate, FilterQueryOp, MetadataStore, EntityType, OrderByClause, DataType, core } from 'breeze-client';
import { TestFns } from './test-fns';

declare let console: any;

describe("Query Construction", () => {
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

  test('constructor', function () {
    expect(2);
    //throw new Error("test error"); // prove that test would fail if Predicate throws
    // Ex1
    const p1 = new Predicate("CompanyName", "StartsWith", "B");
    okJSON(p1, { "CompanyName": { "startswith": "B" } });
    // Ex2
    const p2 = new Predicate("Region", FilterQueryOp.Equals, null);
    okJSON(p2, { "Region": null });
  });

  test('and - class method', function () {
    expect(1);
    // Ex1
    const dt = new Date(Date.UTC(1988, 9, 12));
    const p1 = Predicate.create("OrderDate", "ne", dt);
    const p2 = Predicate.create("ShipCity", "startsWith", "C");
    const p3 = Predicate.create("Freight", ">", 100);
    let newPred = Predicate.and(p1, p2, p3);

    // Ex2
    const preds = [p1, p2, p3];
    newPred = Predicate.and(preds);
    okJSON(newPred, { "and": [{ "OrderDate": { "ne": "1988-10-12T00:00:00.000Z" } }, { "ShipCity": { "startswith": "C" } }, { "Freight": { "gt": 100 } }] });
  });

  // D#2674
  test('and - instance method', function () {
    expect(2);
    // Ex1
    const dt = new Date(Date.UTC(1988, 9, 12));
    const p1 = Predicate.create("OrderDate", "ne", dt);
    const p2 = Predicate.create("ShipCity", "startsWith", "C");
    const p3 = Predicate.create("Freight", ">", 100);
    let newPred = p1.and(p2, p3);

    // Ex2
    const preds = [p2, p3];
    newPred = p1.and(preds);
    okJSON(newPred, { "and": [{ "OrderDate": { "ne": "1988-10-12T00:00:00.000Z" } }, { "ShipCity": { "startswith": "C" } }, { "Freight": { "gt": 100 } }] });

    // Ex3
    const p4 = Predicate.create("ShipCity", "startswith", "F")
      .and("Size", "gt", 2000);
    okJSON(p4, { "ShipCity": { "startswith": "F" }, "Size": { "gt": 2000 } });
  });

  // D#2674
  test('create - class method', function () {
    expect(3);
    const a = 'ShipCity';
    const b = 'startswith';
    const c = 'F';

    // Ex1
    const p1 = Predicate.create(a, b, c);
    // Ex2
    const p2 = new Predicate(a, b, c);

    // The any/all constiations are not documented.
    // But we can test them anyway.
    // Ex3
    const p3 = new Predicate('orders', 'any', a, b, c);
    okJSON(p3, { "orders": { "any": { "ShipCity": { "startswith": "F" } } } });

    // Ex4
    const p4 = new Predicate('orders', 'all', a, b, c);
    okJSON(p4, { "orders": { "all": { "ShipCity": { "startswith": "F" } } } });

    const p4a = Predicate.create("orders", "any", a, b, c);

    const p4b = Predicate.create("orders", "any", [a, b, c]);

    const p4c = Predicate.create("orders", "any", p1);
    okJSON(p4c, { "orders": { "any": { "ShipCity": { "startswith": "F" } } } });
  });

  test('not - class method', function () {
    expect(1);
    // Ex1
    const p1 = Predicate.create("Freight", "gt", 100);
    const not_p1 = Predicate.not(p1);

    okJSON(not_p1, { "not": { "Freight": { "gt": 100 } } });
  });

  test('not - instance method', function () {
    expect(1);
    // Ex1
    const p1 = Predicate.create("Freight", "gt", 100);
    const not_p1 = p1.not();
    okJSON(not_p1, { "not": { "Freight": { "gt": 100 } } });
  });

  test('or - class method', function () {
    expect(2);
    // Ex1
    const dt = new Date(Date.UTC(88, 9, 12));
    const p1 = Predicate.create("OrderDate", "ne", dt);
    const p2 = Predicate.create("ShipCity", "startsWith", "C");
    const p3 = Predicate.create("Freight", ">", 100);
    let newPred = Predicate.or(p1, p2, p3);
    okJSON(newPred, { "or": [{ "OrderDate": { "ne": "1988-10-12T00:00:00.000Z" } }, { "ShipCity": { "startswith": "C" } }, { "Freight": { "gt": 100 } }] });

    // Ex2
    const preds = [p1, p2, p3];
    newPred = Predicate.or(preds);
    okJSON(newPred, { "or": [{ "OrderDate": { "ne": "1988-10-12T00:00:00.000Z" } }, { "ShipCity": { "startswith": "C" } }, { "Freight": { "gt": 100 } }] });
  });

  // D#2674
  test('or - instance method', function () {
    expect(2);
    // Ex1
    const dt = new Date(Date.UTC(88, 9, 12));
    const p1 = Predicate.create("OrderDate", "ne", dt);
    const p2 = Predicate.create("ShipCity", "startsWith", "C");
    const p3 = Predicate.create("Freight", ">", 100);
    let newPred = p1.or(p2, p3);

    // Ex2
    const preds = [p2, p3];
    newPred = p1.or(preds);
    okJSON(newPred, { "or": [{ "OrderDate": { "ne": "1988-10-12T00:00:00.000Z" } }, { "ShipCity": { "startswith": "C" } }, { "Freight": { "gt": 100 } }] });

    // Ex3
    const p4 = Predicate.create("ShipCity", "startswith", "F")
      .or("Size", "gt", 2000);
    okJSON(p4, { "or": [{ "ShipCity": { "startswith": "F" } }, { "Size": { "gt": 2000 } }] });

  });

  test("JSON can handle 'startswith'", function () {
    expect(1);
    const p2 = { companyName: { startswith: 'B' } };

    const p = Predicate.create(p2);
    okJSON(p, { "companyName": { "startswith": "B" } });
  });

  test("JSON can handle 'and' with 'startswith'", function () {
    expect(1);
    const p2 = {
      and: [
        { companyName: { startswith: 'B' } },
        // { country: { in: [ 'Belgium', 'Germany'] } },
        // { not: { country: { in: [ 'Belgium', 'Germany'] } } }
        { country: { ne: 'Belgium' } },
        { country: { ne: 'Germany' } }
      ]
    };

    const p = Predicate.create(p2);
    okJSON(p, { "and": [{ "companyName": { "startswith": "B" } }, { "country": { "ne": "Belgium" } }, { "country": { "ne": "Germany" } }] });
  });

  test("JSON can handle 'and' with 'in'", function () {
    expect(1);
    const p2 = {
      and: [
        { companyName: { startswith: 'B' } },
        { country: { in: ['Belgium', 'Germany'] } },
      ]
    };

    const p = Predicate.create(p2);
    okJSON(p, { "companyName": { "startswith": "B" }, "country": { "in": ["Belgium", "Germany"] } });
  });

  test("JSON can handle 'not': expr: 'in'", function () {
    expect(1);
    // const p2 = { country: { not: { in: [ 'Belgium', 'Germany'] } } };
    const p2 = { not: { country: { in: ['Belgium', 'Germany'] } } };

    const p = Predicate.create(p2);
    okJSON(p, { "not": { "country": { "in": ["Belgium", "Germany"] } } });
  });

  test("JSON can handle 'and' with 'not':'in'", function () {
    expect(1);
    const p2 = {
      and: [
        { companyName: { startswith: 'B' } },
        { not: { country: { in: ['Belgium', 'Germany'] } } },
      ]
    };

    const p = Predicate.create(p2);
    okJSON(p, { "companyName": { "startswith": "B" }, "not": { "country": { "in": ["Belgium", "Germany"] } } });
  });

  test("should support both new and old ctor mechs", () => {
    let p1 = new Predicate("CompanyName", "StartsWith", "B");
    let p2 = (Predicate as any)("CompanyName", "StartsWith", "B"); // calling without ctor
    let p3 = Predicate.create("CompanyName", "startsWith", "B");
    let p4 = Predicate.create(["CompanyName", "StartsWith", "B"]);
    let p5 = Predicate.create({ CompanyName: { startsWith: "B" } });
    let p6 = (Predicate as any)({ CompanyName: { StartsWith: "B" } }); // calling without ctor
    expect(p1.toString()).toEqual(p2.toString());
    expect(p1.toString()).toEqual(p3.toString());
    expect(p1.toString()).toEqual(p4.toString());
    expect(p1.toString()).toEqual(p5.toString());
    expect(p1.toString()).toEqual(p6.toString());

  });

  test("should support toJson", () => {
    let p1 = new Predicate("CompanyName", "StartsWith", "B");
    let json = p1.toJSON();
    let s = JSON.stringify(json);
    expect(s).toBeTruthy();
  });

  test("predicate - simple toString()", function () {
    const p = new Predicate("Freight", ">", 100);
    const txt = p.toString();
    expect(txt.length).toBeGreaterThan(5);
  });


  test("predicate internal - simple toFunction()", function () {
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


  test("predicate internal - composite - toFunction", function () {
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

  test("orderByClause internal - comparer", function () {
    const obc = new OrderByClause(["ShipCity"]);

    let comparer = obc.getComparer(null);
    let ents = entities.sort(comparer);
    expect(TestFns.isSorted(ents, "ShipCity", DataType.String, false, false)).toBe(true);
    const obc2 = new OrderByClause(["ShipCity"], true);
    comparer = obc2.getComparer(null);
    ents = entities.sort(comparer);
    expect(TestFns.isSorted(ents, "ShipCity", DataType.String, true, false)).toBe(true);
  });

  test("orderByClause internal - comparer - 2 parts", function () {
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

  function okJSON(pred: Predicate, jsonObj: object) {
    const predJSON = JSON.stringify(pred.toJSON());
    const testJSON = JSON.stringify(jsonObj);
    expect(predJSON).toBe(testJSON);
  }

  function makeFilter(propName: string, value: any) {
    return (obj: object) => {
      return obj[propName] === value;
    };
  }

});