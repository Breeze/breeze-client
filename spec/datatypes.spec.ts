import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey, FetchStrategy, EntityState, FilterQueryOp, DataType } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes');
}

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Unusual Datatypes", () => {


  test("byte w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const dt = new Date();
    dt.setUTCMilliseconds(100);
    let c1 = em.createEntity("Comment", { createdOn: dt, seqNum: 11, comment1: "now is the time for" });
    c1 = em.createEntity("Comment", { createdOn: dt, seqNum: '7', comment1: "foo" });

    const sr = await em.saveChanges();
    const comments = sr.entities;
    expect(comments.length).toBe(2);
    const em2 = TestFns.newEntityManager();
    const pred2 = Predicate.create("createdOn", "==", dt).and("seqNum", "==", 11);
    const q2 = EntityQuery.from("Comments").where(pred2);
    const qr2 = await em2.executeQuery(q2);
    const comments2 = qr2.results;
    expect(comments2.length).toBe(1);
    const em3 = TestFns.newEntityManager();
    const pred3 = Predicate.create("createdOn", "==", dt).and("seqNum", "==", '7');
    const q3 = EntityQuery.from("Comments").where(pred3);
    const qr3 = await em3.executeQuery(q3);
    const comments3 = qr3.results;
    expect(comments3.length).toBe(1);
  });

  test("dateTime w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Users").take(1);
    const qr1 = await em.executeQuery(query);
    const user = qr1.results[0];
    const oldDate = user.getProperty("modifiedDate");
    const modDate = new Date(oldDate.getTime() + 10000);
    user.setProperty("modifiedDate", modDate);
    const sr = await em.saveChanges();
    const r = sr.entities;
    expect(r.length).toBe(1);
    const user2 = r[0];
    const q = EntityQuery.fromEntities(user2);
    const em2 = TestFns.newEntityManager();
    const qr2 = await em2.executeQuery(q);
    const user3 = qr2.results[0];
    const modDate3 = user3.getProperty("modifiedDate");
    expect(modDate.getTime()).toBe(modDate3.getTime());
  });

  test("datatype coercion - null strings to empty strings", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const oldParseFn = DataType.String.parse;
    const newParseFn = function (source: any, sourceTypeName: string) {
      if (source == null) {
        return "";
      } else if (sourceTypeName === "string") {
        return source.trim();
      } else {
        return source.toString();
      }
    };
    DataType.String.parse = newParseFn;
    try {
      const aType = em.metadataStore.getAsEntityType("Customer");
      // OrderID, UnitPrice, Discount
      const inst = aType.createEntity();

      inst.setProperty("companyName", null);
      let val = inst.getProperty("companyName");
      expect(val).toBe("");

      inst.setProperty("companyName", undefined);
      val = inst.getProperty("companyName");
      expect(val).toBe("");

      inst.setProperty("companyName", "    now is the time    ");
      val = inst.getProperty("companyName");
      expect(val).toBe("now is the time");
    } finally {
      DataType.String.parse = oldParseFn;
    }
  });




  test("nullable dateTime", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const emp = em.createEntity("Employee", { firstName: "Joe", lastName: "Smith" });
    expect(emp.entityAspect.entityState).toBe(EntityState.Added);
    const birthDate = emp.getProperty("birthDate");
    expect(birthDate).toBeNull;

    const q = EntityQuery.from("Employees").where("birthDate", "==", null);

    const qr1 = await em.executeQuery(q);
    const empsWithNullBirthDates = qr1.results;
    expect(empsWithNullBirthDates.length).toBeGreaterThan(0);
    empsWithNullBirthDates.forEach(function (emp1) {
      const birthDate1 = emp1.getProperty("birthDate");
      expect(birthDate1).toBeNull;
    });
  });

  test("dateTime w/invalid value", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Users").take(1);

    try {
      const data = await em.executeQuery(query);
      const user = data.results[0];
      const oldDate = user.getProperty("modifiedDate");
      user.setProperty("modifiedDate", "whatever");
      const sr = await em.saveChanges();
      throw new Error('should not get here');
    } catch (err) {
      expect(err.message).toEqual("Client side validation errors encountered - see the entityErrors collection on this object for more detail");
    }
  });

  test("dateTimeOffset w/invalid value", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("UnusualDates").take(1);

    try {
      const data = await em.executeQuery(query);
      const ud = data.results[0];
      const oldDate = ud.getProperty("creationDate");
      ud.setProperty("creationDate", "whatever");
      const sr = await em.saveChanges();
      throw new Error('should not get here');
    } catch (err) {
      expect(err.message).toEqual("Client side validation errors encountered - see the entityErrors collection on this object for more detail");
    }
  });

  // sequelize,hibernate,odata", "does not have these datatypes").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer || TestFns.isODataServer,
    "dateTimeOffset & dateTime2 w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("UnusualDates").take(10);
    const tlimitType = em.metadataStore.getEntityType("UnusualDate") as EntityType;
    const crtnDt0 = new Date(2001, 1, 1, 1, 1, 1, 135);
    const modDt0 = new Date(2002, 2, 2, 2, 2, 2, 246);
    const crtnDt2 = new Date(2003, 3, 3, 3, 3, 3, 345);
    const modDt2 = new Date(2004, 4, 4, 4, 4, 4, 456);
    const tlimit = tlimitType.createEntity();
    tlimit.setProperty("creationDate", crtnDt0);
    tlimit.setProperty("modificationDate", modDt0);
    em.addEntity(tlimit);

    const sr0 = await em.saveChanges();
    const sr0Ents = sr0.entities;
    expect(sr0Ents.length).toBe(1);
    const tlimit2 = sr0Ents[0];
    const q = EntityQuery.fromEntities(tlimit2);
    const qr1 = await em.executeQuery(q);
    const r1 = qr1.results;
    const tlimit1 = r1[0];
    const crtnDt1 = tlimit1.getProperty("creationDate");
    const modDt1 = tlimit1.getProperty("modificationDate");
    expect(crtnDt1.getTime()).toBe(crtnDt0.getTime());
    expect(modDt1.getTime()).toBe(modDt0.getTime());
    // change and save again
    tlimit1.setProperty("creationDate", crtnDt2);
    tlimit1.setProperty("modificationDate", modDt2);
    tlimit1.entityAspect.originalValues.creationDate = "2001-02-01T09:01:01.135456+03:15";
    tlimit1.entityAspect.setDeleted();
    const sr1 = await em.saveChanges();
    const sr1Ents = sr1.entities;
    const tlimit3 = sr1Ents[0];
    const crtnDt3 = tlimit3.getProperty("creationDate");
    const modDt3 = tlimit3.getProperty("modificationDate");
    expect(crtnDt3.getTime()).toBe(crtnDt2.getTime());
    expect(modDt3.getTime()).toBe(modDt2.getTime());

  });

  // sequelize,hibernate,odata: "does not have these datatypes").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer || TestFns.isODataServer,
    "where dateTimeOffset & dateTime2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const dt1 = new Date(1950, 1, 1, 1, 1, 1);
    const p1 = Predicate.create("creationDate", ">", dt1).or("modificationDate", ">", dt1);
    const query = EntityQuery.from("UnusualDates").where(p1);
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  // testFns.skipIf("mongo,sequelize,hibernate,odata", "does not have these datatypes").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer || TestFns.isODataServer,
    "export/import dateTimeOffset with nulls", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const p1 = Predicate.create("modificationDate2", "==", null);
    const query = EntityQuery.from("UnusualDates").where(p1).take(2);
    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(2);

    const exportedEntities = em.exportEntities();
    const em2 = TestFns.newEntityManager();
    em2.importEntities(exportedEntities);
    const tls = em2.getEntities("UnusualDate");
    const isOk = tls.every(function (tl) {
      const modDt = tl.getProperty("modificationDate2");
      return modDt == null;
    });
    expect(isOk).toBe(true);
  });

  // testFns.skipIf("mongo,sequelize", "does not have this datatype").
  // skipIf("hibernate","requires the TimeLimits table which has not yet been created").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer,
    "time w/save", async function () {
    expect.hasAssertions();
    const duration = "PT7H17M40S";
    const sDuration = core.durationToSeconds(duration);
    const defaultMs = await TestFns.initDefaultMetadataStore();
    const newMs = MetadataStore.importMetadata(defaultMs.exportMetadata());

    const tlimitType = newMs.getEntityType("TimeLimit") as EntityType;
    core.arrayRemoveItem(tlimitType.dataProperties, dp => dp.dataType === DataType.Undefined);

    const em = TestFns.newEntityManager();
    const query = new EntityQuery("TimeLimits").take(10);
    const qr1 = await em.executeQuery(query);

    const results = qr1.results;
    const maxTime = results[0].getProperty("maxTime");
    expect(maxTime).toBeTruthy();
    const tlimitType1 = em.metadataStore.getEntityType("TimeLimit") as EntityType;
    const tlimit = tlimitType1.createEntity();
    tlimit.setProperty("maxTime", duration);
    em.addEntity(tlimit);
    // check to insure that the default TimeSpan of 0 is used.
    const tlimit2 = tlimitType1.createEntity();
    tlimit2.setProperty("minTime", "PT20H20M20S");
    let zeroTime = tlimit2.getProperty("maxTime");
    em.addEntity(tlimit2);
    const sr = await em.saveChanges();

    const ents = sr.entities;
    expect(ents.length).toBe(2);
    const maxTime1 = tlimit.getProperty("maxTime");
    const sMaxTime = core.durationToSeconds(maxTime1);
    expect(sMaxTime).toBe(sDuration);
    zeroTime = tlimit2.getProperty("maxTime");
    const q2 = EntityQuery.fromEntities([tlimit, tlimit2]).orderBy("minTime");
    const em2 = TestFns.newEntityManager();
    const qr2 = await em2.executeQuery(q2);

    const r2 = qr2.results;
    expect(r2.length).toBe(2);
    const tl1 = r2[0];
    const tl2 = r2[1];
    const maxTime2 = tl1.getProperty("maxTime");
    const sMaxTime2 = core.durationToSeconds(maxTime2);
    expect(sMaxTime2).toBe(sDuration);
    const minTime = tlimit.getProperty("minTime");
    expect(minTime == null).toBe(true);

  });

  // testFns.skipIf("mongo,sequelize", "does not have this datatype").
  // skipIf("hibernate","requires the TimeLimits table which has not yet been created").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer ,
    "time 2", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("TimeLimits").where("maxTime", ">", "PT4H").take(10);
    const fourHrs = core.durationToSeconds("PT4H");

    const qr1 = await em.executeQuery(query);
    const results = qr1.results;
    results.forEach(function (tlimit) {
      const maxTime = tlimit.getProperty("maxTime");
      const maxSecs = core.durationToSeconds(maxTime);
      expect(maxSecs).toBeGreaterThan(fourHrs);
    });
  });

  // testFns.skipIf("mongo,sequelize", "does not have this datatype").
  // skipIf("hibernate","requires the TimeLimits table which has not yet been created").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer ,
    "time not null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("TimeLimits").where("minTime", "!=", null).take(10);
    const qr1 = await em.executeQuery(query);
    const results = qr1.results;
    expect(results.length).toBeGreaterThan(0);
    results.forEach(function (tlimit) {
      const minTime = tlimit.getProperty("minTime");
      expect(minTime).toBeTruthy();
    });
  });

  // testFns.skipIf("mongo,sequelize", "does not have this datatype").
  // skipIf("hibernate","requires the TimeLimits table which has not yet been created").
  test("bad time", function () {

    const em = TestFns.newEntityManager();
    const tlimitType = em.metadataStore.getEntityType("TimeLimit") as EntityType;
    const tlimit = tlimitType.createEntity();
    em.attachEntity(tlimit);

    tlimit.setProperty("maxTime", "3:15");
    let valErrs = tlimit.entityAspect.getValidationErrors();
    expect(valErrs[0].errorMessage.indexOf("maxTime") > 0).toBe(true);

    tlimit.setProperty("maxTime", "PT4M");
    valErrs = tlimit.entityAspect.getValidationErrors();
    expect(valErrs.length).toBe(0);
  });

  // testFns.skipIf("mongo,sequelize,hibernate", "do not update the ts file (varbinary(8)) on the server. This is SQLServer specific").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isHibernateServer,
    "timestamp w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Roles").take(10);


    const data = await em.executeQuery(query);
    const results = data.results;
    const roleType = em.metadataStore.getEntityType("Role") as EntityType;
    const role = roleType.createEntity();
    role.setProperty("name", "test1");
    role.setProperty("description", "descr 1");
    em.addEntity(role);
    const sr = await em.saveChanges();
    const ents = sr.entities;
    expect(ents.length).toBe(1);
    const ts = role.getProperty("ts");
    expect(ts).toBeTruthy();
  });

  // testFns.skipIf("mongo,sequelize,odata", "does not have enum support").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isODataServer,
    "enum query on Role", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from('Roles').using(em);
    const qr1 = await query.execute();
    let roles = qr1.results;
    expect(roles.length).toBeGreaterThan(1);
    const query2 = query.expand("userRoles");
    const qr2 = await query2.execute();
    roles = qr2.results;
    const isOk = roles.some(role => role.getProperty("userRoles").length > 0);
    expect(isOk).toBe(true);
  });

  // testFns.skipIf("mongo,sequelize,odata", "does not have enum support").
  skipTestIf(TestFns.isSequelizeServer  || TestFns.isODataServer,
    "enum query filter on Role", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Roles").where("roleType", "==", 'Restricted');
    const roleType = em.metadataStore.getEntityType("Role");
    const qr1 = await em.executeQuery(query);
    const roles = qr1.results;
    expect(roles.length).toBeGreaterThan(1);
    const isOk = roles.every(r => r.getProperty("roleType") === "Restricted");
    expect(isOk).toBe(true);
  });

  // testFns.skipIf("mongo,sequelize,odata", "does not have enum support").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isODataServer,
    "enums w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Roles").where("roleType", "==", 'Restricted');
    const roleType = em.metadataStore.getEntityType("Role") as EntityType;
    const qr1 = await em.executeQuery(query);

    expect(qr1.results.length).toBeGreaterThan(1);
    let role = roleType.createEntity();
    role.setProperty("name", "test1");
    role.setProperty("description", "descr 1");
    role.setProperty("roleType", 'Standard');
    em.addEntity(role);
    const sr = await em.saveChanges();
    const ents = sr.entities;
    expect(ents.length).toBe(1);
    role = ents[0];
    let rt = role.getProperty("roleType");
    expect(rt).toBe('Standard');
    const q = EntityQuery.fromEntities(ents);
    const em2 = TestFns.newEntityManager();
    const qr2 = await em2.executeQuery(q);
    const r2 = qr2.results;
    expect(r2.length).toBe(1);
    role = r2[0];
    rt = role.getProperty("roleType");
    expect(rt).toBe('Standard');
  });

  // testFns.skipIf("mongo,sequelize,odata", "does not yet support enums").
  skipTestIf(TestFns.isSequelizeServer ||  TestFns.isODataServer,
    "enums null - w/save", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const roleType = em.metadataStore.getEntityType("Role") as EntityType;
    let role = roleType.createEntity();
    role.setProperty("name", "test1");
    role.setProperty("description", "descr 1");
    role.setProperty("roleType", null);
    em.addEntity(role);

    const sr = await em.saveChanges();
    const ents = sr.entities;
    expect(ents.length).toBe(1);
    role = ents[0];
    let rt = role.getProperty("roleType");
    expect(rt == null).toBe(true);

    let q2 = EntityQuery.fromEntities(ents);
    q2 = q2.where("roleType", "==", null);
    const em2 = TestFns.newEntityManager();
    const qr2 = await em2.executeQuery(q2);

    const r2 = qr2.results;
    expect(r2.length).toBe(1);
    role = r2[0];
    rt = role.getProperty("roleType");
    expect(rt == null).toBeTruthy();
  });

  // testFns.skipIf("mongo,sequelize,odata", "does not yet support enums").
  skipTestIf(TestFns.isSequelizeServer || TestFns.isODataServer,
    "enums change value, detect on server", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const roleType = em.metadataStore.getEntityType("Role") as EntityType;
    let role = roleType.createEntity();
    role.setProperty("name", "test2");
    role.setProperty("description", null);
    role.setProperty("roleType", null);
    em.addEntity(role);
    const sr1 = await em.saveChanges();

    const ents = sr1.entities;
    expect(ents.length).toBe(1);
    role = ents[0];
    let rt = role.getProperty("roleType");
    expect(rt == null).toBe(true);
    const desc = role.getProperty("description");
    expect(desc == null).toBe(true);
    role.setProperty("description", "descr 2");
    role.setProperty("roleType", "Standard");
    const sr2 = await em.saveChanges();
    const ents2 = sr2.entities;
    expect(ents2.length).toBe(1);
    role = ents2[0];
    rt = role.getProperty("roleType");
    expect(rt).toBe("Standard");
    role.setProperty("roleType", "Restricted");
    const sr3 = await em.saveChanges();
    const ents3 = sr3.entities;
    expect(ents3.length).toBe(1);
    role = ents3[0];
    rt = role.getProperty("roleType");
    expect(rt).toBe("Restricted");
    role.setProperty("roleType", "Admin");
    const sr4 = await em.saveChanges();
    const ents4 = sr4.entities;
    expect(ents4.length).toBe(1);
    role = ents4[0];
    rt = role.getProperty("roleType");
    expect(rt).toBe("Admin");
  });

  test("nullable int", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers")
      .where("rowVersion", "==", 1)
      .take(10);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("nullable int == null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers")
      .where("rowVersion", "==", null)
      .take(10);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });


  test("nullable date", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Orders")
      .where("orderDate", ">", new Date(1998, 1, 1))
      .take(10);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("nullable date == null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Orders")
      .where("shippedDate", "==", null)
      .take(10);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  // we don't have a nullable book in NorthwindIB
  test("bool", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    // const discPropName = (TestFns.isSequelizeServer) ? "discontinued" : "isDiscontinued";
    const discPropName = "discontinued";
    const query = new EntityQuery("Products")
      .where(discPropName, "==", true)
      .take(10);

    const qr1 = await em.executeQuery(query);
    const products = qr1.results;
    expect(qr1.results.length).toBeGreaterThan(0);
    expect(products.every(p => p.getProperty(discPropName) === true)).toBe(true);
  });

  test("nonnullable bool == null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    // const discPropName = TestFns.isSequelizeServer ? "discontinued" : "isDiscontinued";
    const discPropName = "discontinued";
    const query = new EntityQuery("Products")
      .where(discPropName, "==", null)
      .take(30);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBe(0);
  });

  test("nullable guid", async function () {
    expect.hasAssertions();
    // ID of the Northwind "Alfreds Futterkiste" customer
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Orders")
      .where("customerID", "==", alfredsID);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("nullable guid == null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Orders")
      .where("customerID", "==", null)
      .take(10);

    const qr1 = await em.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
  });

  test("string equals null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Customers")
      .where("region", FilterQueryOp.Equals, null)
      .take(20);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    expect(customers.length).toBeGreaterThan(0);
    customers.forEach(function (customer) {
      const region = customer.getProperty("region");
      expect(region == null).toBe(true);
    });
  });

  test("string not equals null", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    const query = new EntityQuery()
      .from("Customers")
      .where("region", FilterQueryOp.NotEquals, null)
      .take(10);

    const qr1 = await em.executeQuery(query);
    const customers = qr1.results;
    expect(customers.length).toBeGreaterThan(0);
    customers.forEach(function (customer) {
      const region = customer.getProperty("region");
      expect(region != null).toBe(true);
    });
  });

  test("datatype coercion - date", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const userType = em.metadataStore.getAsEntityType("User");

    const user = userType.createEntity();
    const dt = new Date(2000, 2, 15); // 2 => 3 below because date ctor is 0 origin on months.
    user.setProperty("createdDate", "3/15/2000");
    const sameDt = user.getProperty("createdDate");
    expect(dt.getTime()).toBe(sameDt.getTime());
    user.setProperty("modifiedDate", dt.getTime());
    const sameDt2 = user.getProperty("modifiedDate");
    expect(dt.getTime()).toBe(sameDt2.getTime());
  });


  test("datatype coercion - integer", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const odType = em.metadataStore.getAsEntityType("OrderDetail");
    // OrderID, UnitPrice, Discount
    const od = odType.createEntity();

    od.setProperty("orderID", "3.4");
    let val = od.getProperty("orderID");
    expect(val).toBe(3);

    od.setProperty("orderID", 3.4);
    val = od.getProperty("orderID");
    expect(val).toBe(3);
  });


  test("datatype coercion - decimal", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const odType = em.metadataStore.getAsEntityType("OrderDetail");
    // OrderID, UnitPrice, Discount
    const od = odType.createEntity();
    od.setProperty("unitPrice", "3.4");
    let val = od.getProperty("unitPrice");
    expect(val).toBe(3.4);
    od.setProperty("unitPrice", "3");
    val = od.getProperty("unitPrice");
    expect(val).toBe(3);

    od.setProperty("unitPrice", 3.4);
    val = od.getProperty("unitPrice");
    expect(val).toBe(3.4);
  });

  test("datatype coercion - float", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const odType = em.metadataStore.getAsEntityType("OrderDetail");
    // OrderID, UnitPrice, Discount
    const od = odType.createEntity();
    od.setProperty("discount", "3.4");
    let val = od.getProperty("discount");
    expect(val).toBe(3.4);

    od.setProperty("discount", "3");
    val = od.getProperty("discount");
    expect(val).toBe(3);

    od.setProperty("discount", 3.4);
    val = od.getProperty("discount");
    expect(val).toBe(3.4);
  });



});
