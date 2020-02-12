import { Entity, EntityQuery, Predicate } from 'breeze-client';
import { TestFns, skipDescribeIf, skipTestIf } from './test-fns';
import { UtilFns } from './util-fns';
import { skip } from 'rxjs/operators';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

 

describe( "Query Any/All predicates", () => {

  beforeEach(function () {

  });

  test("any and gt", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("orders", "any", "freight", ">", 950);
    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length >= 1 && emps.length <= 10).toBe(true);
  });

  // The 'all' predicate is not currently supported for Sequelize
  skipTestIf(TestFns.isSequelizeServer, 
    "any can be expressed as not all", async function () {
    expect.hasAssertions();
    const maxFreight = 800;
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("orders", "any", "freight", ">", maxFreight)
      .expand("orders");

    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBeGreaterThan(0);
    emps.forEach(function (emp) {
      const orders = emp.getProperty("orders");
      // at least one order on each emp should be > maxFreight 
      const isOk = orders.some((order: Entity) => order.getProperty("freight") > maxFreight);
      expect(isOk).toBe(true);
    });
    const p1 = new Predicate("freight", "<=", maxFreight).or("freight", "==", null);
    const predicate = new Predicate("orders", "all", p1).not();
    const query2 = EntityQuery.from("Employees")
      .where(predicate)
      .expand("orders");

    const qr2 = await em.executeQuery(query2);
    const emps2 = qr2.results;
    expect(emps.length).toBe(emps2.length);
    const isOk = emps.every(emp => emps2.indexOf(emp) >= 0);
    expect(isOk).toBe(true);
  });

  // The 'all' predicate is not currently supported for Sequelize
  skipTestIf(TestFns.isSequelizeServer, 
    "any with territories/regions and inverse with all", async function () {
    expect.hasAssertions();
    const maxFreight = 800;
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Regions")
      .where("territories", "any", "territoryDescription", "startsWith", "B")
      .expand("territories");
    const qr1 = await em.executeQuery(query);
    const regions = qr1.results;
    expect(regions.length).toBeGreaterThan(0);
    regions.forEach(function (region) {
      const territories = region.getProperty("territories") as [];
      const isOk = territories.some((territory: Entity) => {
        const descr = territory.getProperty("territoryDescription");
        return descr.indexOf("B") === 0;
      });
      expect(isOk).toBe(true);
    });
    const p1 = new Predicate("territoryDescription", "startsWith", "B").not().or("territoryDescription", "==", null);
    const predicate = new Predicate("territories", "all", p1).not();
    const query2 = EntityQuery.from("Regions")
      .where(predicate)
      .expand("territories");
    const qr2 = await em.executeQuery(query2);
    const regions2 = qr2.results;
    expect(regions2.length).toBe(regions.length);
    const isOk = regions.every((region) => regions2.indexOf(region) >= 0);
    expect(isOk).toBe(true);
  });



  test("any and gt (local)", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("orders", "any", "freight", ">", 950)
      .expand("orders");

    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBeGreaterThan(0);
    const emps2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(emps, emps2);
    // const isOk2 = UtilFns.containSameItems(emps, emps2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");

  });

