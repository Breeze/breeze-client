import { breeze, EntityManager, EntityQuery, NamingConvention, Predicate, EntityType, EntityState, EntityKey, Entity, MergeStrategy } from 'breeze-client';
import { skipTestIf, TestFns, expectPass } from './test-fns';

// TODO:
TestFns.initEnv();

beforeAll( async() => {
  await TestFns.initDefaultMetadataStore();
});

describe("EntityQuery", () => {

  beforeEach(function () {

  });
  

  test("should allow simple metadata query", async () => {
    expect.assertions(1);
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    const metadata = await ms.fetchMetadata(TestFns.defaultServiceName);
    expect(metadata).not.toBeNull();
    
  });

  test("should allow simple entity query", async () => {
    expect.assertions(2);
    let em = TestFns.newEntityManager();
    let ms = em.metadataStore;
    
    let query = new EntityQuery("Customers");
    expect(query.resourceName).toEqual("Customers");

    const qr = await em.executeQuery(query);
    expect(qr.results.length).toBeGreaterThan(100);

  });

  test("can handle simple json query syntax ", async() => {
    expect.assertions(1);
    let em = TestFns.newEntityManager();
    const query = EntityQuery.from('Customers').using(em).where({ 'city': { '==': 'London' } });
    const url = query._toUri(em);
    
    const qr = await em.executeQuery(query);
    
    const r = qr.results;
    expect(r.length).toBeGreaterThan(0);
  });

  test("JSON can use 'not' array with 'in' inside 'and'", async() => {
    const countries = ['Belgium', 'Germany'];
    const p2 = {
      and: [
        { companyName: { startswith: 'B' } },
        { not: { country: { in: countries } } }
      ]
    };

    const p = Predicate.create(p2);
    const q = new EntityQuery("Customers").where(p);
    const em = TestFns.newEntityManager();
    const qr = await em.executeQuery(q);
    const r = qr.results;
    expect(r.length).toBe(6);
    r.forEach((cust) => {
      expect(countries.indexOf(cust.country) < 0).toBe(true);
    });
    expect.assertions(7);
  });

  test("can handle parens in right hand side of predicate", async() => {
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers");
    // a valid query that returns no data
    const q2 = query.where('city', 'startsWith', 'Lon (don )');

    const qr = await em.executeQuery(q2);
    expect(qr.results.length).toBe(0);
    expect.assertions(1);
  });

  test("should not throw when add where clause to query with a `.fromEntityType` value", async() => {
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers");
    await TestFns.initDefaultMetadataStore(); // needed because a local query need to have an ms
    // Don't care about the query result.
    // Just want the `fromEntityType` property to set as a side effect or execution
    em.executeQueryLocally(query);
    // now we can repro the bug reported in https://github.com/Breeze/breeze.js/issues/44
    // This next statement throws the "undefined is not a function" exception in 1.5.1
    const q2 = query.where('city', 'eq', 'London');

    const qr = await em.executeQuery(q2);
    expect(qr.results.length).toBeGreaterThan(0);
    expect.assertions(1)  ;
  });

  test("query with 'in' clause", async () =>  {
    expect.assertions(3);
    const em1 = TestFns.newEntityManager();

    const countries = ['Austria', 'Italy', 'Norway']
    const query = EntityQuery.from("Customers")
      .where("country", 'in', countries);

    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
     
    const isOk = r.every((cust) => {
      return countries.indexOf(cust.getProperty("country")) >= 0;
    });
    expect(isOk).toBe(true);

    const r2 = em1.executeQueryLocally(query);
    expect(r2.length).toBe(r.length);
    
  });

  //Using EntityManager em1, query Entity A and it's nav property (R1) Entity B1.
  //Using EntityManager em2, query A and change it's nav property to B2. Save the change.
  //Using EntityManager em1, still holding A and B1, query A, including it's expanded nav property R1.
  //In R1.subscribeChanges, the correct new value of B2 will exist as R1's value but it will have a status of "Detached".
  test("nav prop change and expand", async() => {
    const em1 = TestFns.newEntityManager();
    const em2 = TestFns.newEntityManager();
    const p = Predicate.create("freight", ">", 100).and("customerID", "!=", null);
    const query = new EntityQuery()
      .from("Orders")
      .where(p)
      .orderBy("orderID")
      .expand("customer")
      .take(1);

    let oldCust, newCust1a, newCust1b, order1, order1a, order1b;
    const qr1 = await em1.executeQuery(query);

    order1 = qr1.results[0];
    oldCust = order1.getProperty("customer");
    expect(oldCust).not.toBeNull();
    const qr2 = await em2.executeQuery(EntityQuery.fromEntityKey(order1.entityAspect.getKey()));
    
    order1a = qr2.results[0];
    expect(order1.entityAspect.getKey()).toEqual(order1a.entityAspect.getKey());

    const customerType = em2.metadataStore.getEntityType("Customer") as EntityType;
    newCust1a = customerType.createEntity();
    newCust1a.setProperty("companyName", "Test_compName");
    order1a.setProperty("customer", newCust1a);

    const sr = await em2.saveChanges();

    em1.entityChanged.subscribe((args) => {
      const entity = args.entity;
      expect(entity).not.toBeNull();
      expect(entity.entityAspect.entityState).not.toEqual(EntityState.Detached);
    });

    const qr3 = await em1.executeQuery(query);
    
    order1b = qr3.results[0];
    expect(order1b).toBe(order1);
    newCust1b = order1b.getProperty("customer");
    expect(newCust1a.entityAspect.getKey()).toEqual(newCust1b.entityAspect.getKey());
    expect(newCust1b).not.toBeNull();
    expect(newCust1b.entityAspect.entityState.isUnchanged()).toBe(true);
  });

  test("by entity key without preexisting metadata", async () => {
    expect.assertions(1);
    const manager = new EntityManager(TestFns.defaultServiceName);

    await manager.fetchMetadata();
    const empType = manager.metadataStore.getEntityType("Employee") as EntityType;
    const entityKey = new EntityKey(empType, 1);
    const query = EntityQuery.fromEntityKey(entityKey);
    const qr = await manager.executeQuery(query);
    
    expect(qr.results.length).toBe(1);
  });

  test("same field twice", async() => {
    const em1 = TestFns.newEntityManager();
    const p = Predicate.create("freight", ">", 100).and("freight", "<", 200);
    const query = new EntityQuery()
      .from("Orders")
      .where(p);

    const qr1 = await em1.executeQuery(query);
    const orders = qr1.results;
    expect(orders.length).toBeGreaterThan(0);
    orders.forEach(function (o) {
      const f = o.getProperty("freight");
      expect(f > 100 && f < 200).toBe(true);
    });
    
  });

  test("with bad criteria", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Employees")
      .where("badPropName", "==", "7");
    try {  
      const qr = await em1.executeQuery(query);
      throw new Error('should have thrown an error');
    } catch {
      expect(true).toBe(true);
    }
  });

  test("with bad criteria - 2", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("AltCustomers")
      .where("xxxx", "<", 7);
    try {  
      const qr = await em1.executeQuery(query);
      throw new Error('should have thrown an error');
    } catch {
      expect(true).toBe(true);
    }
  });

  test("expand not working with paging or inlinecount", async() => {
    
    const em1 = TestFns.newEntityManager();
    const predicate = Predicate.create(TestFns.wellKnownData.keyNames.order, "<", 10500);

    const query = new EntityQuery()
      .from("Orders")
      .expand("orderDetails, orderDetails.product")
      .where(predicate)
      .inlineCount()
      .orderBy("orderDate")
      .take(2)
      .skip(1)
      .using(em1);
    const qr1 = await query.execute();

    expect(qr1.results.length).toBeGreaterThan(0);
    expect(qr1.inlineCount).toBeGreaterThan(0);

    // For ODATA this is a known bug: https://aspnetwebstack.codeplex.com/workitem/1037
    // having to do with mixing expand and inlineCount
    // it sounds like it might already be fixed in the next major release but not yet avail.
    const localQuery = EntityQuery.from('OrderDetails');
    const orderDetails = em1.executeQueryLocally(localQuery);
    expect(orderDetails.length).toBeGreaterThan(0);

    const localQuery2 = EntityQuery.from('Products');
    const products = em1.executeQueryLocally(localQuery2);
    expect(products.length).toBeGreaterThan(0);
    
  });

  test("test date in projection", async() => {
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery
      .from("Orders")
      .where("orderDate", "!=", null)
      .orderBy("orderDate")
      .take(3);
    const qr1 = await em1.executeQuery(q1);
    const result = qr1.results[0];
    const orderDate = result.getProperty("orderDate");
    expect(breeze.core.isDate(orderDate)).toBe(true);

    const em2 = TestFns.newEntityManager();
    const q2 = EntityQuery
      .from("Orders")
      .where("orderDate", "!=", null)
      .orderBy("orderDate")
      .take(3)
      .select("orderDate");
    const qr2 = await em2.executeQuery(q2);
    
    const orderDate2 = qr2.results[0].orderDate;
    let orderDate2a;
    if (TestFns.isODataServer) {
      expect(breeze.core.isDate(orderDate2)).toBe(true);
      orderDate2a = orderDate2;
    } else {
      // orderDate projection should not be a date except with ODATA'"
      expect(breeze.core.isDate(orderDate2)).toBe(false);
      // now it will be a date
      orderDate2a = breeze.DataType.parseDateFromServer(orderDate2);
    }
    expect(orderDate.getTime()).toBe(orderDate2a.getTime());
  });

  test("empty predicates", async() => {
    const em1 = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D");
    const predicate2 = Predicate.create("firstName", "startsWith", "A");
    const predicates = Predicate.or([undefined, predicate1, null, predicate2, null]);
    const query = new breeze.EntityQuery()
      .from("Employees")
      .where(predicates);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    qr1.results.forEach( (e) => {
      const firstName = e.getProperty("firstName");
      const lastName = e.getProperty("lastName");
      const ok1 = firstName && firstName.indexOf("A") === 0;
      const ok2 = lastName && lastName.indexOf("D") === 0;
      expect(ok1 || ok2).toBe(true);
    });
  });

  test("empty predicates 2", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const predicates = Predicate.and([]);
    const query = EntityQuery
      .from("Employees")
      .where(predicates);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(6);
  });

  test("empty predicates 3", async() => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D").or("firstName", "startsWith", "A");
    const predicates = Predicate.and([null, undefined, predicate1]);
    const query = EntityQuery
      .from("Employees")
      .where(predicates);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    
    const empId = qr1.results[0].getProperty(TestFns.wellKnownData.keyNames.employee);
    if (!TestFns.isMongoServer) {
      expect(empId).toBeLessThan(6);
    } else {
      expectPass();
    }
  });

  test("empty predicates 4", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const predicates = Predicate.and([undefined, null, null]);
    const query = EntityQuery
      .from("Employees")
      .where(predicates);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("empty clauses", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where().orderBy().select().expand().take().skip();

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("empty clauses - 2", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where(null).orderBy(null).select(null).expand(null).take(null).skip(null);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  // TODO: Update for these later
  // skipIfHibFuncExpr.
  //  skipIf("mongo", "does not yet support 'year' function").
  test("function expr - date(year) function", async() => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where("year(hireDate)", ">", 1993);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    const emps2 = em1.executeQueryLocally(query);
    expect(emps2.length).toBe(qr1.results.length);
  });

  // skipIfHibFuncExpr.
  // skipTestIf("mongo", "does not support 'year' odata predicate").
  test("function expr - date(month) function", async() => {
    const em1 = TestFns.newEntityManager();
    const p = Predicate.create("month(hireDate)", ">", 6).and("month(hireDate)", "<", 11);
    const query = EntityQuery
      .from("Employees")
      .where(p);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    const emps2 = em1.executeQueryLocally(query);
    expect(emps2.length).toBe(qr1.results.length);
  });

  test("take(0)", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .take(0);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(0);
  });

  test("take(0) with inlinecount", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .take(0)
      .inlineCount();
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(0);
    expect(qr1.inlineCount).toBeGreaterThan(0);
  });

  test("select with inlinecount", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .select("companyName, region, city")
      .inlineCount();
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(qr1.inlineCount);
  });

  test("select with inlinecount and take", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .select("companyName, region, city")
      .take(5)
      .inlineCount();
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(5);
    expect(qr1.inlineCount).toBeGreaterThan(5);
  });

  test("select with inlinecount and take and orderBy", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .select("companyName, region, city")
      .orderBy("city, region")
      .take(5)
      .inlineCount();
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(5);
    expect(qr1.inlineCount).toBeGreaterThan(5);
    // TODO: test if qr1.results are ordered by city and region
  });

  test("check getEntityByKey", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers");
    const qr1 = await em1.executeQuery(query);
    
    const cust1 = qr1.results[0];
    const key = cust1.getProperty(TestFns.wellKnownData.keyNames.customer);
    const cust2 = em1.getEntityByKey("Customer", key);
    expect(cust1).toBe(cust2);
  });

  test("local cache query for all Suppliers in fax 'Papa'", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = new breeze.EntityQuery("Suppliers");
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    const predicate = breeze.Predicate.create(TestFns.wellKnownData.keyNames.supplier, '==', 0)
      .or('fax', '==', 'Papa');
    const localQuery = breeze.EntityQuery
      .from('Suppliers')
      .where(predicate)
      .toType('Supplier');

    const suppliers = em1.executeQueryLocally(localQuery);
    // Defect #2486 Fails with "Invalid ISO8601 duration 'Papa'"
    expect(suppliers.length).toBe(0);
    
  });

  test("inlineCount when ordering results by simple navigation path", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const pred = new Predicate("shipCity", "startsWith", "A");
    const query = EntityQuery
      .from("Orders")
      .where(pred)
      .orderBy("customerID");
    // .orderBy("customer.companyName")
    const qr1 = await em1.executeQuery(query);
    const totalCount = qr1.results.length;
    expect(totalCount).toBeGreaterThan(3);
    const q2 = query.inlineCount(true).take(3);
    const qr2 = await em1.executeQuery(q2);
    expect(qr2.results.length).toBe(3);
    expect(qr2.inlineCount).toBe(totalCount);
  });

  test("inlineCount when ordering results by nested navigation path", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const pred = new Predicate("shipCity", "startsWith", "A");
    const query = breeze.EntityQuery.from("Orders")
      .where(pred)
      .orderBy("customer.companyName");
    const qr1 = await em1.executeQuery(query);
    const totalCount = qr1.results.length;
    expect(totalCount).toBeGreaterThan(3);
    const q2 = query.inlineCount(true).take(3);
    const qr2 = await em1.executeQuery(q2);
    expect(qr2.results.length).toBe(3);
    expect(qr2.inlineCount).toBe(totalCount);
  });

  test("getAlfred", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").where("companyName", "startsWith", "Alfreds");
    const qr1 = await em1.executeQuery(query);
    const alfred = qr1.results[0];
    const alfredsID = alfred.getProperty(TestFns.wellKnownData.keyNames.customer).toLowerCase();
    expect(alfredsID).toEqual(TestFns.wellKnownData.alfredsID);
  });

  test("URL malformed with bad resource name combined with 'startsWith P'", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    // we intentionally mispelled the resource name to cause the query to fail
    const query = EntityQuery.from("Customer").where("companyName", "startsWith", "P");

    try {
      const qr1 = await em1.executeQuery(query);
      throw new Error('should not get here');
    } catch ( error) {
      if (TestFns.isMongoServer) {
        expect(error.message.indexOf("Unable to locate") >= 0).toBe(true);
      } else if (TestFns.isODataServer) {
        expect(error.message.indexOf("Not Found") >= 0).toBe(true);
      } else if (TestFns.isSequelizeServer) {
        expect(error.message.indexOf("Cannot find an entityType") > 0).toBe(true);
      } else if (TestFns.isHibernateServer) {
        expect(error.message.indexOf("no entityType name registered") > 0).toBe(true);
      } else if (TestFns.isAspCoreServer) {
        expect(error.status === 404).toBe(true);
      } else {
        expect(error.message.indexOf("No HTTP resource was found") >= 0).toBe(true);
      }
    }
  });

  skipTestIf(TestFns.isMongoServer)
  ("with take, orderby and expand", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Products")
      .expand("category")
      .orderBy("category.categoryName desc, productName");
    const qr1 = await em1.executeQuery(q1);
    const topTen = qr1.results.slice(0, 10);
    const q2 = q1.take(10);
    const qr2 = await em1.executeQuery(q2);
    const topTenAgain = qr2.results;
    expect(topTen).toEqual(topTenAgain);
  });

  skipTestIf(TestFns.isMongoServer)
  ("with take, skip, orderby and expand", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Products")
      .expand("category")
      .orderBy("category.categoryName, productName");
    const qr1 = await em1.executeQuery(q1);
    const nextTen = qr1.results.slice(10, 20);
    const q2 = q1.skip(10).take(10);
    const qr2 = await em1.executeQuery(q2);
    const nextTenAgain = qr2.results;
    expect(nextTen).toEqual(nextTenAgain);
  });

  test("with quotes", async() => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Customers")
      .where("companyName", 'contains', "'")
      .using(em1);
    const qr1 = await q1.execute();
    expect(qr1.results.length).toBeGreaterThan(0);
    const r = em1.executeQueryLocally(q1);
    expect(r.length).toBe(qr1.results.length);
  });

  test("with embedded ampersand", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Customers")
      .where('companyName', 'contains', '&')
      .using(em1);
    const qr1 = await q1.execute();
    expect(qr1.results.length).toBeGreaterThan(0);
    const r = em1.executeQueryLocally(q1);
    expect(r.length).toBe(qr1.results.length);
  });

  test("bad query test", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    try {
      const qr1 = await EntityQuery.from("EntityThatDoesnotExist")
        .using(em1)
        .execute();
      throw new Error('should not get here') ;
    } catch (e) {
      if (TestFns.isODataServer) {
        expect(e.message === "Not Found").toBe(true);
      } else if (TestFns.isAspCoreServer) {
        expect(e.status === 404).toBe(true);
      } else {
        expect(e.message && e.message.toLowerCase().indexOf("entitythatdoesnotexist") >= 0).toBe(true);
      }
    }
  });

  skipTestIf(TestFns.isMongoServer)
  ("nested expand", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("OrderDetails").where("orderID", "<", 10255).expand("order.customer");
    const qr1 = await em1.executeQuery(q1);
      
    const details = qr1.results;
    details.forEach( (od) => {
      const order = od.getProperty("order");
      expect(order).not.toBeNull();
      if (order.getProperty("customerID")) {
        const customer = order.getProperty("customer");
        expect(customer).not.toBeNull();
      }
    });

   });

   skipTestIf(TestFns.isMongoServer)
   ("nested expand 3 level", async() => {
    expect.assertions(3);
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Orders").take(5).expand("orderDetails.product.category");
    const qr1 = await em1.executeQuery(q1);
    const orders = qr1.results;
    const orderDetails = orders[0].getProperty("orderDetails");
    expect(orderDetails.length).toBeGreaterThan(0);
    const product = orderDetails[0].getProperty("product");
    expect(product).not.toBeNull();
    const category = product.getProperty("category");
    expect(category).not.toBeNull();
  });

  skipTestIf(TestFns.isMongoServer)
  ("retrievedEntities - nested expand 2 level", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("OrderDetails").take(5).expand("order.customer");
    const qr1 = await em1.executeQuery(q1);
    const entities = qr1.retrievedEntities;
    expect(entities).not.toBeNull();
    expect(entities.length).toBeGreaterThan(5);
    const details = qr1.results;

    const isOk = details.some(function (od) {
      expect(entities.indexOf(od) >= 0).toBe(true);
      const order = od.getProperty("order");
      expect(entities.indexOf(order) >= 0).toBe(true);
      const cust = order.getProperty("customer");
      if (cust) {
        expect(entities.indexOf(cust) >= 0).toBe(true);
        return true;
      } else {
        return false;
      }
    });
    expect(isOk).toBe(true);
  });

  skipTestIf(TestFns.isMongoServer)
  ("retrievedEntities - nested expand 3 level", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Orders").take(5).expand("orderDetails.product.category");
    const qr1 = await em1.executeQuery(q1);
    
    const entities = qr1.retrievedEntities;
    expect(entities).not.toBeNull();
    const orders = qr1.results;
    for (let i = 0, ilen = orders.length; i < ilen; i++) {
      expect(entities.indexOf(orders[i]) >= 0).toBe(true);
      const orderDetails = orders[i].getProperty("orderDetails");
      for (let j = 0, jlen = orderDetails.length; j < jlen; j++) {
        expect(entities.indexOf(orderDetails[j]) >= 0).toBe(true);
        expect(entities.indexOf(orderDetails[j].getProperty("product")) >= 0).toBe(true);
        expect(entities.indexOf(orderDetails[j].getProperty("product").getProperty("category")) >= 0).toBe(true);
      }
    }
    const allEntities = em1.getEntities();
    expect(allEntities.length).toBe(entities.length);
  });
    
  skipTestIf(TestFns.isMongoServer)
  ("size test", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    
    const q1 = EntityQuery.from("Customers").take(5).expand("orders");
    await em1.executeQuery(q1);
    const s1 = TestFns.sizeOf(em1);
    await em1.executeQuery(q1);
    const s2 = TestFns.sizeOf(em1);
    em1.clear();
    const s3 = TestFns.sizeOf(em1);
    const difObj1 = TestFns.sizeOfDif(s2, s3);
    expect(difObj1.dif).not.toBeNull();
    await em1.executeQuery(q1);
    const s4 = TestFns.sizeOf(em1);
    expect(s1.size).toBe(s4.size);

    const em2 = TestFns.newEntityManager();
    await em2.executeQuery(q1);
    const s5 = TestFns.sizeOf(em2);
    const difObj2 = TestFns.sizeOfDif(s1, s5);
    expect(difObj2.dif).toBe(0);
    em2.clear();
    const s6 = TestFns.sizeOf(em2);
    const difObj3 = TestFns.sizeOfDif(s3, s6);
    expect(difObj2.dif).toBe(0);
  });

  skipTestIf(TestFns.isMongoServer)
  ("sizeof config", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("Customers").take(5).expand("orders");
    await em1.executeQuery(q1);
    const s1 = TestFns.sizeOf(breeze.config);
    await em1.executeQuery(q1);
    const s2 = TestFns.sizeOf(breeze.config);
    em1.clear();
    const s3 = TestFns.sizeOf(breeze.config);
    await em1.executeQuery(q1);
    const s4 = TestFns.sizeOf(breeze.config);
    expect(s1.size).toBe(s2.size);
    expect(s1.size).toBe(s3.size);
    expect(s1.size).toBe(s4.size);
    
    const em2 = TestFns.newEntityManager();
    const s5 = TestFns.sizeOf(breeze.config);
    await em2.executeQuery(q1);
    const s6 = TestFns.sizeOf(breeze.config);
    expect(s5.size).toBe(s6.size);
  });

  skipTestIf(TestFns.isMongoServer)
  ("size test property change", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const em2 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").take(5).expand("orders");

    // just to make sure these next calls don't add to mem pressure
    const hasChanges = em1.hasChanges();
    em1.entityChanged.subscribe(function (x) {
      const y = x;
    });
    em2.entityChanged.subscribe(function (x) {
      const y = x;
    });

    await em1.executeQuery(query);
    const s1 = TestFns.sizeOf(em1);
    const qr1 = await em1.executeQuery(query);
    const custs = qr1.results;
    custs.forEach((c) => {
      const rv = c.getProperty("rowVersion");
      c.setProperty("rowVersion", rv + 1);
    });
    em1.rejectChanges();
    const s2 = TestFns.sizeOf(em1);
    let difObj = TestFns.sizeOfDif(s1, s2);
    let sizeDif = Math.abs(difObj.dif);
    // sizedif should be very small
    expect(sizeDif < 20).toBe(true);
    em1.clear();
    const s3 = TestFns.sizeOf(em1);
    difObj = TestFns.sizeOfDif(s2, s3);
    expect(difObj.dif).not.toBeNull();
    await em1.executeQuery(query);
    const s4 = TestFns.sizeOf(em1);
    sizeDif = Math.abs(s1.size - s4.size);
    expect(sizeDif < 20).toBe(true);
    
    await em2.executeQuery(query);
    const s5 = TestFns.sizeOf(em2);
    difObj = TestFns.sizeOfDif(s1, s5);
    sizeDif = Math.abs(difObj.dif);
    expect(sizeDif < 20).toBe(true);
    em2.clear();
    const s6 = TestFns.sizeOf(em2);
    difObj = TestFns.sizeOfDif(s3, s6);
    sizeDif = Math.abs(difObj.dif);
    // empty sizes should be almost equal
    expect(sizeDif < 20).toBe(true);
  });    
  // no expand support in Mongo
  skipTestIf(TestFns.isMongoServer)
  ("detached unresolved children", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const metadataStore = em1.metadataStore;
    const orderType = metadataStore.getEntityType("Order") as EntityType;

    const query = EntityQuery.from("Customers")
      .where("customerID", "==", "729de505-ea6d-4cdf-89f6-0360ad37bde7")
      .expand("orders");
    let newOrder = orderType.createEntity(); // call the factory function for the Customer type
    em1.addEntity(newOrder);
    newOrder.setProperty("customerID", "729de505-ea6d-4cdf-89f6-0360ad37bde7");

    let items = em1.rejectChanges();

    const qr1 = await em1.executeQuery(query);
    let orders = qr1.results[0].getProperty("orders");
    // the bug was that this included the previously detached order above. ( making a length of 11).
    expect(orders.length).toBe(10);

    newOrder = orderType.createEntity(); // call the factory function for the Customer type
    em1.addEntity(newOrder);
    newOrder.setProperty("customerID", "729de505-ea6d-4cdf-89f6-0360ad37bde7");

    items = em1.rejectChanges();
    const qr2 = await em1.executeQuery(query);
    orders = qr2.results[0].getProperty("orders");
    expect(orders.length).toBe(10);
  });

  // no expand support in Mongo
  skipTestIf(TestFns.isMongoServer)
  ("with two nested expands", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("OrderDetails")
      .where("orderID", "==", 11069)
      .expand(["order.customer", "order.employee"]);

    const qr1 = await em1.executeQuery(query);
    const r = qr1.results[0];
    const c = r.getProperty("order").getProperty("customer");
    expect(c).not.toBeNull();
    const e = r.getProperty("order").getProperty("employee");
    expect(e).not.toBeNull();
    
  });

  test("with two fields", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Orders")
      .where("requiredDate", "<", "shippedDate")
      .take(20);

    const qr1 = await em1.executeQuery(q);
    const results = qr1.results;
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      const reqDt = r.getProperty("requiredDate");
      const shipDt = r.getProperty("shippedDate");
      // required dates should be before shipped dates
      expect(reqDt.getTime()).toBeLessThan(shipDt.getTime()); 
    });
  });

  test("with two fields & contains", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
      .where("notes", "contains", "firstName")
      .take(20);
    const qr1 = await em1.executeQuery(q);
    const results = qr1.results;
    expect(results.length).toBeGreaterThan(0);
    results.forEach(function (r) {
      const notes = r.getProperty("notes").toLowerCase();
      const firstNm = r.getProperty("firstName").toLowerCase();
      expect(notes.indexOf(firstNm) >= 0).toBe(true);
    });
  });

  test("with two fields & startsWith literal", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
      .where({ lastName: { "startsWith": "Dav" } })
      .take(20);

    const qr1 = await em1.executeQuery(q);
    const results = qr1.results;
    expect(results.length).toBeGreaterThan(0);
    const isOk = results.every( e => {
      return e.getProperty("lastName").toLowerCase().indexOf("dav") >= 0;
    });
    expect(isOk).toBe(true);
  });

  test("with two fields & startsWith literal forced", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
      .where("lastName", "startsWith", { value: "firstName", isLiteral: true })
      // .where("lastName", "startsWith", "firstName", true)
      .take(20);

    const qr1 = await em1.executeQuery(q);
    const r = qr1.results;
    expect(r.length).toBe(0);
  });

  test("with inlineCount", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Customers")
      .take(20)
      .inlineCount(true);

    const qr1 = await em1.executeQuery(q);
    const r = qr1.results;
    const count = qr1.inlineCount;
    expect(count).toBeGreaterThan(r.length);

  });

  test("without inlineCount", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Customers")
      .take(5);

    const qr1 = await em1.executeQuery(q);
    const r = qr1.results;
    const inlineCount = qr1.inlineCount;
    expect(inlineCount).toBe(null);
  });

  // no expand support in Mongo
  skipTestIf(TestFns.isMongoServer)
  ("with inlineCount 2", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Orders")
      .where("customer.companyName", "startsWith", "C")
      .take(5)
      .inlineCount(true);
    const qr1 = await em1.executeQuery(q);
    const r = qr1.results;
    expect(qr1.inlineCount).toBeGreaterThan(r.length);
  });

  test("fetchEntityByKey", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;

    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    // should have been from database
    expect(fr1.fromCache).toBe(false);
    const fr2 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    
    const alfred2 = fr2.entity;
    expect(alfred2).not.toBeNull();
    expect(alfred).toBe(alfred2);
    // should have been from cache
    expect(fr2.fromCache).toBe(true);
    const fr3 = await em1.fetchEntityByKey(fr2.entityKey);
    const alfred3 = fr3.entity;
    expect(alfred3).toBe(alfred);
    expect(fr3.fromCache).toBe(false);
  });

  test("fetchEntityByKey without metadata", async() => {
    expect.hasAssertions();
    const emX = new breeze.EntityManager(TestFns.defaultServiceName);
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await emX.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
  });

  test("fetchEntityByKey - deleted", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID);
    
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
    alfred.entityAspect.setDeleted();
    const fr2 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    
    const alfred2 = fr2.entity;
    expect(alfred).not.toBeNull();
    expect(fr2.fromCache).toBe(true);
    const fr3 = await em1.fetchEntityByKey(fr2.entityKey, true);
    
    const alfred3 = fr3.entity;
    // alfred3 should not have been found because it was deleted.
    expect(alfred3).toBeUndefined();
    expect(fr3.fromCache).toBe(true);

    em1.setProperties({ queryOptions: em1.queryOptions.using(MergeStrategy.OverwriteChanges) });
    
    const fr4 = await em1.fetchEntityByKey(fr3.entityKey, true);
    const alfred4 = fr4.entity;
    expect(alfred4).toBe(alfred);
    expect(fr4.fromCache).toBe(false);
  });


  test("fetchEntityByKey - cache first not found", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
  });

  test("fetchEntityByKey - missing key", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '885efa04-cbf2-4dd7-a7de-083ee17b6ad7'; // not a valid key
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).toBeUndefined();
    expect(fr1.fromCache).toBe(false);
    expect(fr1.entityKey).not.toBeNull();
  });

  test("fetchEntityByKey - bad args", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    try {
      await em1.fetchEntityByKey("Customer" as any);
      throw new Error('should not get here');
    } catch (e) {
      const foo = e;
      expect(e.message.indexOf("EntityKey") >= 0).toBe(true);
    }
  });

  test("hasChanges after query", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").take(20);
    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBe(20);
    expect(em1.hasChanges()).toBe(false);
  });

  test("hasChanges after query 2", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").where("companyName", "startsWith", "An").take(2);
    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBe(2);
    expect(em1.hasChanges()).toBe(false);
    const entity = r[0];
    const lr = await entity.entityAspect.loadNavigationProperty("orders");
    const orders = lr.results as Entity[];
    const isLoaded = entity.entityAspect.isNavigationPropertyLoaded("orders");
    // navProp should be marked as loaded
    expect(isLoaded).toBe(true);
    // should be some orders - this is a 'test' bug if not
    expect(orders.length).toBeGreaterThan(0);
    const areAllOrders = orders.every( o => o.entityType.shortName === "Order");
    expect(areAllOrders).toBe(true);
    // should not have changes after nav prop load
    expect(em1.hasChanges()).toBe(false);
    const changes = em1.getChanges();
    expect(changes.length).toBe(0);
  });

  // no expand support in Mongo
  skipTestIf(TestFns.isMongoServer)
  ("hasChanges after query 3", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").take(20);
    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBe(20);
    expect(em1.hasChanges()).toBe(false);
    const qr2 = await query.expand("orders").using(em1).execute();
    const r2 = qr2.results;
    expect(r2.length).toBe(20);
    // should not have changes after nav prop load
    expect(em1.hasChanges()).toBe(false); 
    const changes = em1.getChanges();
    expect(changes.length).toBe(0);
  });


});

