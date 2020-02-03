import { Predicate, FilterQueryOp } from 'breeze-client';

declare let console: any;

describe("Predicate", () => {

  function okJSON(pred: Predicate, jsonObj: object) {
    const predJSON = JSON.stringify(pred.toJSON());
    const testJSON = JSON.stringify(jsonObj);
    expect(predJSON).toBe(testJSON);
  }

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

});