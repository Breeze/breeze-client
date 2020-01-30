import { EntityManager, NamingConvention, MetadataStore } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxFetchAdapter } from 'breeze-client/adapter-ajax-fetch';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';

export const testIf = (condition: boolean) => (condition ? test : test.skip);
export const skipIf = (condition: boolean) => (condition ? test.skip : test);
export const expectPass = () => expect(true).toBe(true);

export class TestFns {
  static defaultServiceName: string;
  static defaultMetadataStore: MetadataStore;
  static serverEnvName: string;  // MONGO, ASPCORE, SEQUALIZE
  static isODataServer: boolean;
  static isMongoServer: boolean;


  static initServerEnvName(serverEnvName: string) {
    TestFns.serverEnvName = serverEnvName;
    TestFns.isODataServer = serverEnvName === 'ODATA';
    TestFns.isMongoServer = serverEnvName === 'MONGO';
  }

  static wellKnownData = {
    nancyID: 1 as any,
    alfredsID: '785efa04-cbf2-4dd7-a7de-083ee17b6ad2' as any,
    dummyOrderID: 999 as any,
    dummyEmployeeID: 9999 as any,
    chaiProductID: 1 as any,
    alfredsOrderDetailKey: { OrderID: 10643, ProductID: 28 /*R?ssle Sauerkraut*/ }, 
    keyNames:  {
      order: "orderID",
      customer: "customerID",
      employee: "employeeID",
      product: "productID",
      user: "id",
      supplier: "supplierID",
      region: "regionID"
    }
  };

  static init(defaultServiceName: string) {
    global['fetch'] = require('node-fetch');

    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    DataServiceWebApiAdapter.register();

    NamingConvention.camelCase.setAsDefault();

    TestFns.updateWellKnownDataIfMongo();

    TestFns.defaultServiceName = defaultServiceName;
  }

  static async initDefaultMetadataStore() {
    if (!TestFns.defaultMetadataStore) {
      const ms = new MetadataStore();
      const x = await ms.fetchMetadata(TestFns.defaultServiceName);
      TestFns.defaultMetadataStore = ms;  
    }
    return TestFns.defaultMetadataStore;
  }

  static newEntityManager(metadataStore?: MetadataStore) {
    let em: EntityManager;
    if (metadataStore) {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName, metadataStore: metadataStore });
    } else if (TestFns.defaultMetadataStore) {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName, metadataStore: TestFns.defaultMetadataStore });
    } else {
      em = new EntityManager(TestFns.defaultServiceName);
      em.metadataStore.metadataFetched.subscribe( (metadataFetchedArgs) => {
        TestFns.defaultMetadataStore = metadataFetchedArgs.metadataStore;
      });
    }
    return em;
  }

  private static updateWellKnownDataIfMongo() {
    if (TestFns.serverEnvName !== 'MONGO') {
      return;
    }
    TestFns.wellKnownData = {
      nancyID: "51a6d50e1711572dcc8ce7d1",
      alfredsID: null,
      dummyOrderID: "50a6d50e1711572dcc8ce7d1",
      dummyEmployeeID: "50a6d50e1711572dcc8ce7d2",
      chaiProductID: 10001,
      alfredsOrderDetailKey: null,
      keyNames: {
        order: "_id",
        customer: "_id",
        employee: "_id",
        product: "_id",
        user: "_id",
        supplier: "_id",
        region: "_id"
      }
    };
    
  }
}


