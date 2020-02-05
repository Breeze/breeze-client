import { Entity, EntityQuery, Predicate, EntityState, MergeStrategy, MetadataStore, EntityType } from 'breeze-client';
import { TestFns } from './test-fns';
import { UtilFns } from './util-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query wih noTracking", () => {

  beforeEach(function () {

  });

  test("self referential type query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D").or("firstName", "startsWith", "A");

    let q = EntityQuery
      .from("Employees")
      .where(predicate1);
    if (TestFns.isHibernateServer || TestFns.isNHibernateServer) {
      q = q.expand("directReports");
    } else if (TestFns.isSequelizeServer) {
      q = q.expand(["manager", "directReports"]);
    } else {
      // q = q.expand("directReports");
    }
    q = q.noTracking();

    const qr1 = await em.executeQuery(q);
    const r = qr1.results;
    expect(r.length > 0);
    let count = 0;
    const umap = {};
    r.forEach(function (emp) {
      checkUniqEmp(umap, emp);
      if (emp.manager) {
        checkUniqEmp(umap, emp.manager);
        count += 1;
      }
      if (emp.directReports && emp.directReports.length > 0) {
        emp.directReports.forEach(function (dr: Entity) {
          checkUniqEmp(umap, dr);
        });
        count += 1;
      }
    });
    expect(count).toBeGreaterThan(1);
    const r2 = em.executeQueryLocally(q);
    expect(r2.length).toBe(0);
  });



  test("query with expand", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const q = EntityQuery
      .from("Orders")
      .where("customer.companyName", "startsWith", "C")
      .expand("customer")
      .noTracking();

    const qr1 = await em.executeQuery(q);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
    let customers: Entity[] = [];
    r.forEach(function (order) {
      if (order.customer) {
        customers.push(order.customer);
      }
    });
    expect(customers.length).toBeGreaterThan(2);
    const uniqCustomers = [... new Set(customers)];
    expect(uniqCustomers.length).toBeLessThan(customers.length);
    const r2 = em.executeQueryLocally(q);
    expect(r2.length).toBe(0);
  });

  // testFns.skipIf("sequelize", "does not yet support complex types").
    test("query with complex type", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();

      const query = new EntityQuery()
        .from("Suppliers")
        .take(3)
        .noTracking();
      const queryUrl = query._toUri(em);

      const qr1 = await em.executeQuery(query);
      const suppliers = qr1.results;
      expect(suppliers.length).toBeGreaterThan( 0);
      suppliers.forEach(function (s: any) {
        expect(s.location).toBeTruthy();
        expect("city" in s.location).toBe(true);
      });
      const r2 = em.executeQueryLocally(query);
      expect(r2.length).toBe(0);
    });

  test("query with reattach", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D").or("firstName", "startsWith", "A");

    const q1 = EntityQuery
      .from("Employees")
      .where(predicate1)
      .noTracking();

    const empType = em.metadataStore.getAsEntityType("Employee");
    
    const qr1 = await em.executeQuery(q1);
    const rawEmps = qr1.results;
    expect(rawEmps.length > 0);
    let emps1 = rawEmps.map(function (rawEmp) {
      const emp = empType.createEntity(rawEmp);
      const empx = em.attachEntity(emp, EntityState.Unchanged, MergeStrategy.SkipMerge);
      return empx;
    });
    expect(emps1.length = rawEmps.length);
    emps1.forEach(function (e1) {
      expect(e1.entityType).toBe(empType);
      expect(e1.entityAspect.entityState).toBe(EntityState.Unchanged);
    });
    const q2 = q1.noTracking(false);
    const emps2 = em.executeQueryLocally(q2);
    expect(emps2.length).toBe(emps1.length);
    emps2.forEach(function (e2) {
      expect(emps1).toContain(e2);
    });
    const qr2 = await em.executeQuery(q2);
    const emps2a = qr2.results;
    emps2a.forEach(function (e2a) {
      expect(emps1).toContain(e2a);
    });

  });


  test("query with reattach - using em.createEntity", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const predicate1 = Predicate.create("lastName", "startsWith", "D").or("firstName", "startsWith", "A");

    const q = EntityQuery
      .from("Employees")
      .where(predicate1)
      .noTracking();

    const empType = em.metadataStore.getAsEntityType("Employee");
    
    const qr1 = await em.executeQuery(q);
    const rawEmps = qr1.results;
    expect(rawEmps.length).toBeGreaterThanOrEqual(0);
    let emps1 = rawEmps.map(function (rawEmp) {
      const emp = em.createEntity(empType, rawEmp, EntityState.Unchanged, MergeStrategy.SkipMerge);
      return emp;
    });
    expect(emps1.length = rawEmps.length);
    emps1.forEach(function (emp) {
      expect(emp.entityType).toBe(empType);
      expect(emp.entityAspect.entityState).toBe(EntityState.Unchanged);
    });
    const q2 = q.noTracking(false);
    const emps2 = em.executeQueryLocally(q2);
    expect(emps2.length).toBe(emps1.length);
    emps2.forEach(function (emp) {
      expect(emps1).toContain(emp);
    });
    const qr2 = await em.executeQuery(q2);
    const emps2a = qr2.results;
    emps2a.forEach(function (emp) {
      expect(emps1).toContain(emp);
    });

  });


  test("query with expand and reattach ", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const predicate1 = Predicate.create("firstName", "startsWith", "A");

    const q = EntityQuery
      .from("Employees")
      .where(predicate1)
      .expand("orders")
      .noTracking();

    const empType = em.metadataStore.getAsEntityType("Employee");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const qr1 = await em.executeQuery(q);
    const rawEmps = qr1.results;
    expect(rawEmps.length).toBeGreaterThanOrEqual(0);
    const emps1 = rawEmps.map(function (rawEmp) {
      const emp = empType.createEntity(rawEmp);
      const empx = em.attachEntity(emp, EntityState.Unchanged, MergeStrategy.SkipMerge);
      return empx;
    });
    expect(emps1.length).toBe(rawEmps.length);
    emps1.forEach(function (emp) {
      expect(emp.entityType).toBe(empType);
      expect(emp.entityAspect.entityState).toBe(EntityState.Unchanged);
      const orders = emp.getProperty("orders");
      expect(orders.length).toBeGreaterThanOrEqual(0);
      orders.forEach(function (o: Entity) {
        expect(o.entityType).toBe(orderType);
        expect(o.entityAspect.entityState).toBe(EntityState.Unchanged);
      });
    });
    const q2 = q.noTracking(false);
    const emps2 = em.executeQueryLocally(q2);
    expect(emps2.length).toBe(emps1.length);
    emps2.forEach(function (emp) {
      expect(emps1).toContain(emp);
    });
    
    const qr2 = await em.executeQuery(q2);
    const emps2a = qr2.results;
    emps2a.forEach(function (emp) {
      expect(emps1).toContain(emp);
    });
  });

  test("query with expand and noTrackingFn ", async function () {
    expect.hasAssertions();
    const ms = await TestFns.initDefaultMetadataStore();
    const em = TestFns.newEntityManager(MetadataStore.importMetadata(ms.exportMetadata()));
    const predicate1 = Predicate.create("firstName", "startsWith", "A");
    const noTrackingFn = function (e: any, entityType: EntityType) {
      return entityType.createEntity(e);
    };
    const q = EntityQuery
      .from("Employees")
      .where(predicate1)
      .expand("orders")
      .noTracking();

    const empType = em.metadataStore.getAsEntityType("Employee");
    em.metadataStore.registerEntityTypeCtor("Employee", null, null, noTrackingFn);
    em.metadataStore.registerEntityTypeCtor("Order", null, null, noTrackingFn);
    const orderType = em.metadataStore.getAsEntityType("Order");
    
    const qr1 = await em.executeQuery(q);
    const rawEmps = qr1.results;
    expect(rawEmps.length > 0);
    let emps = rawEmps.map(function (emp) {
      expect(emp.entityType).toBe(empType);
      expect(emp.entityAspect.entityState).toBe(EntityState.Detached);
      const orders = emp.getProperty("orders");
      expect(orders.length).toBeGreaterThanOrEqual(0);
      orders.forEach(function (o: Entity) {
        expect(o.entityType).toBe(orderType);
        expect(o.entityAspect.entityState).toBe(EntityState.Detached);
      });
      const empx = em.attachEntity(emp, EntityState.Unchanged, MergeStrategy.SkipMerge);
      return empx;
    });
    const q2 = q.noTracking(false);
    const emps2 = em.executeQueryLocally(q2);
    expect(emps2.length).toBe(emps.length);
    emps2.forEach(function (emp) {
      expect(emps).toContain(emp);
    });
    
    const qr2 = await em.executeQuery(q2);
    const emps2a = qr2.results;
    emps2a.forEach(function (emp) {
      expect(emps).toContain(emp);
    });

  });

  function checkUniqEmp(umap: object, emp: Entity) {
    const empId = emp["employeeID"];
    const sameEmp = umap[empId];
    if (sameEmp != null) {
      expect(emp).toBe(sameEmp);
    }
    umap[empId] = emp;
  }

});