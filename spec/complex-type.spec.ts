
import { EntityManager } from '../src/entity-manager';
import { AjaxFakeAdapter } from '../src/adapter-ajax-fake';
import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from '../src/adapter-uri-builder-json';
import { DataServiceWebApiAdapter } from '../src/adapter-data-service-webapi';
import { EntityType, ComplexType } from 'breeze-client';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
ModelLibraryBackingStoreAdapter.register();
UriBuilderJsonAdapter.register();
DataServiceWebApiAdapter.register();
AjaxFakeAdapter.register();
const metadata = require('./support/ComplexTypeMetadata.json');

describe("ComplexType", function() {

  beforeEach(function() {

  });

  it("should create entity and complex type", function() {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let customer = em.createEntity("Customer", { CompanyName: "ACME"});
    expect(customer).toBeTruthy();

    let locType = ms.getEntityType("Location") as ComplexType;
    expect(locType).toBeTruthy("Could not get Location type");
    let loc1 = locType.createInstance({ City: "Palookaville"});

    customer.setProperty("Location", loc1);
    let ok = customer.entityAspect.validateEntity();
    expect(ok).toBeTruthy("Failed validation");

    let loc2 = customer.getProperty("Location");
    expect(loc2).toBeTruthy("Could not get Location property");
    expect(loc2.City).toEqual("Palookaville");

    let errors = em.saveChangesValidateOnClient([customer]);
    expect(errors).toBeNull("Got validation errors");
  });

  it("should set array of complex types", function() {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let customer = em.createEntity("Customer", { CompanyName: "ACME"});
    expect(customer).toBeTruthy();

    let roleType = ms.getEntityType("Role") as ComplexType;
    expect(roleType).toBeTruthy("Could not get Role type");
    let role1 = roleType.createInstance({ Name: "One"});
    let role2 = roleType.createInstance({ Name: "Two"});

    let roleProp = customer.getProperty("Roles");
    roleProp.push(role1);
    roleProp.push(role2);

    let errors = em.saveChangesValidateOnClient([customer]);
    expect(errors).toBeNull("Got validation errors");

    return em.saveChanges().then(sr => {
      expect(sr.entities).toBeTruthy();
      expect(sr.entities.length).toEqual(1);
    }).catch(err => {
      console.log(err);
      expect(err).toBeUndefined();
    });
  });
});