import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey, FetchStrategy, EntityState, FilterQueryOp } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query Select clause", () => {

  test("company names of orders with Freight > 500", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("Orders")
      .where("freight", FilterQueryOp.GreaterThan, 500)
      .select("customer.companyName")
      .orderBy("customer.companyName");
    if (TestFns.isODataServer) {
      query = query.expand("customer");
    }

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);

  });

  // testFns.skipIf("sequelize", "does not yet support complex types").
  test("complex type", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("Suppliers")
      .select(TestFns.wellKnownData.keyNames.supplier + ", companyName, location")
      .noTracking();

    const qr1 = await em.executeQuery(query);
    expect(em.metadataStore.isEmpty()).toBe(false);
    expect(qr1.results.length).toBeGreaterThan(0);
    const anons = qr1.results;
    anons.some(function (a) {
      expect(a.companyName).toBeTruthy();
      expect(a.location).toBeTruthy();
      return "city" in a.location;
    });
  });

  // testFns.skipIf("odata,mongo,sequelize", "does not use the WebApi jsonResultsAdapter that this test assumes").
  // skipIf("hibernate", "does not have the 'UnusualDates' table this test assumes").
  test("anon with jra & dateTimes", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const jra = new breeze.JsonResultsAdapter({
      name: "foo",

      visitNode: function (node) {
        if (node.$id) {
          node.CreationDate = breeze.DataType.parseDateFromServer(node.CreationDate);
          const dt = breeze.DataType.parseDateFromServer(node.ModificationDate);
          if (!isNaN(dt.getTime())) {
            node.ModificationDate = dt;
          }
        }
        return null;
      }
    });
    const query = new EntityQuery()
      .from("UnusualDates")
      .where("creationDate", "!=", null)
      .select("creationDate, modificationDate")
      .take(3)
      .using(jra);

    const qr1 = await em.executeQuery(query);
    const anons = qr1.results;
    expect(anons.length).toBe(3);
    anons.forEach(function (a) {
      expect(core.isDate(a.creationDate)).toBe(true);
      expect(core.isDate(a.modificationDate) || a.modificationDate == null).toBe(true);
    });

  });

  test("anon simple", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("Customers")
      .where("companyName", "startsWith", "C")
      .select("companyName");
    const queryUrl = query._toUri(em);

    const qr1 = await em.executeQuery(query);
    expect(em.metadataStore.isEmpty()).toBe(false);
    expect(qr1.results.length).toBeGreaterThan(0);
    const anons = qr1.results;
    anons.forEach(function (a) {
      expect(a.companyName).toBeTruthy();
    });
  });


  // skipIf("hibernate", "cannot project entity collections").
  test("anon collection", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    let query = EntityQuery.from("Customers")
      .where("companyName", "startsWith", "C")
      .select("orders");
    if (TestFns.isODataServer) {
      query = query.expand("orders");
    }

    const qr1 = await em.executeQuery(query);
    expect(em.metadataStore.isEmpty()).toBe(false);
    const orderType = em.metadataStore.getEntityType("Order");
    expect(qr1).toBeTruthy();
    expect(qr1.results.length).toBeGreaterThan(0);
    const anons = qr1.results;
    anons.forEach(function (a) {
      expect(Array.isArray(a.orders)).toBe(true);
      a.orders.forEach((order: Entity) => {
        expect(order.entityType).toBe(orderType);
      });
    });
  });


  //  skipIf("hibernate", "cannot project entity collections").
  test("anon simple, entity collection projection", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = new EntityQuery("Customers")
      .where("companyName", "startsWith", "C")
      .orderBy("companyName")
      // .select(["companyName", "city", "orders"]) // also works
      .select("companyName, city, orders");

    // expand is not needed and will FAIL in this care for ASPCORE.          
    if (!TestFns.isAspCoreServer) {
      query = query.expand("orders");
    }

    const qr1 = await em.executeQuery(query);
    expect(em.metadataStore.isEmpty()).toBe(false);
    const orderType = em.metadataStore.getStructuralType("Order");
    expect(qr1).toBeTruthy();
    expect(qr1.results.length).toBeGreaterThan(0);
    const anons = qr1.results;
    anons.forEach(function (a) {
      expect(Object.keys(a).length).toBe(3);
      expect(a.companyName).toBeTruthy();
      expect(Array.isArray(a.orders)).toBe(true);
      a.orders.forEach((order: Entity) => {
        expect(order.entityType).toBe(orderType);
      });
    });
  });


  test("anon simple, entity scalar projection", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery
      .from("Orders")
      .where("customer.companyName", "startsWith", "C")
      .orderBy("customer.companyName");  // - problem for the OData Web api provider.
    if (TestFns.isODataServer) {
      query = query.select("customer, orderDate");
      query = query.expand("customer");
    } else {
      query = query.select("customer.companyName, customer, orderDate");
    }
    const qr1 = await em.executeQuery(query);
    expect(em.metadataStore.isEmpty()).toBe(false);
    const customerType = em.metadataStore.getEntityType("Customer");
    expect(qr1).toBeTruthy();
    expect(qr1.results.length).toBeGreaterThan(0);
    const anons = qr1.results;
    anons.forEach(function (a) {

      if (TestFns.isODataServer) {
        expect(Object.keys(a).length).toBe(2);
      } else {
        expect(Object.keys(a).length).toBe(3);
        if (TestFns.isAspCoreServer || TestFns.isAspWebApiServer) {
          expect(typeof (a.customer_CompanyName)).toBe('string');
        }
        else if (TestFns.isSequelizeServer) {
          expect(typeof (a["customer.companyName"])).toBe('string');
        } else {
          expect(typeof (a["customer.companyName"])).toBe('string');
        }
      }

      expect(a.customer.entityType).toBe(customerType);
      expect(a.orderDate).not.toBeUndefined();
    });
  });


  test("anon two props", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Products")
      .where("category.categoryName", "startswith", "S")
      .select("productID, productName");

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });


  test("with expand should fail with good msg", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Products")
      .where("category.categoryName", "startswith", "S")
      .expand("category")
      .select(TestFns.wellKnownData.keyNames.product + ", productName");

    try {
      const qr1 = await em.executeQuery(query);
      throw new Error('should not get here');
    } catch (e) {
      if (TestFns.isAspCoreServer) {
        expect(e.message).toMatch(/Include path/);
      } else {
        expect(e.message).toMatch(/expand/);
      }
    }
  });



});