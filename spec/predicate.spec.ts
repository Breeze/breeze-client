import { breeze } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { TestFns } from './test-fns';

ModelLibraryBackingStoreAdapter.register();

TestFns.initNonServerEnv();

describe("complex predicate testing", () => {

    beforeEach(function () {
        TestFns.initSampleMetadataStore();
    });

    test("should serialize complex predicate", () => {
        const equals = new breeze.Predicate('productID', breeze.FilterQueryOp.Equals, 1);
        const lessThan = new breeze.Predicate('productID', breeze.FilterQueryOp.LessThan, 1);
        const predicate = breeze.Predicate.and(equals, lessThan);

        const ms = TestFns.sampleMetadataStore;
        const et = ms.getAsEntityType('Product');
        const context = {
            entityType: et,
            propertyPathFn: <any>null
        };

        context.propertyPathFn = et.clientPropertyPathToServer.bind(context.entityType);
        // throws: Cannot create property 'lt' on number '1' in breeze-client 2.0.8
        const serialized = predicate.toJSONExt(context);

        //  { and: [ { productID: 1 }, { productID: { lt: 1 } } ] }
        expect(serialized).not.toBe(null);
        expect(serialized.and.length).toBe(2);
        expect(serialized.and[0].productID).toBe(1);
        expect(serialized.and[1].productID.lt).toBe(1);
    });
});
