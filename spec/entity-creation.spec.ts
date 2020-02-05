import { Entity, EntityQuery, EntityType, MetadataStore } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Creation", () => {

  beforeEach(function () {

  });

  test("createEntity with custom Customer type", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());
    let Customer = TestFns.getCustomerCtor();
    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    await em.fetchMetadata();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isDetached()).toBe(true);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    expect(cust1.getNameLength()).toBe(7);
  });

  test("custom Customer type with ES5 props and createEntity", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());

    const Customer = TestFns.getCustomerWithES5PropsCtor();
    Customer.prototype.getNameLength = function () {
      return (this.getProperty("companyName") || "").length;
    };

    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    await em.fetchMetadata();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isDetached()).toBe(true);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    const custName = cust1.getProperty("companyName");
    expect(custName).toBe("TESTXXX");
    expect(cust1.getNameLength()).toBe(7);
  });

  test("custom Customer type with new", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());

    // const Customer = testFns.makeEntityCtor(function () {
    //   this.miscData = "asdf";
    //   this.getNameLength = function () {
    //     return (this.getProperty("companyName") || "").length;
    //   };
    // });
    let Customer = TestFns.getCustomerCtor();

    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    await em.fetchMetadata();
    const custType = em.metadataStore.getAsEntityType("Customer");
    // Ugly construction because of typescript.
    const cust1 = new (<any> Customer)();
    // this works because the fetchMetadataStore hooked up the entityType on the registered ctor.
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect).toBe(undefined);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    expect(cust1.getNameLength()).toBe(7);
  });

  test("custom Customer type with new - v2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());
    
    await em.fetchMetadata();

    // register after fetchMetadata
    let Customer = TestFns.getCustomerCtor();
    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    const custType = em.metadataStore.getEntityType("Customer");
    // Ugly construction because of typescript.
    const cust1 = new (<any>Customer)();
    // this works because the fetchMetadataStore hooked up the entityType on the registered ctor.
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect).toBe(undefined);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    expect(cust1.getNameLength()).toBe(7);
  });


  test("custom Customer type with ES5 props and new", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());
    const Customer = TestFns.getCustomerWithES5PropsCtor();
    Customer.prototype.getNameLength = function () {
      return (this.getProperty("companyName") || "").length;
    };

    // register before fetchMetadata
    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    await em.fetchMetadata();
    const custType = em.metadataStore.getEntityType("Customer");
    // Ugly construction because of typescript.
    const cust1 = new (<any>Customer)();
    // this works because the fetchMetadataStore hooked up the entityType on the registered ctor.
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect).toBe(undefined);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    const custName = cust1.getProperty("companyName");
    expect(custName).toBe("TESTXXX");
    expect(cust1.getNameLength()).toBe(7);
  });


  
  test("custom Customer type with ES5 proand and new - v2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(new MetadataStore());
    const Customer = TestFns.getCustomerWithES5PropsCtor();
    Customer.prototype.getNameLength = function () {
      return (this.getProperty("companyName") || "").length;
    };
    
    await em.fetchMetadata();

    // register after fetchMetadata
    em.metadataStore.registerEntityTypeCtor("Customer", Customer);
    const custType = em.metadataStore.getEntityType("Customer");
    // Ugly construction because of typescript.
    const cust1 = new (<any>Customer)();
    
    // this works because the fetchMetadataStore hooked up the entityType on the registered ctor.
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect).toBe(undefined);
    em.attachEntity(cust1);
    expect(cust1.entityType).toBe(custType);
    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.getProperty("miscData")).toBe("asdf");
    cust1.setProperty("companyName", "testxxx");
    const custName = cust1.getProperty("companyName");
    expect(custName).toBe("TESTXXX");
    expect(cust1.getNameLength()).toBe(7);
  });

  test("entity materialization - basic", async() => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const qr1 = await em1.executeQuery(newCustomerQuery());

    const cust = qr1.results[0];
    testEntityState(cust, false);
  });

  test("entity materialization with js ctor", async() => {
    expect.hasAssertions();
    // use a different metadata store for this em - so we don't polute other tests
    const em1 = TestFns.newEntityManager(new MetadataStore());
    let Customer = TestFns.getCustomerCtor();
    em1.metadataStore.registerEntityTypeCtor("Customer", Customer);
    const qr1 = await em1.executeQuery(newCustomerQuery());

    const cust = qr1.results[0];
    expect(cust.getProperty("miscData")).toBe("asdf");
    testEntityState(cust, false);

  });

  test("entity materialization with ES5 ctor", async() => {
    expect.hasAssertions();
    // use a different metadata store for this em - so we don't polute other tests
    const em1 = TestFns.newEntityManager(new MetadataStore());
    const Customer = TestFns.getCustomerWithES5PropsCtor();
    em1.metadataStore.registerEntityTypeCtor("Customer", Customer);
    const qr1 = await em1.executeQuery(newCustomerQuery());
    // use a different metadata store for this em - so we don't polute other tests

    const cust = qr1.results[0];
    expect(cust.getProperty("miscData")).toBe("asdf");
    const custName = cust.getProperty("companyName");
    expect(custName.length).toBeGreaterThan(1);
    expect(custName.toUpperCase()).toBe(custName);
    testEntityState(cust, true);
  });

  

  test("post create init after materialization", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const Product = createProductCtor();

    const productType = em.metadataStore.getEntityType("Product") as EntityType;
    em.metadataStore.registerEntityTypeCtor("Product", Product, "init");
    const query = EntityQuery.from("Products").take(3);

    const qr1 = await em.executeQuery(query);
    const products = qr1.results;
    products.forEach((p) => {
      expect(p.getProperty("productName")).not.toBeUndefined();
      expect(p.getProperty("isObsolete")).toBe(true);
    });
  });

  test("post create init using materialized data", async () => {
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

  test("post create init with no ctor", async () => {
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


  function newCustomerQuery() {
    return new EntityQuery()
      .from("Customers")
      .where("companyName", "startsWith", "C")
      .orderBy("companyName");
  }

  function testEntityState(c: Entity, isES5: boolean) {
    const testVal = isES5 ? "TEST" : "Test";
    const test2Val = isES5 ? "TEST2" : "Test2";
    expect(c.getProperty("companyName")).toBeTruthy();
    expect(c.entityAspect.entityState.isUnchanged()).toBe(true);
    c.setProperty("companyName", "Test");
    expect(c.getProperty("companyName")).toBe(testVal);
    expect(c.entityAspect.entityState.isModified()).toBe(true);
    c.entityAspect.acceptChanges();
    expect(c.entityAspect.entityState.isUnchanged()).toBe(true);
    c.setProperty("companyName", "Test2");
    expect(c.getProperty("companyName")).toBe(test2Val);
    expect(c.entityAspect.entityState.isModified()).toBe(true);
    c.entityAspect.rejectChanges();
    expect(c.getProperty("companyName")).toBe(testVal);
    expect(c.entityAspect.entityState.isUnchanged()).toBe(true);
  }

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


});