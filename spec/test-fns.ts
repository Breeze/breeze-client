import { EntityManager, NamingConvention, MetadataStore, DataType, breeze, core, Entity } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxFetchAdapter } from 'breeze-client/adapter-ajax-fetch';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { UtilFns } from './util-fns';

export const testIf = (condition: boolean) => (condition ? test : test.skip);
export const skipTestIf = (condition: boolean) => (condition ? test.skip : test);
export const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
export const skipDescribeIf = (condition: boolean) => (condition ? describe.skip : describe);
export const expectPass = () => expect(true).toBe(true);

// Alt unused approach
// export const skipTestIf = (condition: boolean) => (condition ? { test: test.skip } : { test: test });

export class TestFns extends UtilFns {
  // Uncomment just one
  static defaultServerEnvName = "ASPCORE";
  // static currentServerEnvName = "SEQUELIZE";
  // static currentServerEnvName = "HIBERNATE";
  // static currentServerEnvName = "MONGO";

  static serverEnvName: string;
  static defaultServiceName: string;
  static defaultMetadataStore: MetadataStore;
  static metadataStoreIsBeingFetched: boolean;
  
  static isODataServer: boolean;
  static isMongoServer: boolean;
  static isSequelizeServer: boolean;
  static isAspCoreServer: boolean;
  static isAspWebApiServer: boolean;
  static isHibernateServer: boolean;
  static isNHibernateServer: boolean;

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

  static initServerEnv(serverEnvName?: string) {
    if (serverEnvName == null) {
      serverEnvName = TestFns.defaultServerEnvName;
    }
    TestFns.serverEnvName = serverEnvName.toLocaleUpperCase();

    TestFns.isODataServer = serverEnvName === 'ODATA';
    TestFns.isMongoServer = serverEnvName === 'MONGO';
    TestFns.isSequelizeServer = serverEnvName === 'SEQUELIZE';
    TestFns.isAspCoreServer = serverEnvName === 'ASPCORE';
    TestFns.isAspWebApiServer = serverEnvName === 'ASPWEBAPI';
    TestFns.isHibernateServer = serverEnvName === 'HIBERNATE';
    TestFns.isNHibernateServer = serverEnvName === 'NHIBERNATE';

    TestFns.initBrowserShims();
    TestFns.initAdapters();

    if (TestFns.isAspCoreServer) {
      TestFns.defaultServiceName = 'http://localhost:61552/breeze/NorthwindIBModel';
    } else {

    }
  }

  private static initBrowserShims() {
    global['fetch'] = require('node-fetch');
    // const LocalStorage = require('node-localstorage').LocalStorage;
    // global['localStorage'] = new LocalStorage('./scratch');
    // if (typeof localStorage === "undefined" || localStorage === null) {
    //   const LocalStorage = require('node-localstorage').LocalStorage;
    //   global['localStorage'] = new LocalStorage('./scratch');
    // }
  }

  private static initAdapters() {
    // ModelLibraryBackingStoreAdapter.register();
    // UriBuilderJsonAdapter.register();
    // AjaxFetchAdapter.register();
    // DataServiceWebApiAdapter.register();
    
    DataServiceWebApiAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    ModelLibraryBackingStoreAdapter.register();

    NamingConvention.camelCase.setAsDefault();
  }

  

  static async initDefaultMetadataStore() {
    if (TestFns.defaultMetadataStore == null) {
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
      em = new EntityManager({ serviceName: TestFns.defaultServiceName });
    }
    return em;
  }

  // private static updateWellKnownDataIfMongo() {
  //   if (TestFns.serverEnvName !== 'MONGO') {
  //     return;
  //   }
  //   TestFns.wellKnownData = {
  //     nancyID: "51a6d50e1711572dcc8ce7d1",
  //     alfredsID: null,
  //     dummyOrderID: "50a6d50e1711572dcc8ce7d1",
  //     dummyEmployeeID: "50a6d50e1711572dcc8ce7d2",
  //     chaiProductID: 10001,
  //     alfredsOrderDetailKey: null,
  //     keyNames: {
  //       order: "_id",
  //       customer: "_id",
  //       employee: "_id",
  //       product: "_id",
  //       user: "_id",
  //       supplier: "_id",
  //       region: "_id"
  //     }
  //   };
    
  // }

  
}

