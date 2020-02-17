import { Predicate, FilterQueryOp, MetadataStore, EntityType, OrderByClause, DataType, core, EntityQuery, EntityManager, QueryOptions, FetchStrategy } from 'breeze-client';
import { TestFns, skipTestIf } from './test-fns';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store/adapter-model-library-backing-store';


TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});


describe("Query Local", () => {

  beforeEach(function () {
    
  });

  test("local query with added entities", function () {
    const em = TestFns.newEntityManager();
    const newEntity = em.createEntity('Customer');
    const query = EntityQuery.from('Customers');
    // Returns zero results
    const result = em.executeQueryLocally(query);
    expect(result.length).toBe(1);
  });

  test("startsWith empty string", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q0 = EntityQuery.from("Customers").where("companyName", "startsWith", "C");
    const q1 = EntityQuery.from("Customers").where("companyName", "startsWith", "");
    
    const data = await em.executeQuery(q0);
    expect(data.results.length).toBeGreaterThanOrEqual(0);
    
    const qr1 = await em.executeQuery(q1);
    expect(qr1.results.length).toBeGreaterThanOrEqual(0);
    const r2 = em.executeQueryLocally(q1);
    expect(r2.length).toBe(qr1.results.length);
  });

  test("query property inference error", function () {
    const em = TestFns.newEntityManager();
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const q1 = EntityQuery.from("Orders")
        .where(orderKeyName, "==", "20140000");
    const r1 = em.executeQueryLocally(q1);
    expect(r1.length).toBe(0);

    const p1 = new Predicate(orderKeyName, "==", "2140000");
    const q2 = EntityQuery.from("Orders").where(p1);
    const r2 = em.executeQueryLocally(q2);
    expect(r2.length).toBe(0);

    const p2 = new Predicate("employeeID", "ne", orderKeyName);
    const q3 = EntityQuery.from("Orders").where(p1.and(p2));
    const r3 = em.executeQueryLocally(q3);
    expect(r3.length).toBe(0);
  });


  test("empty em", function () {
    const em = new EntityManager();
    const q = EntityQuery.from("Orders")
        .where("shippedDate", "==", null)
        .take(20);
    try {
      const r = em.executeQueryLocally(q);
      throw new Error('should not get here');
    } catch (e) {
      expect(e.message).toMatch(/metadata/);
    }

  });

  test("null dates", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("Orders")
        .where("shippedDate", "==", null)
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  // TODO: Hibernate does not have the tables
  skipTestIf(TestFns.isHibernateServer,
    "timespan", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("TimeLimits")
        .where("maxTime", "<", "PT4H")
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  // TODO: Hibernate does not have the tables
  skipTestIf(TestFns.isHibernateServer,
    "compare timespans", async function () {
    
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("TimeLimits")
        .where("maxTime", "<", "minTime")
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  // TODO: Hibernate does not have the tables
  skipTestIf(TestFns.isHibernateServer,
    "null timespans", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("TimeLimits")
        .where("minTime", "!=", null)
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  test("compare dates", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("Orders")
        .where("requiredDate", "<", "shippedDate")
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  test("local query with two fields & contains", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
        .where("lastName", "startsWith", "firstName")
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  test("local query with two fields & contains literal", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
        .where("lastName", "startsWith", "test")
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  test("local query with two fields & contains literal forced", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
        .where("lastName", "startsWith", { value: "firstName", isLiteral: true })
        .take(20);
    
    const data = await em.executeQuery(q);
    const r = data.results;
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
  });

  test("local query with ordering", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery
        .from("Products")
        .orderBy("discontinuedDate, productName, unitPrice")
        .where("discontinuedDate", "!=", null);
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(query);
    expect(r.length).toBe(r2.length);
    core.arrayZip(r, r2, function (a, b) {
      expect(a).toBe(b);
    });
  });

  test("local query with select", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
        .where("companyName", "startswith", "c");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const q2 = new EntityQuery()
      .from("Customers")
      .where("companyName", "startsWith", "C")
      .select("companyName");
    const r2 = em.executeQueryLocally(q2);
    expect(r.length).toBe(r2.length);
    expect(r2[0].entityAspect).toBeUndefined();
    expect(r2[0].companyName).not.toBeNull();
  });


  test("local query with complex select", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery
        .from("Orders")
        .where("customer.companyName", "startsWith", "C")
        .orderBy("customer.companyName")
        .expand("customer");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const q2 = query.select("customer.companyName, customer, orderDate");
    const r2 = em.executeQueryLocally(q2);
    expect(r.length).toBe(r2.length);
    const rx = r2[0];
    expect(rx.entityAspect).toBeUndefined();
    expect(rx["customer_companyName"]).not.toBeNull();
    expect(rx["customer"].entityAspect).not.toBeNull();
    expect(rx["orderDate"]).not.toBeNull();
  });


  test("local query does not return added entity after rejectChanges", function () {
    const em = TestFns.newEntityManager();

    const typeInfo = em.metadataStore.getAsEntityType("Order");
    const newEntity = typeInfo.createEntity();
    em.addEntity(newEntity);

    newEntity.entityAspect.rejectChanges();
    const entityState = newEntity.entityAspect.entityState;
    expect(entityState.isDetached()).toBe(true);

    // FAILS with "TypeError: Unable to get property 'entityAspect' of undefined or null reference"
    const orders = em.executeQueryLocally(EntityQuery.from("Orders"));
    expect(orders.length).toBe(0);
  });

  test("numeric/string local query ", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const productKeyName = TestFns.wellKnownData.keyNames.product;    

    const data = await EntityQuery.from("Products").take(5).using(em).execute();
    const id = data.results[0].getProperty(productKeyName).toString();
    
    let query = new EntityQuery()
        .from("Products").where(productKeyName, '==', id);
    let r = em.executeQueryLocally(query);
    expect(r.length).toBe(1);

    query = new EntityQuery()
        .from("Products").where(productKeyName, '!=', id);
    r = em.executeQueryLocally(query);
    expect(r.length).toBe(4);  
  });

  test("case sensitivity - startsWith", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
        .where("companyName", "startswith", "c");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(query);
    expect(r.length).toBe(r2.length);
    expect(core.arrayEquals(r, r2)).toBeTrue();
  });

  test("case sensitivity - endsWith", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
        .where("companyName", "endsWith", "OS");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(query);
    expect(r.length).toBe(r2.length);
    expect(core.arrayEquals(r, r2)).toBeTrue();
  });

  test("case sensitivity - contains", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
        .where("companyName", "contains", "SP");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(query);
    expect(r.length).toBe(r2.length);
    expect(core.arrayEquals(r, r2)).toBeTrue();
  });

  test("case sensitivity - order by", async function () {
    expect.hasAssertions();
    
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
        .where("companyName", "startsWith", "F")
        .orderBy("companyName");
    
    const data = await em.executeQuery(query);
    const r = data.results;
    const comps1 = r.map(function (e) {
      return e.getProperty("companyName");
    });
    expect(r.length).toBeGreaterThan(0);
    const r2 = em.executeQueryLocally(query);
    const comps2 = r2.map(function (e) {
      return e.getProperty("companyName");
    });
    expect(r.length).toBe(r2.length);
    expect(core.arrayEquals(r, r2)).toBeTrue();
  });

  test("case sensitivity - order by 2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("companyName", "startsWith", "F");
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("companyName");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("companyName");
    });
    const isSorted = TestFns.isSorted(r2, "companyName", DataType.String, false, false);
    expect(isSorted).toBeTrue();
  });

  test("case sensitivity - order by 3", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("companyName", "startsWith", "F");
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("city");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("city");
    });
    const isSorted = TestFns.isSorted(r2, "city", DataType.String, false, false);
    expect(isSorted).toBeTrue();
  });


  test("case sensitivity - order by desc", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("companyName", "startsWith", "F");
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("companyName desc");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("companyName");
    });
    const isSorted = TestFns.isSorted(r2, "companyName", DataType.String, true, false);
    expect(isSorted).toBeTrue();
  });

  test("case sensitivity - order by multiple props", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("city", "startsWith", "B");
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("city, companyName");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("city");
    });
    
    const isSorted = TestFns.isSorted(r2, "city", DataType.String, false, false);
    expect(isSorted).toBeTrue();
  });

  test("case sensitivity - order by multiple props desc", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("city", "startsWith", "B");
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("city desc, companyName desc");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("city");
    });
    
    const isSorted = TestFns.isSorted(r2, "city", DataType.String, true, false);
    expect(isSorted).toBeTrue();
  });

  test("query for null values", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Customers")
        .where("city", "!=", null);
    
    const data = await em.executeQuery(baseQuery);
    const r = data.results;
    expect(r.length).toBeGreaterThan(0);
    const query = baseQuery.orderBy("city");
    const r2 = em.executeQueryLocally(query);
    const names = r2.map(function (e) {
      return e.getProperty("city");
    });
    
    const isSorted = TestFns.isSorted(r2, "city", DataType.String, false, false);
    expect(isSorted).toBeTrue();
  });


  test("case sensitivity - string padding", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const origCompName = "Simons bistro";
    const q1 = EntityQuery.from("Customers")
        .where("companyName", "startsWith", origCompName);
    const q2 = EntityQuery.from("Customers")
        .where("companyName", "==", origCompName);
    
    let saved = false;
    const data = await em.executeQuery(q1);
    const r = data.results;
    expect(r.length).toBe(1);
    const compNm = r[0].getProperty("companyName");
    const ending = compNm.substr(compNm.length - 2);
    
    if (ending !== "  ") {
      r[0].setProperty("companyName", origCompName + "  ");
      saved = true;
    }
    const sr = await em.saveChanges();
    if (saved) {
      expect(sr.entities.length).toBe(1);
    }
    
    const qr2 = await em.executeQuery(q2);
    const r2 = qr2.results;
    expect(r2.length).toBe(1);
    const r2Local = em.executeQueryLocally(q2);
    expect(r2.length).toBe(r2Local.length);
    expect(core.arrayEquals(r2, r2Local)).toBeTrue();
  });

  test("case sensitivity - string padding 2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const origCompName = "Simons bistro";
    const q = EntityQuery.from("Customers")
        .where("companyName", "!=", origCompName);
    
    const saved = false;
    const data = await em.executeQuery(q);
    const r = data.results;
    expect(r.length).toBeGreaterThanOrEqual(1);
    const r2 = em.executeQueryLocally(q);
    expect(r.length).toBe(r2.length);
    expect(core.arrayEquals(r, r2)).toBeTrue();
  });


  test("executeQueryLocally for related entities after query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = EntityQuery.from("Orders").take(10);
    const qr = await em.executeQuery(query);
    expect(qr.results.length).toBeGreaterThan(0);

    const q2 = EntityQuery.from("Orders").where("customer.companyName", "startsWith", "A");
    const rLocal = em.executeQueryLocally(q2);
    expect(rLocal.length).toBe(0);
    
    const qr2 = await em.executeQuery(q2);
    const r2 = qr2.results;
    expect(r2.length).toBeGreaterThan(0);

  });

  test("query deleted locally", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery().from("Customers").take(5);
    
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(5);
    const custs = em.executeQueryLocally(query);
    expect(custs.length).toBe(5);
    custs[0].entityAspect.setDeleted();
    custs[1].entityAspect.setDeleted();
    // const custs2 = em.executeQueryLocally(query);
    const custs2 = query.using(em).executeLocally();
    expect(custs2.length).toBe(3);
  });

  test("query deleted locally with filter", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery().from("Customers")
        .where("companyName", "startsWith", "C");
    
    const data = await em.executeQuery(query);
    const count = data.results.length;
    expect(count).toBeGreaterThan(0);
    const custs = em.executeQueryLocally(query);
    expect(custs.length).toBe(count);
    custs[0].entityAspect.setDeleted();
    custs[1].entityAspect.setDeleted();
    const custs2 = em.executeQueryLocally(query);
    expect(custs2.length).toBe(count - 2);

  });

  test("local query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
        .from("Orders")
        .where("freight", ">", 100);

    const query2 = new EntityQuery()
        .from("Orders")
        .where("freight", ">=", 500);

    
    const data = await em.executeQuery(query); 
    const orders = data.results;
    const ordersL = em.executeQueryLocally(query);
    expect(core.arrayEquals(orders, ordersL)).toBeTrue();
    const orders2 = em.executeQueryLocally(query2);
    expect(orders2.length).toBeGreaterThan(0);
    expect(orders2.length < orders.length);
    expect(orders2.every(function (o) {
      return o.getProperty("freight") >= 500;
    }));
    
  });

  test("local query - fetchStrategy", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = new EntityQuery()
        .from("Orders")
        .where("freight", ">", 100);

    const query2 = new EntityQuery()
        .from("Orders")
        .where("freight", ">=", 500);

    
    
    const data = await em.executeQuery(query);
    const orders = data.results;
    query = query.using(FetchStrategy.FromLocalCache);
    const dataLocal = await em.executeQuery(query);
    const ordersL = dataLocal.results;
    expect(core.arrayEquals(orders, ordersL)).toBeTrue();
    em.queryOptions = new QueryOptions({ fetchStrategy: FetchStrategy.FromLocalCache });
    
    const data2 = await em.executeQuery(query2);
    const orders2 = data2.results;
    expect(orders2.length).toBeGreaterThan(0);
    expect(orders2.length).toBeLessThan(orders.length);
    expect(orders2.every(function (o) {
      return o.getProperty("freight") >= 500;
    }));
  });

  test("local query - ExecuteLocally", async function () {
    expect.hasAssertions();
    // combined remote & local query gets all customers w/ 'A'
    const query = getQueryForCustomerA();

    // new 'A' customer in cache ... not saved
    const em = TestFns.newEntityManager();
    const newCustomer = addCustomer(em, "Acme");

     // back from server with combined results
    const data = await executeComboQueryWithExecuteLocally(em, query);
    const customers = data.results;
    expect(customers).toContain(newCustomer);
    
  });

  test("local query - FetchStrategy.FromLocalCache", async function () {
    expect.hasAssertions();
    // "combined remote & local query gets all customers w/ 'A'
    const query = getQueryForCustomerA();

    // new 'A' customer in cache ... not saved
    const em = TestFns.newEntityManager();
    const newCustomer = addCustomer(em, "Acme");

     // back from server with combined results
    const data = await executeComboQueryWithFetchStrategy(em, query);
    const customers = data.results;
    expect(customers).toContain(newCustomer);
  });

  async function executeComboQueryWithExecuteLocally(em: EntityManager, query: EntityQuery) {
    query = query.using(em);
    await query.execute();
    const results = query.executeLocally();
    return { results: results };
  }

  async function executeComboQueryWithFetchStrategy(em: EntityManager, query: EntityQuery) {
    query = query.using(em);
    await query.execute();
    return query.using(FetchStrategy.FromLocalCache).execute();
  }

  function getQueryForCustomerA() {
    return new EntityQuery("Customers")
        .where("companyName", "startsWith", "A")
        .orderBy("companyName");
  }

  function addCustomer(em: EntityManager, name: string) {
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const cust = customerType.createEntity();
    cust.setProperty("companyName", name || "a-new-company");
    em.addEntity(cust);
    return cust;
  }


});