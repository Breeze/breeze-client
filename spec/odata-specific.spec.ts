// testFns.skipIf("mongo,sequelize,hibernate,aspcore", "does not support the 'add' OData predicate").
// test("OData predicate - add ", function (assert) {

//   var done = assert.async();
//   var manager = newEm();
//   var query = new breeze.EntityQuery()
//     .from("Employees")
//     .where("EmployeeID add ReportsToEmployeeID gt 3");

//   manager.executeQuery(query).then(function (data) {
//     ok(data.results.length > 0, "there should be records returned");
//     try {
//       manager.executeQueryLocally(query);
//       ok(false, "shouldn't get here");
//     } catch (e) {
//       ok(e, "should throw an exception");
//     }
//   }).fail(testFns.handleFail).fin(done);
// });

// testFns.skipIf("mongo,sequelize,hibernate,aspcore", "does not support the 'add' OData predicate").
// test("OData predicate - add combined with regular predicate", function (assert) {
//   var done = assert.async();
//   var manager = newEm();
//   var predicate = Predicate.create("EmployeeID add ReportsToEmployeeID gt 3").and("employeeID", "<", 9999);

//   var query = new breeze.EntityQuery()
//     .from("Employees")
//     .where(predicate);

//   manager.executeQuery(query).then(function (data) {
//     ok(data.results.length > 0, "there should be records returned");
//     try {
//       manager.executeQueryLocally(query);
//       ok(false, "shouldn't get here");
//     } catch (e) {
//       ok(e, "should throw an exception");
//     }
//   }).fail(testFns.handleFail).fin(done);
// });
