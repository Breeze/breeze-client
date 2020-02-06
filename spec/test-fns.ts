import { EntityManager, NamingConvention, MetadataStore, DataType, breeze, core, Entity, config } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxFetchAdapter } from 'breeze-client/adapter-ajax-fetch';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { UtilFns } from './util-fns';

const northwindIBMetadata = require('./support/NorthwindIBMetadata.json');  

export type JsonObj = {[k: string]: any};

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
  
  static metadataStoreIsBeingFetched: boolean;

  static sampleMetadata: string;
  static sampleMetadataStore = TestFns.initSampleMetadataStore();  

  static defaultMetadata: string;
  static defaultMetadataStore: MetadataStore;
  
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

  

  static initNonServerEnv() {
    TestFns.serverEnvName = "NO SERVER";
    TestFns.calcServerTypes(TestFns.serverEnvName);
    TestFns.initBrowserShims();
    TestFns.initAdapters();
    
  }

  static initServerEnv(serverEnvName?: string) {
    if (serverEnvName == null) {
      serverEnvName = TestFns.defaultServerEnvName;
    }
    TestFns.serverEnvName = serverEnvName.toLocaleUpperCase();

    TestFns.calcServerTypes(serverEnvName);

    TestFns.initBrowserShims();
    TestFns.initAdapters();

    if (TestFns.isAspCoreServer) {
      TestFns.defaultServiceName = 'http://localhost:61552/breeze/NorthwindIBModel';
    } else {

    }
  }

  private static calcServerTypes(serverEnvName: string) {
    TestFns.isODataServer = serverEnvName === 'ODATA';
    TestFns.isMongoServer = serverEnvName === 'MONGO';
    TestFns.isSequelizeServer = serverEnvName === 'SEQUELIZE';
    TestFns.isAspCoreServer = serverEnvName === 'ASPCORE';
    TestFns.isAspWebApiServer = serverEnvName === 'ASPWEBAPI';
    TestFns.isHibernateServer = serverEnvName === 'HIBERNATE';
    TestFns.isNHibernateServer = serverEnvName === 'NHIBERNATE';
  }

  private static initBrowserShims() {
    global['fetch'] = require('node-fetch');
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
      await ms.fetchMetadata(TestFns.defaultServiceName);
      TestFns.defaultMetadata = ms.exportMetadata();
      TestFns.defaultMetadataStore = ms;  
    }
    return TestFns.defaultMetadataStore;
  }

  static initSampleMetadataStore(): MetadataStore {
    if (TestFns.sampleMetadataStore == null) {
      let ms = new MetadataStore();
      ModelLibraryBackingStoreAdapter.register();
      // Import is faster with a string than with an already created object.
      TestFns.sampleMetadata = JSON.stringify(northwindIBMetadata);
      ms.importMetadata(TestFns.sampleMetadata);
      TestFns.sampleMetadataStore = ms;
    }
    return TestFns.sampleMetadataStore;
  }

  static newEntityManager(metadataStore?: MetadataStore) {
    let em: EntityManager;
    if (metadataStore) {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName, metadataStore: metadataStore });
    } else if (TestFns.defaultMetadataStore) {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName, metadataStore: TestFns.defaultMetadataStore });
    } else if (TestFns.sampleMetadataStore) {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName, metadataStore: TestFns.sampleMetadataStore });
    } else {
      em = new EntityManager({ serviceName: TestFns.defaultServiceName });
    }
    return em;
  }

  static getCustomerCtor() {
    const ctor = function () {
      this.miscData = "asdf";
      this.getNameLength = function () {
        return (this.getProperty("companyName") || "").length;
      };
    };
    return ctor;
  }
  

  static getCustomerWithES5PropsCtor() {
    const ctor = function () {    };
    TestFns.createES5Props(ctor.prototype);
    return ctor;
  }

  static createES5Props(target: any) {
    Object.defineProperty(target, "companyName", {
      get: function () {
        return this["_companyName"] || null;
      },
      set: function (value) {
        this["_companyName"] = value && value.toUpperCase();
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(target, "idAndName", {
      get: function () {
        return this.customerID + ":" + (this._companyName || "");
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(target, "miscData", {
      get: function () {
        return this["_miscData"] || "asdf";
      },
      set: function (value) {
        this["_miscData"] = value;
      },
      enumerable: true,
      configurable: true
    });
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

