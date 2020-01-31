import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty } from 'breeze-client';
import { TestFns, skipTestIf } from './test-fns';

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes')
}

TestFns.initServerEnv();

// check using well-known data.  Map of employeeId : reportsToEmployeeID
const employeeMap = {
  1: 2,
  3: 2,
  4: 3,
  5: 8,
  6: 2,
  8: 3,
  9: 6,
  10: 6
};


beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query Navigation", () => {

  beforeEach(function () {

  });

  
  test("unidirectional navigation load", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const count = 5;
    const query = EntityQuery.from("OrderDetails").take(count);
    
    const qr1 = await query.using(em).execute();
    const orderDetails = qr1.results;
    expect(orderDetails.length).toBe(count);
    const promises = orderDetails.map(async (od: Entity) => {
      const qr2 = await od.entityAspect.loadNavigationProperty("product");
      const products = qr2.results;
      expect(products.length).toBe(1);
      const product = products[0];
      expect(od.getProperty("product")).toBe(product);
    });
    await Promise.all(promises);
  });

  test("unidirectional navigation query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("OrderDetails")
      .where("product.productID", "==", 1);
    const qr1 = await query.using(em).execute();
    const orderDetails = qr1.results;
    expect(orderDetails.length).toBeGreaterThan(0);
    orderDetails.forEach(function (od) {
      expect(od.getProperty("productID")).toBe(1);
    });
    const q2 = EntityQuery.from("Products")
      .where("productID", "==", 1);
    const qr2 = await em.executeQuery(q2);
    const product = qr2.results[0];
    orderDetails.forEach(function (od) {
      expect(od.getProperty("product")).toBe(product);
    });
  });


  test("unidirectional navigation bad query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Products")
      .where("productID", "==", 1)
      .expand("orderDetails");
    try {
      const qr1 = await query.using(em).execute();
      throw new Error("should not get here");
    } catch (err) {
      if (TestFns.isODataServer) {
        expect(err.message.indexOf("Product") >= 1).toBe(true);
      } else {
        expect(err.message.indexOf("orderDetails") >= 1).toBe(true);
      }
    }
  });


  test("bidirectional navigation of same entity type", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = EntityQuery.from("Employees")
      .where("reportsToEmployeeID", "!=", null);
    const qr1 = await query.using(em).execute();
    const emps = qr1.results;
    // check using well-known data.  Map of employeeId : reportsToEmployeeID
   
    emps.forEach(function (emp) {
      expect(employeeMap[emp.getProperty("employeeID")]).toBe(emp.getProperty("reportsToEmployeeID"));
    });
  });


  test("unidirectional navigation of different type (1-n)", async function () {
    expect.hasAssertions();
    let em = TestFns.newEntityManager();
    const query = EntityQuery.from("Territories").where("regionID", "!=", null);
    const query2 = EntityQuery.from("Regions");
    let isOk;
    await query.using(em).execute();
    const qr2 = await query2.using(em).execute();
    let regions = qr2.results;
    regions.forEach(function (region) {
      const terrs = region.getProperty("territories");
      isOk = terrs.every(function (terr: Entity) {
        return terr.getProperty("regionID") === region.getProperty("regionID");
      });
      expect(isOk).toBe(true);
    });

    em = TestFns.newEntityManager();
    const qr3 = await query2.using(em).execute();
    regions = qr3.results;
    await query.using(em).execute();
    
    regions.forEach(function (region) {
      const regTerrs = region.getProperty("territories");
      isOk = regTerrs.every(function (terr: Entity) {
        return terr.getProperty("regionID") === region.getProperty("regionID");
      });
      expect(isOk).toBe(true);
    });
  });

  
  test("unidirectional navigation of same entity type (1-1)", async function () {
    expect.hasAssertions();
    // create metadata manually so we don't have the bidirectional directReports navigation
    const ms = buildUnidirectionalMetadataStore(true);
    let em = TestFns.newEntityManager(ms);
    ms.addDataService(em.dataService);

    // const query = EntityQuery.from("Employees").where("reportsToEmployeeID", "!=", null).orderBy("employeeID");
    const query = EntityQuery.from("Employees").where("employeeID", "<=", 10).orderBy("reportsToEmployeeID")
      .select("employeeID, firstName, reportsToEmployeeID").toType("Employee");

    const qr1 = await query.using(em).execute();
    const emps1 = qr1.results;
    let empId, reportsToEmpId;
    emps1.forEach(function (emp) {
      empId = emp.getProperty("employeeID");
      reportsToEmpId = emp.getProperty("reportsToEmployeeID");
      // reportsToEmployeeID should match
      // tslint:disable-next-line: triple-equals
      expect(empId && employeeMap[empId] == reportsToEmpId).toBe(true);
      if (reportsToEmpId) {
        // boss should match
        expect(emp.getProperty("boss").getProperty("employeeID")).toBe(reportsToEmpId);
      } 
    });
    const em2 = TestFns.newEntityManager(ms);
    const query2 = EntityQuery.from("Employees").where("employeeID", "<=", 10).orderByDesc("reportsToEmployeeID")
      .select("employeeID, firstName, reportsToEmployeeID").toType("Employee");
    const qr2 = await query2.using(em2).execute();
    const emps2 = qr2.results;
    emps2.forEach(function (emp) {
      empId = emp.getProperty("employeeID");
      reportsToEmpId = emp.getProperty("reportsToEmployeeID");
      // reportsToEmployeeID should match
      // tslint:disable-next-line: triple-equals
      expect(empId && employeeMap[empId] == reportsToEmpId).toBe(true);
      if (reportsToEmpId) {
        // boss should match
        expect(emp.getProperty("boss").getProperty("employeeID")).toBe(reportsToEmpId);
      } 
    });
  });


  test("unidirectional navigation of same entity type (1-n)", async function () {
    expect.hasAssertions();
    // create metadata manually so we don't have the bidirectional directReports navigation
    const ms = buildUnidirectionalMetadataStore(false); // opposite to test above
    let em1 = TestFns.newEntityManager(ms);
    ms.addDataService(em1.dataService);

    // const query = EntityQuery.from("Employees").where("reportsToEmployeeID", "!=", null).orderBy("employeeID");
    const query = EntityQuery.from("Employees").where("employeeID", "<=", 10).orderBy("reportsToEmployeeID")
      .select("employeeID, firstName, reportsToEmployeeID").toType("Employee");

    const qr1 = await query.using(em1).execute();
    const emps = qr1.results;
    let empId, reportsToEmpId;
    emps.forEach(function (emp) {
      empId = emp.getProperty("employeeID");
      reportsToEmpId = emp.getProperty("reportsToEmployeeID");
      // tslint:disable-next-line: triple-equals
      expect(empId && employeeMap[empId] == reportsToEmpId).toBe(true);
      emp.getProperty("directReports").forEach(function (dr: Entity) {
        // boss should match
        expect(dr.getProperty("reportsToEmployeeID")).toBe(emp.getProperty("employeeID"));
      });
    });

    em1 = TestFns.newEntityManager(ms);
    const query2 = EntityQuery.from("Employees").where("employeeID", "<=", 10).orderByDesc("reportsToEmployeeID")
      .select("employeeID, firstName, reportsToEmployeeID").toType("Employee");
    const qr2 = await query2.using(em1).execute();
    const emps2 = qr2.results;
    emps2.forEach(function (emp) {
      const empId = emp.getProperty("employeeID");
      const reportsToEmpId = emp.getProperty("reportsToEmployeeID");
      // tslint:disable-next-line: triple-equals
      expect(empId && employeeMap[empId] == reportsToEmpId).toBe(true);
      emp.getProperty("directReports").forEach(function (dr: Entity) {
        // boss should match
        expect(dr.getProperty("reportsToEmployeeID")).toBe(emp.getProperty("employeeID"));
      });
    });
  });


});


