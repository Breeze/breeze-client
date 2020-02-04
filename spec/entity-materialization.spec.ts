import { Entity, EntityQuery, EntityType, MetadataStore } from 'breeze-client';
import { TestFns } from './test-fns';

// const metadata = require('./support/NorthwindIBMetadata.json');

TestFns.initServerEnv();

beforeAll(async () => {
  // MetadataStore.importMetadata(metadata);
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Materialization", () => {

  beforeEach(function () {

  });

  function createProductCtor() {
    const init = function (entity: any) {
      expect(entity.entityType.shortName).toBe("Product");
      expect(entity.getProperty("isObsolete")).toBe(false);
      entity.setProperty("isObsolete", true);
    };
    return function () {
      this.isObsolete = false;
      this.init = init;
    };
  }

  test("post create init after materialization", async() => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const Product = createProductCtor();

    const productType = em.metadataStore.getEntityType("Product") as EntityType;
    em.metadataStore.registerEntityTypeCtor("Product", Product, "init");
    const query = EntityQuery.from("Products").take(3);

    const qr1 = await em.executeQuery(query);
    const products = qr1.results;
    products.forEach( (p) => {
      expect(p.getProperty("productName")).not.toBeUndefined();
      expect(p.getProperty("isObsolete")).toBe(true);
    });
  });

  test("post create init using materialized data", async() => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const Customer = function () {
      this.companyName = null;
    };
    const customerInitializer = function (customer: Entity) {
      // should be called after materialization ... but is not.
      const companyName = customer.getProperty("companyName");
      expect(companyName).not.toBeNull();
      customer["foo"] = "Foo " + companyName;
    };
    em.metadataStore.registerEntityTypeCtor("Customer", Customer, customerInitializer);

    
    const query = EntityQuery.from("Customers").top(1);
    const qr1 = await em.executeQuery(query);
    const cust = qr1.results[0];
    // 'foo' property, created in initializer, performed as expected
    expect(cust.foo).toEqual("Foo " + cust.getProperty("companyName"));
  });

  test("post create init with no ctor", async() => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const dt = new Date();

    const empInitializer = function (emp: Entity) {
      emp.setProperty("hireDate", dt);
      emp["foo"] = "Foo " + emp.getProperty("hireDate").toString();
    };
    em.metadataStore.registerEntityTypeCtor("Employee", null, empInitializer);

    const query = EntityQuery.from("Employees").top(1);
    const qr1 = await em.executeQuery(query);
    const emp = qr1.results[0];
    expect(emp.foo).not.toBeNull();
    const sameDt = emp.getProperty("hireDate");
    expect(dt.getTime()).toBe(sameDt.getTime());
  });
});