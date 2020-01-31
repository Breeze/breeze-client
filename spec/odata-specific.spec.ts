// testFns.skipIf("mongo,sequelize,hibernate,aspcore", "does not support the 'add' OData predicate").
import { breeze, EntityManager, EntityQuery, NamingConvention, Predicate, EntityType, EntityState, EntityKey, Entity } from 'breeze-client';
import { TestFns, expectPass, describeIf } from './test-fns';

TestFns.initServerEnv();

beforeAll( async() => {
  await TestFns.initDefaultMetadataStore();
});

describeIf(TestFns.isODataServer)("OData specific", () => {

  beforeEach(function () {

  });
  
  test("OData predicate - add ", async() => {
    expect.assertions(1);
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Employees")
      .where("EmployeeID add ReportsToEmployeeID gt 3");

    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    try {
      em1.executeQueryLocally(query);
      throw new Error("should not get here");
    } catch (e) {
      expectPass();
    }
  });


  test("raw OData query string", async() => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const qr1 = await em1.executeQuery("Customers?&$top=3");
    const custs = qr1.results;
    expect(custs.length).toBeGreaterThan(0);
    const isOk = custs.every( c => c.entityType.shortName === "Customer");
    expect(isOk).toBe(true);
  });


  test("OData predicate - add combined with regular predicate", async() => {
    expect.assertions(2);
    const em1 = TestFns.newEntityManager();
    const predicate = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3").and("employeeID", "<", 9999);
    const query = EntityQuery
      .from("Employees")
      .where(predicate);
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    try {
      em1.executeQueryLocally(query);
      throw new Error("should not get here");
    } catch (e) {
      expectPass();
    }

  });
});