function buildUnidirectionalMetadataStore(isBossVersion: boolean) {
  const ms = new MetadataStore();
  ms.addEntityType({
    shortName: "Employee",
    namespace: "Foo",
    autoGeneratedKeyType: breeze.AutoGeneratedKeyType.Identity,
    dataProperties: [
      new breeze.DataProperty({
        name: "employeeID",
        dataType: breeze.DataType.Int32,
        isNullable: false,
        isPartOfKey: true
      })
    ]
  });
  const employeeType = ms.getEntityType("Employee") as EntityType;
  employeeType.addProperty(new DataProperty({
    name: "firstName",
    dataType: breeze.DataType.String
  }));
  employeeType.addProperty(new DataProperty({
    name: "reportsToEmployeeID",
    dataType: breeze.DataType.Int32
  }));

  if (isBossVersion) {
    employeeType.addProperty(new NavigationProperty({
      name: "boss",
      entityTypeName: "Employee:#Foo",
      isScalar: true,
      associationName: "Employee_Boss",
      foreignKeyNames: ["reportsToEmployeeID"]
    }));
  } else {
    employeeType.addProperty(new breeze.NavigationProperty({
      name: "directReports",
      entityTypeName: "Employee:#Foo",
      isScalar: false,
      associationName: "Employee_DirectReports",
      invForeignKeyNames: ["reportsToEmployeeID"]
    }));
  }
  ms.setEntityTypeForResourceName('Employees', 'Employee');
  return ms;
}

