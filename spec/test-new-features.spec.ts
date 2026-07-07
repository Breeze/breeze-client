import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey, FetchStrategy, EntityState, FilterQueryOp, EntityAspect } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';
import { ObjectBindingOrAssignmentElement } from 'typescript';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Query Max Depth", () => {

  // server has [BreezeQueryFilter(MaxDepth = 3)] on Orders
  test("Select Order depth 3 should work", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("Orders")
      .where("freight", FilterQueryOp.GreaterThan, 500)
      .select("employee.manager.manager.fullName")

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);

  });

  // server has [BreezeQueryFilter(MaxDepth = 3)] on Orders
  test("Select Order depth 4 should error", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("Orders")
      .where("freight", FilterQueryOp.GreaterThan, 500)
      .select("employee.manager.manager.manager.fullName")

    try {
      const qr1 = await em.executeQuery(query);
      throw new Error('should not get here');
    } catch (e) {
      if (TestFns.isAspCoreServer) {
        expect(e.message).toMatch(/MaxDepth/);
      // } else {
      //   expect(e.message).toMatch(/expand/);
      }
    }
  });

  // server has [BreezeQueryFilter(MaxDepth = 3)] on Customers
  test("Expand Customer depth 3 should work", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("Customers")
      .take(10)
      .expand("orders.orderDetails.product");

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);

  });

  // server has [BreezeQueryFilter(MaxDepth = 3)] on Customers
  test("Expand Customer depth 4 should error", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("Customers")
      .take(10)
      .expand("orders.orderDetails.product.category");

    try {
      const qr1 = await em.executeQuery(query);
      throw new Error('should not get here');
    } catch (e) {
      if (TestFns.isAspCoreServer) {
        expect(e.message).toMatch(/MaxDepth/);
      // } else {
      //   expect(e.message).toMatch(/expand/);
      }
    }
  });

});

describe("Query Max Take", () => {

  // server has [BreezeQueryFilter(MaxTake = 5)] on Orders
  test("Should only return MaxTake rows", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let query = EntityQuery.from("OrdersWithMaxTake")
      .where("freight", FilterQueryOp.GreaterThan, 500)

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toEqual(5);

  });
});
