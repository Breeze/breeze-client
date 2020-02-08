import { breeze, EntityManager, EntityQuery, NamingConvention, Predicate, EntityType, EntityState, EntityKey, Entity, DataService, MappingContext, NodeContext, NodeMeta } from 'breeze-client';
import { skipTestIf, TestFns, expectPass } from './test-fns';


TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();
});

const jsonResultsAdapter = new breeze.JsonResultsAdapter({
  name: "eventAdapter",
  extractResults: function (json: any) {
    return json.results;
  },
  visitNode: function (node: any, mappingContext: MappingContext, nodeContext: NodeContext) {
    const entityTypeName = 'OrderDetail';
    const entityType = entityTypeName && mappingContext.entityManager.metadataStore.getEntityType(entityTypeName, true);
    const propertyName = nodeContext.propertyName;
    const ignore = propertyName && propertyName.substr(0, 1) === "$";
    if (entityType) {
      if (TestFns.isHibernateServer) {
        node.rowVersion = 77;
      } else {
        node.RowVersion = 77;
      }
    }
    return {
      entityType: entityType,
      nodeId: node.$id,
      nodeRefId: node.$ref,
      ignore: ignore
    } as NodeMeta;
  }
});

describe("JsonResultsAdapter", () => {

  beforeEach(function () {

  });


  // test does not work with this test's jsonResultsAdapter
  skipTestIf(TestFns.isMongoServer || TestFns.isODataServer,
    "using jsonResultsAdapter", async () => {
      expect.assertions(2);
      const em1 = TestFns.newEntityManager();
      const q1 = EntityQuery.from("OrderDetails").take(5).using(jsonResultsAdapter);
      const qr1 = await em1.executeQuery(q1);
      expect(qr1.results.length).toBe(5);
      const rv = qr1.results[0].getProperty("rowVersion");
      expect(rv).toBe(77);
    });

  skipTestIf(TestFns.isMongoServer || TestFns.isODataServer,
    "using dataService with jsonResultsAdapter", async () => {
      expect.assertions(2);
      const em1 = TestFns.newEntityManager();
      const oldDs = em1.dataService;
      const newDs = new DataService({ serviceName: oldDs.serviceName, jsonResultsAdapter: jsonResultsAdapter });
      const q1 = EntityQuery.from("OrderDetails").take(5).using(newDs);
      const qr1 = await em1.executeQuery(q1);
      expect(qr1.results.length).toBe(5);
      const rv = qr1.results[0].getProperty("rowVersion");
      expect(rv).toBe(77);
    });

  skipTestIf(TestFns.isMongoServer || TestFns.isODataServer,
    "using em with dataService with jsonResultsAdapter", async () => {
      expect.assertions(2);
      const newDs = new DataService({ serviceName: TestFns.defaultServiceName, jsonResultsAdapter: jsonResultsAdapter });
      const em1 = new EntityManager({ dataService: newDs });
      const q1 = EntityQuery.from("OrderDetails").take(5);
      const qr1 = await em1.executeQuery(q1);
      expect(qr1.results.length).toBe(5);
      const rv = qr1.results[0].getProperty("rowVersion");
      expect(rv).toBe(77);
    });
});