// The 'all' predicate is not currently supported for Sequelize
  skipTestIf(TestFns.isSequelizeServer, 
  "all with composite predicates ", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p2 = Predicate.create("freight", ">", 10);
    const p1 = Predicate.create("orders", "all", p2);
    const p0 = Predicate.create("companyName", "contains", "ar").and(p1);
    const query = EntityQuery.from("Customers").where(p0).expand("orders");

    const qr1 = await em.executeQuery(query);
    const custs = qr1.results;
    custs.forEach(function (cust) {
      expect(cust.getProperty("companyName").indexOf("ar") >= 0).toBe(true);
      const orders = cust.getProperty("orders") as Entity[];
      const isOk = orders.every(o => o.getProperty("freight") > 10);
      expect(isOk).toBe(true); //, "every order should have a freight value > 10");
    });
    const custs2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(custs, custs2);
    expect(isOk).toBe(true);

  });

  // Unable to negate an expression that requires a Sequelize 'include'
  skipTestIf(TestFns.isSequelizeServer, 
    "any with not", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    // customers with no orders
    const p = Predicate.create("orders", "any", "rowVersion", ">=", 0).not();
    const query = EntityQuery.from("Customers").where(p).expand("orders");

    const data = await em.executeQuery(query);
    const custs = data.results;
    custs.forEach(function (cust) {
      const orders = cust.getProperty("orders");
      expect(orders.length).toBe(0);
    });
    const custs2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(custs, custs2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  // The 'all' predicate is not currently supported for Sequelize
  skipTestIf(TestFns.isSequelizeServer, 
    "any with != null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    // customers with no orders
    const p = Predicate.create("orders", "any", "rowVersion", "!=", null).not();
    const query = EntityQuery.from("Customers").where(p).expand("orders");

    const data = await em.executeQuery(query);
    const custs = data.results;
    custs.forEach(function (cust) {
      const orders = cust.getProperty("orders");
      expect(orders.length).toBe(0);
    });
    const custs2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(custs, custs2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  test("any and gt with expand", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("orders", "any", "freight", ">", 950)
      .expand("orders");
    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBeGreaterThan(0);
    emps.forEach(emp => {
      const orders = emp.getProperty("orders") as Entity[];
      const isOk = orders.some(order => order.getProperty("freight") > 950);
      expect(isOk).toBe(true); //, "should be some order with freight > 950");
    });
    const emps2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(emps, emps2);
    expect(isOk).toBe(true);
  });

  test("any and nested property", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("orders", "any", "customer.companyName", "startsWith", "Lazy")
      .expand("orders.customer");

    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBe(2);
    emps.slice(0, 5).forEach((emp) => {
      const orders = emp.getProperty("orders") as Entity[];
      const isOk = orders.some(function (order) {
        const cust = order.getProperty("customer");
        return cust && cust.getProperty("companyName").indexOf("Lazy") >= 0;
      });
      expect(isOk).toBe(true); //, "should be some order with the right company name");
    });
    const emps2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(emps, emps2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  test("any with composite predicate and expand", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p = Predicate.create("freight", ">", 950).and("shipCountry", "startsWith", "G");
    const query = EntityQuery.from("Employees")
      .where("orders", "any", p)
      .expand("orders");

    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBe(1);
    emps.forEach((emp) => {
      const orders = emp.getProperty("orders") as Entity[];
      const isOk = orders.some((order) => {
        return order.getProperty("freight") > 950 && order.getProperty("shipCountry").indexOf("G") === 0;
      });
      expect(isOk).toBe(true); //, "should be some order with freight > 950");
    });
    const emps2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(emps, emps2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  test("two anys and an expand", async function () {
    expect.hasAssertions();
    // different query than one above.
    const em = TestFns.newEntityManager();
    const p = Predicate.create("orders", "any", "freight", ">", 950)
      .and("orders", "any", "shipCountry", "startsWith", "G");
    const query = EntityQuery.from("Employees")
      .where(p)
      .expand("orders");
    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBeGreaterThan(0);
    emps.forEach((emp) => {
      const orders = emp.getProperty("orders") as Entity[];
      let isOk = orders.some(order => order.getProperty("freight") > 950);
      expect(isOk).toBe(true); //, "should be some order with freight > 950");
      isOk = orders.some(function (order) {
        return order.getProperty("shipCountry").indexOf("G") === 0;
      });
      expect(isOk).toBe(true); //, "should be some order with shipCountry starting with 'G'");
    });
    const emps2 = em.executeQueryLocally(query);
    const isOk = UtilFns.containSameItems(emps, emps2);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  test("nested any", async function () {
    expect.hasAssertions();
    // different query than one above.
    const em = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Customers")
      .where("orders", "any", "orderDetails", "some", "unitPrice", ">", 200);

    const p2 = new Predicate("unitPrice", ">", 200).and("quantity", ">", 50);
    const q2 = EntityQuery.from("Customers")
      .where("orders", "some", "orderDetails", "any", p2)
      .expand("orders.orderDetails");


    const qr1 = await em.executeQuery(q1);
    const custs = qr1.results;
    expect(custs.length).toBeGreaterThan(10);

    const qr2 = await em.executeQuery(q2);
    const custs2 = qr2.results;
    expect(custs2.length).toBeLessThan(custs.length);

    const custs3 = em.executeQueryLocally(q2);
    const isOk = UtilFns.containSameItems(custs2, custs3);
    expect(isOk).toBe(true); //, "arrays should have the same contents");
  });

  test("nested any predicate toString", function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p2 = new Predicate("unitPrice", ">", 200).and("quantity", ">", 50);
    const p1 = new Predicate("orders", "some", "orderDetails", "any", p2);

    const q2 = EntityQuery.from("Customers")
      .where("orders", "some", "orderDetails", "any", p2)
      .expand("orders.orderDetails");
    const s = q2.wherePredicate.toString();

    expect(s.length).toBeGreaterThan(0);
  });

  test("nested any error", function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p2 = new Predicate("unitPrice", ">", 200).and("XXquantity", ">", 50);
    const q2 = EntityQuery.from("Customers")
      .where("orders", "some", "orderDetails", "any", p2)
      .expand("orders.orderDetails");

    try {
      const queryUrl = q2._toUri(em);
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message.indexOf("XXquantity") >= 0).toBe(true);
    }
  });

});