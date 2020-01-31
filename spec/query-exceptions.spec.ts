import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, FilterQueryOp } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes')
}

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query Exceptions", () => {

  beforeEach(function () {

  });

  test("query with bad resourceName", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    try {
      const qr1 = await EntityQuery.from("EntityThatDoesnotExist")
        .using(em1)
        .execute();
      throw new Error('should not get here');
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

  test("where with bad filter operator", function () {
    expect.hasAssertions();
    try {
      const query = new EntityQuery()
        .from("Customers")
        .where("companyName", "startsXWith", "C");
      throw new Error("shouldn't get here");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect(error.message.indexOf("startsXWith") > 0).toBe(true);
    }
  });

  test("where with bad field name", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Customers")
      .where("badCompanyName", "startsWith", "C");
    try {
      await em.executeQuery(query);
      throw new Error("shouldn't get here");
    }
    catch (error) {
      expect(error instanceof Error).toBe(true);
      expect(error.message.indexOf("badCompanyName") > 0).toBe(true);
      error.handled = true;
    }

  });

  test("where with bad orderBy property ", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Customers")
      .where("companyName", FilterQueryOp.StartsWith, "C")
      .orderBy("badCompanyName");
    try {
      await em.executeQuery(query);
      throw new Error("shouldn't get here");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect(error.message.indexOf("badCompanyName") > 0).toBe(true);
      error.handled = true;
    }
  });

  test("where with bad criteria", async () => {
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

  test("where with bad criteria - 2", async () => {
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

  test("fetchEntityByKey with bad args", async () => {
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

  test("query with bad resource name combined with 'startsWith P'", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    // we intentionally mispelled the resource name to cause the query to fail
    const query = EntityQuery.from("Customer").where("companyName", "startsWith", "P");

    try {
      const qr1 = await em1.executeQuery(query);
      throw new Error('should not get here');
    } catch (error) {
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

  test("queryOptions errors", () => {
    expect.assertions(3);
    const qo = new QueryOptions();
    try {
      qo.using(true as any);
      throw new Error("should not get here-not a config");
    } catch (e) {
      expect(true).toBe(true);
    }

    try {
      qo.using({ mergeStrategy: 6 } as any);
      throw new Error("should not get here, bad mergeStrategy");
    } catch (e) {
      expect(true).toBe(true);
    }

    try {
      qo.using({ mergeStrategy: MergeStrategy.OverwriteChanges, foo: "huh" } as any);
      throw new Error("should not get here, unknown property in config");
    } catch (e) {
      expect(true).toBe(true);
    }

  });


});