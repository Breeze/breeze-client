import { EntityManager, NamingConvention, MetadataStore } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxFetchAdapter } from 'breeze-client/adapter-ajax-fetch';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';

export class TestFns {
    
  static defaultServiceName: string;
  static defaultMetadataStore: MetadataStore;

  static init(defaultServiceName: string) {
    global['fetch'] = require('node-fetch');

    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    DataServiceWebApiAdapter.register();

    NamingConvention.camelCase.setAsDefault();

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
}

export const testIf = (condition: boolean) => (condition ? test : test.skip);
export const skipIf = (condition: boolean) => (condition ? test.skip : test);
