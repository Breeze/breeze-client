import { breeze, core, Entity, EntityKey, EntityQuery, FilterQueryOp } from 'breeze-client';
import { skipTestIf, TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Queries with named endpoints on the server", function () {

  test("enumerable query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("EnumerableEmployees")
      .take(4);

    const qr1 = await em.executeQuery(query);
    const emps = qr1.results;
    expect(emps.length).toBe(4);
  });

  test("first or default", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("CustomerFirstOrDefault");

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(0);

  });

  test("withParameters using an array", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("SearchEmployees").withParameters({ employeeIds: [1, 4] });

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(2);
  });

  test("withParameters using an object", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("SearchCustomers")
      .withParameters({ CompanyName: "A", ContactNames: ["B", "C"], City: "Los Angeles" });

    const qr1 = await em.executeQuery(query);
    const results = qr1.results;
    expect(qr1.results.length).toBe(3);
  });

  // "aspcore", " endpoint has not yet been implemented"  
  skipTestIf(TestFns.isAspCoreServer,
    "withParameters using a array of objects", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const qbeArray = [
        { CompanyName: "A", ContactNames: ["B", "C"], City: "Los Angeles" },
        { CompanyName: "C", ContactNames: ["D", "E"], City: "San Diego" }
      ];

      const query = EntityQuery.from("SearchCustomers2")
        .withParameters({ qbeList: qbeArray });

      const qr1 = await em.executeQuery(query);
      const results = qr1.results;
      expect(qr1.results.length).toBe(3);

    });


  test("not returning results in same order as in server", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CustomersOrderedStartingWith")
      .skip(2)
      .take(5)
      .inlineCount(true)
      .withParameters({ companyName: "C" });

    const qr1 = await em.executeQuery(query);
    const results = qr1.results;
    const isSorted = TestFns.isSorted(results, "companyName", breeze.DataType.String, false, false);
    expect(isSorted).toBeTrue();

  });


  test("with 0 value parameter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("EmployeesMultipleParams")
      .withParameters({ employeeID: 0, city: "Emeryville" });


    const qr1 = await em.executeQuery(q);
    expect(true).toBe(true);
  });

  test("with null parameter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("EmployeesMultipleParams")
      .withParameters({ employeeID: 1, city: null });

    const qr1 = await em.executeQuery(q);
    expect(true).toBe(true);
  });

  test("with empty string parameter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("EmployeesMultipleParams")
      .withParameters({ employeeID: 1, city: "" });

    const qr1 = await em.executeQuery(q);
    expect(true).toBe(true);
  });

  test("scalar server query ", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getEntityType("Customer");
    const query = EntityQuery.from("CustomerWithScalarResult")
      .using(em);

    const qr1 = await query.execute();
    expect(qr1.results.length).toBe(1);
    expect(qr1.results[0].entityType).toBe(custType);
  });


  test("http 404 error thrown on server ", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("CustomersWithHttpError")
      .using(em);

    try {
      const qr1 = await query.execute();
      throw new Error("should not get here");
    } catch (e) {
      expect(e.status).toBe(404);
    }
  });

  // endpoint has not yet been implemented
  // testFns.skipIf("mongo,sequelize,hibernate", " endpoint has not yet been implemented").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer,
    "with parameter and count", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const q = EntityQuery.from("CustomerCountsByCountry")
        .withParameters({ companyName: "C" });

      const qr1 = await em.executeQuery(q);
      const r = qr1.results;
      expect(r.length).toBeGreaterThan(0);
    });

  test("with parameter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const q = EntityQuery.from("CustomersStartingWith")
      .withParameters({ companyName: "C" });
    const qr1 = await em.executeQuery(q);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
    const allOk = r.every(function (r1) {
      return r1.getProperty("companyName").toUpperCase().substr(0, 1) === "C";
    });
    expect(allOk).toBeTrue();

    const q2 = q.toType("Customer").where("fax", "!=", null);
    const qr2 = await em.executeQuery(q2);
    const r2 = qr2.results;
    expect(r2.length).toBeGreaterThan(0);
    expect(r2.length).toBeLessThan(r.length);

    const qr3 = await em.executeQuery(q2.take(1));
    const r3 = qr3.results;
    expect(r3.length).toBe(1);
    expect(r.indexOf(r3[0]) >= 0).toBeTrue();
  });

  // TODO: need to review this one later
  skipTestIf(true, 
    "with parameter - null", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const q = EntityQuery.from("CustomersStartingWith")
        .withParameters({ companyName: null });

      const qr1 = await em.executeQuery(q);
      const r = qr1.results;
      expect(r.length).toBeGreaterThan(0);
      const q2 = q.where("fax", "!=", null);
      const qr2 = await em.executeQuery(q2);
      const r2 = qr2.results;
      expect(r2.length).toBeGreaterThan(0);
      expect(r2.length).toBeLessThan(r.length);
      const qr3 = await em.executeQuery(q2.take(1));
      const r3 = qr3.results;
      expect(r3.length).toBe(1);
      expect(r.indexOf(r3[0]) >= 0).toBeTrue();
    });

  test("with two parameters (date as string)", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const born = new Date(1960, 1, 1);
    const q = EntityQuery.from("EmployeesFilteredByCountryAndBirthdate")
      .withParameters({ birthDate: "1/1/1960", country: "USA" });

    const data = await em.executeQuery(q);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const allOk = r.every(function (emp) {
      return emp.getProperty("country") === "USA" && emp.getProperty("birthDate") >= born;
    });
    expect(allOk).toBeTrue();
  });

  test("with two parameters (date as date)", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const born = new Date(1960, 1, 1);
    const q = EntityQuery.from("EmployeesFilteredByCountryAndBirthdate")
      .withParameters({ birthDate: born.toISOString(), country: "USA" });


    const qr1 = await em.executeQuery(q);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
    const allOk = r.every(function (emp) {
      return emp.getProperty("country") === "USA" && emp.getProperty("birthDate") >= born;
    });
    expect(allOk).toBeTrue();
  });

  // TODO: we don't yet handle the error coming back from the server correctly
  skipTestIf(TestFns.isAspCoreServer,
    "with bad parameters", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const q = EntityQuery.from("CustomersStartingWith")
        .withParameters({ foo: "C" });

      try {
        await em.executeQuery(q);
        throw new Error("should not get here");
      } catch (e) {
        if (TestFns.isSequelizeServer || TestFns.isHibernateServer) {
          expect(e.message).toMatch(/companyName/);
        } else {
          expect(e.message).toMatch(/foo/);
        }
      }
    });

  test("with extra parameters", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("CustomersStartingWith")
      .withParameters({ companyName: "C", extra: 123123 });

    const qr1 = await em.executeQuery(q);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
    const allOk = r.every(function (r1) {
      return r1.getProperty("companyName").toUpperCase().substr(0, 1) === "C";
    });
    expect(allOk).toBeTrue();
  });

  test("project strings", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CompanyNames")
      .take(5)
      .using(em);

    const data = await query.execute();
    const names = data.results;
    expect(names.length).toBeGreaterThan(0);
    if (TestFns.isSequelizeServer || TestFns.isHibernateServer) {
      const cname = names[0].companyName;
      expect(typeof cname).toBe("string");
    } else {
      expect(typeof names[0]).toBe('string');
    }
  });

  test("project primitive objects", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CompanyNamesAndIds")
      .take(5)
      .using(em);

    const data = await query.execute();
    const results = data.results;
    expect(results.length).toBe(5);
    expect(results[0].companyName).toBeTruthy();
    expect(results[0][TestFns.wellKnownData.keyNames.customer]).toBeTruthy();
  });

  test("project primitive objects as DTO", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CompanyNamesAndIdsAsDTO")
      .take(5)
      .using(em);

    const data = await query.execute();
    const results = data.results;
    expect(results.length).toBe(5);
    expect(results[0].companyName).toBeTruthy();
    expect(results[0][TestFns.wellKnownData.keyNames.customer]).toBeTruthy();
  });

  // This is a .NET only test
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer,
    "project enumerables", async function () {
      expect.hasAssertions();

      const em = TestFns.newEntityManager();
      const query = EntityQuery.from("TypeEnvelopes")
        .take(5)
        .using(em);

      const qr1 = await query.execute();
      const results = qr1.results;
      expect(results.length).toBe(5);
      expect(results[0].name).toBeTruthy();
      expect(results[0].namespace !== undefined);
      expect(results[0].fullName).toBeTruthy();
    });

  // This is a .NET only test
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer,
    "project enumerables with filter", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const query = EntityQuery.from("TypeEnvelopes")
        // .where("name.length",">", 10)   // OData filtering on nested anon props seem to work
        .where("name", "startsWith", "N")
        .using(em);

      const qr1 = await query.execute();
      const results = qr1.results;
      expect(results.length).toBeGreaterThan(0);
      results.forEach(function (r) {
        expect(r.name.substr(0, 1)).toBe("N");
        expect(r.namespace).toBeTruthy();
        expect(r.fullName).toBeTruthy();
      });

    });

  test("project primitive objects with filter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CompanyNamesAndIds")
      .where("companyName", "startsWith", "A")
      .using(em);

    const qr1 = await query.execute();
    const results = qr1.results;
    expect(results.length > 0);
    results.forEach(function (r) {
      expect(r.companyName.substr(0, 1)).toBe("A");
      expect(r[TestFns.wellKnownData.keyNames.customer]).toBeTruthy();
    });
  });

  test("project filtered collection", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("CustomersWithBigOrders")
      .where("Customer.companyName", "startsWith", "A")
      .using(em);

    const qr1 = await query.execute();
    const results = qr1.results;
    expect(results.length > 0);
    results.forEach(function (r) {
      expect(r.customer).toBeTruthy();
      expect(r.customer.entityAspect).toBeTruthy();
      expect(r.bigOrders).toBeTruthy();
    });

  });


  // "hibernate", "cannot 'project' collections of entities"
  skipTestIf(TestFns.isHibernateServer,
    "project objects containing entities", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();

      const query = EntityQuery.from("CompanyInfoAndOrders").take(5)
        .using(em);

      const data = await query.execute();
      const results = data.results;
      expect(results.length).toBe(5);
      expect(results[0].companyName).toBeTruthy();
      expect(results[0].customerID).toBeTruthy();
      expect(results[0].orders.length).toBeGreaterThan(0);
      results[0].orders.forEach(function (o: Entity) {
        const aspect = o.entityAspect;
        expect(aspect).toBeTruthy();
        expect(aspect.entityManager).toBe(em);
        expect(aspect.entityState.isUnchanged()).toBeTrue();
      });
    });


  test("server side simple filter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("CustomersStartingWithA");

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("server side include many with filter - customers and orders", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("CustomersAndOrders")
      .where("companyName", "startsWith", "A")
      .orderBy("companyName")
      .take(4);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    expect(customers.length).toBeGreaterThan(2);
    const isSorted = TestFns.isSorted(customers, "companyName", breeze.DataType.String, false, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBeTrue();
    customers.forEach(function (c) {
      expect(c.getProperty("companyName")).toBeTruthy();
      const orders = c.getProperty("orders");
      expect(orders.length).toBeGreaterThan(0);
      const matchingCust = orders[0].getProperty("customer");
      expect(c).toBe(matchingCust);
      const ckey = c.entityAspect.getKey();
      expect(ckey).toBeTruthy();
      const c2 = em.findEntityByKey(ckey);
      expect(c2).toBe(c);
      const okey = orders[0].entityAspect.getKey();
      const o2 = em.getEntityByKey(okey);
      expect(o2).toBe(orders[0]);
    });
  });


  test("server side include many with take - customers and orders", async function () {
    expect.hasAssertions();
    expect(5);
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("CustomersAndOrders")
      .where("companyName", FilterQueryOp.StartsWith, "C")
      .take(1);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(1);
    const cust = qr1.results[0];
    const custKey = cust.entityAspect.getKey();
    const orders = cust.getProperty("orders");
    const orderKeys = orders.map(function (o: Entity) {
      return o.entityAspect.getKey();
    });
    orderKeys.sort(entityKeyCompare);
    const custQuery = EntityQuery.fromEntities(cust);
    const ordersQuery = EntityQuery.fromEntities(orders);
    const em2 = TestFns.newEntityManager();
    const p1 = em2.executeQuery(custQuery).then(function (data2) {
      expect(data2.results.length).toBe(1);
      const cust2 = data2.results[0];
      const cust2Key = cust2.entityAspect.getKey();
      expect(custKey).toEqual(cust2Key);
    });
    const p2 = em2.executeQuery(ordersQuery).then(function (data3) {
      const orders3 = data3.results;
      expect(orders3.length).toBe(orders.length);
      const order3Keys = orders3.map(function (o) {
        return o.entityAspect.getKey();
      });
      orderKeys.sort(entityKeyCompare);
      expect(core.arrayEquals(orderKeys, order3Keys, EntityKey.equals)).toBeTrue();
    });
    return Promise.all([p1, p2]);
  });

  function entityKeyCompare(ek1: any, ek2: any) {
    const value1 = ek1["_keyInGroup"];
    const value2 = ek2["_keyInGroup"];
    if (value1 === value2) {
      return 0;
    } else if (value1 > value2 || value2 === undefined) {
      return 1;
    } else {
      return -1;
    }
  }

  test("server side include, followed by local query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("CustomersAndOrders")
      .where("companyName", "startsWith", "A")
      .orderBy("companyName")
      .take(4);
    const queryUrl = query._toUri(em);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    expect(customers.length).toBe(4);
    customers.forEach(function (c) {
      expect(c.getProperty("companyName")).toBeTruthy();
      const orders = c.getProperty("orders");
      expect(orders.length).toBeGreaterThan(0);
      const matchingCust = orders[0].getProperty("customer");
      expect(c).toBe(matchingCust);
      const ckey = c.entityAspect.getKey();
      expect(ckey).toBeTruthy();
      const c2 = em.findEntityByKey(ckey);
      expect(c2).toBe(c);
      const okey = orders[0].entityAspect.getKey();
      const o2 = em.findEntityByKey(okey);
      expect(o2).toBe(orders[0]);
    });
  });

  test("select scalar anon with two collection props", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery
      .from("CustomersAndProducts");

    const qr1 = await em.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
  });

  // endpoint is .NET WebApi specific

  test("server returns HttpResponseMessage containing Customers", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("CustomersAsHRM")
      .where("companyName", "startsWith", "A")
      .orderBy("companyName")
      .expand("orders")
      .take(4);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    let len = customers.length;
    expect(len).toBe(4);
    const isSorted = TestFns.isSorted(customers, "companyName", breeze.DataType.String, false, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBeTrue();
    len = (len > 4) ? 4 : len;
    for (let i = 0; i < len; i++) {
      const c = customers[i];
      const companyName = c.getProperty("companyName");
      expect(companyName).toBeTruthy();
      expect(companyName.indexOf('A') === 0).toBeTrue();
      const ckey = c.entityAspect.getKey();
      expect(ckey).toBeTruthy();
      const c2 = em.findEntityByKey(ckey);
      expect(c2).toBe(c);
      const orders = c.getProperty("orders");
      expect(orders.length).toBeGreaterThan(1);
    }
  });

});
