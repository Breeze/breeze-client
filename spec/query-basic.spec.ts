import { breeze, EntityManager, EntityQuery, NamingConvention, Predicate, EntityType, EntityState, EntityKey, Entity, MergeStrategy, RelationArray, core, QueryOptions, FetchStrategy, FilterQueryOp } from 'breeze-client';
import { skipTestIf, TestFns, expectPass } from './test-fns';

TestFns.initServerEnv();

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes');
}

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();
});

describe("EntityQuery Basics", () => {

  beforeEach(function () {

  });


  test("simplest entity query", async () => {
    expect.assertions(2);
    let em = TestFns.newEntityManager();
    let ms = em.metadataStore;

    let query = new EntityQuery("Customers");
    expect(query.resourceName).toEqual("Customers");

    const qr = await em.executeQuery(query);
    expect(qr.results.length).toBeGreaterThan(100);

  });

  test("where with JSON syntax ", async () => {
    expect.assertions(1);
    let em = TestFns.newEntityManager();
    const query = EntityQuery.from('Customers').using(em).where({ 'city': { '==': 'London' } });
    const url = query._toUri(em);

    const qr = await em.executeQuery(query);

    const r = qr.results;
    expect(r.length).toBeGreaterThan(0);
  });

  test("where with JSON with 'not' array with 'in' inside 'and'", async () => {
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

  test("where with parens in right hand side of predicate", async () => {
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers");
    // a valid query that returns no data
    const q2 = query.where('city', 'startsWith', 'Lon (don )');

    const qr = await em.executeQuery(q2);
    expect(qr.results.length).toBe(0);
    expect.assertions(1);
  });


  test("where with 'in' clause", async () => {
    expect.assertions(3);
    const em1 = TestFns.newEntityManager();

    const countries = ['Austria', 'Italy', 'Norway'];
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

  test("where with same field twice", async () => {
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

  test("where nested property", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Products")
      .where("category.categoryName", "startswith", "S")
      .expand("category");
    const queryUrl = query._toUri(em);
    const qr1 = await em.executeQuery(query);
    const products = qr1.results;
    const cats = products.map(product => product.getProperty("category"));
    cats.forEach(function (cat) {
      const catName = cat.getProperty("categoryName");
      expect(core.stringStartsWith(catName, "S")).toBe(true);
    });
  });


  test("where nested property 2", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Orders")
      .where("customer.region", "==", "CA");

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    // some customers should have been found
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("where with startsWith op", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Customers")
      .where("companyName", "startsWith", "C")
      .orderBy("companyName");
    const queryUrl = query._toUri(em1);

    const qr1 = await em1.executeQuery(query);
    const customers = qr1.results;
    // const xxx = TestFns.containSameItems(customers, customers);
    const isSorted = TestFns.isSorted(customers, "companyName", breeze.DataType.String, false, em1.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBe(true);
    customers.forEach(c => {
      expect(c.getProperty("companyName")).not.toBeNull();
      const key = c.entityAspect.getKey();
      expect(key).not.toBeNull();
      const c2 = em1.findEntityByKey(key);
      expect(c2).toBe(c);
    });
  });

  test("where with greater than op", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Orders")
      .where("freight", ">", 100);
    const queryUrl = query._toUri(em1);
    const qr1 = await em1.executeQuery(query);
    const orders = qr1.results;
    expect(orders.length).toBeGreaterThan(0);
  });

  test("where with predicate", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const baseQuery = EntityQuery.from("Orders");
    const pred1 = new Predicate("freight", ">", 100);
    const pred2 = new Predicate("orderDate", ">", new Date(1998, 3, 1));
    const query = baseQuery.where(pred1.and(pred2));
    const queryUrl = query._toUri(em);

    const qr1 = await em.executeQuery(query);
    const orders = qr1.results;
    expect(orders.length).toBeGreaterThan(0);
  });

  test("where with predicate with contains", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p1 = Predicate.create("companyName", "startsWith", "S");
    const p2 = Predicate.create("city", "contains", "er");
    const whereClause = p1.and(p2);
    const query = new EntityQuery()
      .from("Customers")
      .where(whereClause);
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("where with with contains", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers")
      .where("companyName", FilterQueryOp.Contains, 'market');
    //.where("CompanyName", "contains", 'market'); // Alternative to FilterQueryOp
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });


  test("where with predicate 2", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const baseQuery = EntityQuery.from("Orders");
    const pred1 = Predicate.create("freight", ">", 100);
    const pred2 = Predicate.create("orderDate", ">", new Date(1998, 3, 1));
    const newPred = Predicate.and([pred1, pred2]);
    const query = baseQuery.where(newPred);
    const queryUrl = query._toUri(em);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("where with predicate 3", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const baseQuery = EntityQuery.from("Orders");
    const pred = Predicate.create("freight", ">", 100)
      .and("orderDate", ">", new Date(1998, 3, 1));
    const query = baseQuery.where(pred);
    const queryUrl = query._toUri(em);
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });


  test("where with not predicate with null", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let pred = new Predicate("region", FilterQueryOp.Equals, null);
    pred = pred.not();
    const query = new EntityQuery()
      .from("Customers")
      .where(pred)
      .take(10);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    expect(customers.length).toBeGreaterThan(0);
    customers.forEach((customer) => {
      const region = customer.getProperty("region");
      expect(region != null).toBe(true);
    });
  });

  test("where with quotes", async () => {
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

  test("where with embedded ampersand", async () => {
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

  test("where with two fields", async () => {
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

  test("where with two fields & contains", async () => {
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

  test("where with two fields & startsWith literal", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = EntityQuery.from("Employees")
      .where({ lastName: { "startsWith": "Dav" } })
      .take(20);

    const qr1 = await em1.executeQuery(q);
    const results = qr1.results;
    expect(results.length).toBeGreaterThan(0);
    const isOk = results.every(e => {
      return e.getProperty("lastName").toLowerCase().indexOf("dav") >= 0;
    });
    expect(isOk).toBe(true);
  });

  test("where with two fields & startsWith literal forced", async () => {
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


  test("where with empty predicates", async () => {
    const em1 = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D");
    const predicate2 = Predicate.create("firstName", "startsWith", "A");
    const predicates = Predicate.or([undefined, predicate1, null, predicate2, null]);
    const query = new breeze.EntityQuery()
      .from("Employees")
      .where(predicates);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    qr1.results.forEach((e) => {
      const firstName = e.getProperty("firstName");
      const lastName = e.getProperty("lastName");
      const ok1 = firstName && firstName.indexOf("A") === 0;
      const ok2 = lastName && lastName.indexOf("D") === 0;
      expect(ok1 || ok2).toBe(true);
    });
  });

  test("where with empty predicates 2", async () => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const predicates = Predicate.and([]);
    const query = EntityQuery
      .from("Employees")
      .where(predicates);

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(6);
  });

  test("where with empty predicates 3", async () => {
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

  test("where with empty predicates 4", async () => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const predicates = Predicate.and([undefined, null, null]);
    const query = EntityQuery
      .from("Employees")
      .where(predicates);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("where with numeric/string  query ", async () => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const prodKeyNm = TestFns.wellKnownData.keyNames.product;

    const qr1 = await EntityQuery.from("Products").take(5).using(em1).execute();
    const id = qr1.results[0].getProperty(prodKeyNm).toString();

    const q2 = new breeze.EntityQuery()
      .from("Products").where(prodKeyNm, '==', id).take(5);
    const qr2 = await q2.using(em1).execute();
    expect(qr2.results.length).toBe(1);
    const q3 = new breeze.EntityQuery()
      .from("Products").where(prodKeyNm, '!=', id);
    const qr3 = await q3.using(em1).execute();
    expect(qr3.results.length).toBeGreaterThan(1);
  });


  test("select with a date field", async () => {
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


  test("select with inlinecount", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .select("companyName, region, city")
      .inlineCount();
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(qr1.inlineCount);
  });

  test("select with inlinecount and take", async () => {
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

  test("select with inlinecount and take and orderBy", async () => {
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

  test("inlineCount", async () => {
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

  test("inlineCount (without)", async () => {
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
  test("inlineCount 2", async () => {
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


  test("inlineCount when ordering results by simple navigation path", async () => {
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

  test("inlineCount when ordering results by nested navigation path", async () => {
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


  test("expand", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    let query = new EntityQuery().from("Products").where("categoryID", "!=", null);
    query = query.expand("category").take(5);
    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const products = qr1.results;
    expect(products.length).toBe(5);
    let cats: any[] = [];
    products.map(function (product) {
      const cat = product.getProperty("category");
      if (cat) {
        cats.push(cats);
      }
    });
    expect(cats.length).toBe(5);
  });


  test("expand multiple", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    let query = new EntityQuery("Orders").where("customerID", "!=", null).where("employeeID", "!=", null);
    query = query.expand(["customer", "employee"]).take(20);

    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const orders = qr1.results;
    const custs = [];
    const emps = [];
    orders.map(function (order) {
      const cust = order.getProperty("customer");
      if (cust) {
        custs.push(cust);
      }
      const emp = order.getProperty("employee");
      if (emp) {
        emps.push(emp);
      }
    });
    expect(custs.length).toBe(20);
    expect(emps.length).toBe(20);
  });

  test("expand multiple nested", async () => {
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

  test("expand nested", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = new EntityQuery()
      .from("Orders");

    query = query.expand("customer, orderDetails, orderDetails.product")
      .take(5);

    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const orders = qr1.results;
    const custs = [];
    let orderDetails: any[] = [];
    const products = [];
    orders.map(function (order) {
      const cust = order.getProperty("customer");
      if (cust) {
        custs.push(cust);
      }
      const orderDetailItems = order.getProperty("orderDetails");
      if (orderDetailItems) {
        Array.prototype.push.apply(orderDetails, orderDetailItems);
        orderDetailItems.map((orderDetail: Entity) => {
          const product = orderDetail.getProperty("product");
          if (product) {
            products.push(product);
          }
        });
      }
    });
    expect(orders.length).toBe(5);
    expect(custs.length).toBeGreaterThan(1);
    expect(orderDetails.length).toBeGreaterThan(5);
    expect(products.length).toBeGreaterThan(5);
  });

  test("expand nested - 2", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q1 = EntityQuery.from("OrderDetails").where("orderID", "<", 10255).expand("order.customer");
    const qr1 = await em1.executeQuery(q1);

    const details = qr1.results;
    details.forEach((od) => {
      const order = od.getProperty("order");
      expect(order).not.toBeNull();
      if (order.getProperty("customerID")) {
        const customer = order.getProperty("customer");
        expect(customer).not.toBeNull();
      }
    });

  });


  test("expand nested 3 level", async () => {
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


  test("expand nested 2 level - retrievedEntities", async () => {
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


  test("expand nested 3 level - retrievedEntities", async () => {
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

  test("expand through null child object", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    let query = new EntityQuery()
      .from("Orders")
      .where("employeeID", "eq", null);
    query = query.expand("employee, employee.manager, employee.directReports")
      .take(5);
    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const orders = qr1.results;
    expect(orders.length).toBeGreaterThan(0);
    orders.map(function (order) {
      const emp = order.getProperty("employee");
      expect(emp == null).toBe(true);
    });

  });

  test("orderBy", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery("Products")
      .orderBy("productName desc")
      .take(5);

    const qr1 = await em.executeQuery(query);
    const products = qr1.results;
    const isSorted = TestFns.isSorted(products, "productName", breeze.DataType.String, true, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBe(true);
  });

  test("orderBy 2 fields", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery("Customers")
      .orderBy("country, city")
      .where("country", "!=", null).where("city", "!=", null)
      .take(30);


    const qr1 = await em.executeQuery(query);
    const custs = qr1.results;
    const countryCities = custs.map(function (p) {
      const countryCity = TestFns.removeAccents(p.getProperty("country") + ":" + p.getProperty("city"));
      p.countryCity = countryCity;
      return countryCity;
    });
    const isSorted = TestFns.isSorted(countryCities, null, breeze.DataType.String, false, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBe(true);
    const q2 = query.orderBy(null);
    const q3 = q2.orderBy("country").orderBy("city");
    const qr2 = await em.executeQuery(q3);
    const custs2 = qr2.results;
    custs2.forEach(function (p) {
      p.countryCity = TestFns.removeAccents(p.getProperty("country") + ":" + p.getProperty("city"));
    });
    const isOk = breeze.core.arrayZip(custs, custs2, function (c1, c2) {
      return c1.countryCity === c2.countryCity;
    }).every(function (v) {
      return v;
    });
    expect(isOk).toBe(true);
  });


  test("orderBy nested", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Products")
      .orderBy("category.categoryName desc")
      .expand("category");
    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const products = qr1.results;
    const cats = products.map(function (product) {
      return product.getProperty("category");
    });
    const isSorted = TestFns.isSorted(cats, "categoryName", breeze.DataType.String, true, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBe(true);
  });


  test("orderBy two part nested", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Products")
      .orderBy(["category.categoryName desc", "productName"])
      .expand("category");
    const qr1 = await em.executeQuery(query);
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    const products = qr1.results;
    const cats = products.map(function (product) {
      return product.getProperty("category");
    });
    const isSorted = TestFns.isSorted(cats, "categoryName", breeze.DataType.String, true, em.metadataStore.localQueryComparisonOptions.isCaseSensitive);
    expect(isSorted).toBe(true);
  });

  test("take(0)", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers")
      .take(0);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBe(0);
  });

  test("take(0) with inlinecount", async () => {
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

  test("take & skip", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("Products")
      .orderBy("productName");

    const skipTakeCount = 5;
    const qr0 = await em.executeQuery(query);
    const products = qr0.results;
    const newq1 = query.skip(skipTakeCount);
    const newq1Url = newq1._toUri(em);
    const p1 = em.executeQuery(newq1).then(function (qr1) {
      const custs1 = qr1.results;
      expect(custs1.length).toBe(products.length - skipTakeCount);
    });
    const newq2 = query.take(skipTakeCount);
    const newq2Url = newq1._toUri(em);
    const p2 = em.executeQuery(newq2).then(function (qr2) {
      const custs2 = qr2.results;
      expect(custs2.length).toBe(skipTakeCount);
    });
    const newq3 = query.skip(skipTakeCount).take(skipTakeCount);
    const newq3Url = newq1._toUri(em);
    const p3 = em.executeQuery(newq3).then(function (qr3) {
      const custs3 = qr3.results;
      expect(custs3.length).toBe(skipTakeCount);
    });
    await Promise.all([p1, p2, p3]);
  });

  test("take, orderby and expand", async () => {
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


  test("take, skip, orderby and expand", async () => {
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

  test("empty clauses", async () => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where().orderBy().select().expand().take().skip();

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("empty clauses - 2", async () => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where(null).orderBy(null).select(null).expand(null).take(null).skip(null);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });


  test("hasChanges after query", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").take(20);
    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBe(20);
    expect(em1.hasChanges()).toBe(false);
  });

  test("hasChanges after query 2", async () => {
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
    const areAllOrders = orders.every(o => o.entityType.shortName === "Order");
    expect(areAllOrders).toBe(true);
    // should not have changes after nav prop load
    expect(em1.hasChanges()).toBe(false);
    const changes = em1.getChanges();
    expect(changes.length).toBe(0);
  });

  test("hasChanges after query 3", async () => {
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

  test("event - arrayChanged notification during query", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
      .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID)
      .using(em1);

    let arrayChangedCount = 0;
    let adds: any[];
    const qr1 = await query.execute();
    const customer = qr1.results[0];
    const orders = customer.getProperty("orders");
    orders.arrayChanged.subscribe((args: any) => {
      arrayChangedCount++;
      adds = args.added;
    });
    // return query.expand("orders").execute();
    // same as above but doesn't need expand
    await customer.entityAspect.loadNavigationProperty("orders");
    // should only see a single arrayChanged event fired
    expect(arrayChangedCount).toBe(1);
    // should have been multiple entities shown as added
    expect(adds && adds.length > 0).toBe(true);
    const orderType = em1.metadataStore.getEntityType("Order") as EntityType;
    const newOrder = orderType.createEntity();
    orders.push(newOrder);
    // should have incremented by 1
    expect(arrayChangedCount).toBe(2);
    // should have only a single entity added here;
    expect(adds && adds.length === 1).toBe(true);
  });

  test("event - relationArray changed notification", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
      .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID)
      .using(em1);

    let arrayChangedCount = 0;
    let adds: any[];

    const qr1 = await query.execute();
    const customer = qr1.results[0];
    // const orders = customer.getProperty("orders") as RelationArray;
    const orders = customer.orders as RelationArray;
    orders.arrayChanged.subscribe(function (args) {
      arrayChangedCount++;
      adds = args.added;
    });
    const lr = await customer.entityAspect.loadNavigationProperty("orders");

    expect(arrayChangedCount).toBe(1);
    expect(adds && adds.length > 0).toBe(true);
    const orderType = em1.metadataStore.getEntityType("Order") as EntityType;
    const newOrder = orderType.createEntity();
    orders.push(newOrder);
    expect(arrayChangedCount).toBe(2);
    expect(adds && adds.length === 1).toBe(true);
  });


  test("event - notification suppressed", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
      .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID)
      .using(em1);
    let arrayChangedCount = 0;
    const qr1 = await query.execute();
    const customer = qr1.results[0];
    const orders = customer.getProperty("orders");
    orders.arrayChanged.subscribe((args: any) => {
      arrayChangedCount++;
    });
    //             Event.enable("arrayChanged", customer.entityAspect, false);
    // Disable array changed 
    breeze.Event.enable("arrayChanged", em1, false);
    await query.expand("orders").execute();

    expect(arrayChangedCount).toBe(0);
    const orderType = em1.metadataStore.getEntityType("Order") as EntityType;
    const newOrder = orderType.createEntity();
    orders.push(newOrder);
    expect(arrayChangedCount).toBe(0);
  });


  


  // TODO: everything below HERE needs to go somewhere else

  test("should allow simple metadata query", async () => {
    expect.hasAssertions();
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    const metadata = await ms.fetchMetadata(TestFns.defaultServiceName);
    expect(metadata).not.toBeNull();

  });

  // skipTestIf(TestFns.isODataServer)
  // ("webApi metadata", function (assert) {
  //     expect.hasAssertions();

  //     const metadataPath = TestFns.defaultServiceName + "/Metadata";
  //     $.getJSON(metadataPath, function (data, status) {
  //       // On success, 'data' contains the model metadata.
  //       //                console.log(data);
  //       ok(data);
  //       var metadata = typeof (data) === "string" ? JSON.parse(data) : data;
  //       var str = JSON.stringify(metadata, undefined, 4);
  //       testFns.output("Metadata");
  //       testFns.output(str);
  //       done();
  //     }).fail(testFns.handleFail);
  //   });


  test("update entityManager on pk change", () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const custType = em1.metadataStore.getEntityType("Customer") as EntityType;
    const customer = custType.createEntity();
    customer.setProperty("companyName", "[don't know name yet]");
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    em1.attachEntity(customer);
    customer.setProperty(TestFns.wellKnownData.keyNames.customer, alfredsID);
    const ek = customer.entityAspect.getKey();
    const sameCustomer = em1.findEntityByKey(ek);
    expect(customer).toBe(sameCustomer);
  });

  test("reject change to existing key", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const custType = em1.metadataStore.getEntityType("Customer") as EntityType;
    const custKeyName = TestFns.wellKnownData.keyNames.customer;
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers").where(custKeyName, "==", alfredsID);

    const qr1 = await query.using(em1).execute();
    expect(qr1.results.length).toBe(1);
    const customer = custType.createEntity();
    em1.attachEntity(customer);
    try {
      customer.setProperty(custKeyName, alfredsID);
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message.indexOf("key") > 0).toBe(true);
    }
  });

  

  test("size test", async () => {
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


  test("sizeof config", async () => {
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


  test("size test property change", async () => {
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



}); // end of describe
