import { breeze, EntityManager, EntityQuery, NamingConvention, Predicate, EntityType, EntityState, EntityKey, Entity } from 'breeze-client';
import { skipIf, TestFns, expectPass } from './test-fns';

const defaultServiceName = 'http://localhost:61552/breeze/NorthwindIBModel';
TestFns.init(defaultServiceName);

const serverEnv = 'webApi';

describe("EntityQuery", () => {

  beforeEach(function () {

  });
  

  test("should allow simple metadata query", async () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    const metadata = await ms.fetchMetadata(defaultServiceName);
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
  // skipIf("mongo", "does not support 'year' odata predicate").
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


});

