import { QueryOp } from './entity-query';
import { core, Callback, ErrorCallback } from './core';
import { assertParam } from './assert-param';
import { DataType } from './data-type';
import { EntityAspect, Entity } from './entity-aspect';
import { EntityKey } from './entity-key';
import { BreezeEnum } from './enum';
import { DataService, JsonResultsAdapter } from './data-service';
import { EntityManager, QueryResult } from './entity-manager';
import { MetadataStore, EntityType, NavigationProperty, EntityProperty } from './entity-metadata';
import { QueryOptions, MergeStrategy, FetchStrategy } from './query-options';
import { Predicate } from './predicate';

export interface RecursiveArray<T> {
  [i: number]: T | RecursiveArray<T>;
}

export interface EntityQueryJsonContext {
  entityType?: EntityType;
  propertyPathFn?: Function; // TODO
  toNameOnServer?: boolean;
}
/**
An EntityQuery instance is used to query entities either from a remote datasource or from a local [[EntityManager]].

EntityQueries are immutable - this means that all EntityQuery methods that return an EntityQuery actually create a new EntityQuery.  This means that
EntityQueries can be 'modified' without affecting any current instances.
@dynamic
**/
export class EntityQuery {
  /** @hidden @internal */
  _$typeName: string; // actually placed on prototype
  // top = this.take; // TODO: consider
  /** The resource name used by this query. __Read Only__ */
  resourceName?: string;
  /** The [[EntityType]] that is associated with the 'from' clause ( resourceName) of the query.  This is only guaranteed to be be set AFTER the query
  has been executed because it depends on the [[MetadataStore]] associated with the [[EntityManager]] that the query was executed against.
  This value may be null if the entityType cannot be associated with a resourceName. __Read Only__ */
  fromEntityType?: EntityType;
  /** The 'where' [[Predicate]] used by this query. __Read Only__ */
  wherePredicate: any; // TODO
  /** The [[OrderByClause]] used by this query. __Read Only__ */
  orderByClause?: OrderByClause;
  /** The [[ExpandClause]] used by this query. __Read Only__ */
  expandClause?: ExpandClause;
  /** The [[SelectClause]] used by this query. __Read Only__ */
  selectClause?: SelectClause;
  /** The number of entities to 'skip' for this query. __Read Only__ */
  skipCount?: number;
  /** The number of entities to 'take' for this query. __Read Only__ */
  takeCount?: number;
  /** Any additional parameters that were added to the query via the 'withParameters' method. __Read Only__ */
  parameters: Object;
  /** Whether an inline count is returned for this query. __Read Only__ */
  inlineCountEnabled: boolean;
  /** Whether entity tracking has been disabled for this query. __Read Only__ */
  noTrackingEnabled: boolean;
  /** The [[QueryOptions]] for this query. __Read Only__  **/
  // default is to get queryOptions and dataService from the entityManager.
  queryOptions?: QueryOptions;
  /** The [[DataService]] for this query. __Read Only__  **/
  dataService?: DataService;
  /** The [[EntityManager]] for this query. This may be null and can be set via the 'using' method.  **/
  entityManager?: EntityManager;
  /**  The entityType that will be returned by this query. 
  This property will only be set if the 'toType' method was called. __Read Only__ */
  resultEntityType: EntityType | string;

  /** Constructor
  >    let query = new EntityQuery("Customers")

  Usually this constructor will be followed by calls to filtering, ordering or selection methods
  >      let query = new EntityQuery("Customers")
  >        .where("CompanyName", "startsWith", "C")
  >        .orderBy("Region");
  @param resourceName - either a resource name or a serialized EntityQuery ( created by [[EntityQuery.toJSON]])
  **/
  constructor(resourceName?: string | Object) {
    if (resourceName != null && (typeof resourceName !== 'string')) {
      return fromJSON(this, resourceName);
    }
    // TODO: cast as string below needed for early versions of TypeDoc - but not for regular compile - check later
    this.resourceName = resourceName as string;
    this.fromEntityType = undefined;
    this.wherePredicate = undefined;
    this.orderByClause = undefined;
    this.selectClause = undefined;
    this.skipCount = undefined;
    this.takeCount = undefined;
    this.expandClause = undefined;
    this.parameters = {};
    this.inlineCountEnabled = false;
    this.noTrackingEnabled = false;
    // default is to get queryOptions and dataService from the entityManager.
    // this.queryOptions = new QueryOptions();
    // this.dataService = new DataService();
    this.entityManager = undefined;

  }


  /**
  Specifies the resource to query for this EntityQuery.
  >      let query = new EntityQuery()
  >        .from("Customers");

  is the same as
  >      let query = new EntityQuery("Customers");
  @param resourceName - The resource to query.
  **/
  from(resourceName: string) {
    // TODO: think about allowing entityType as well
    assertParam(resourceName, "resourceName").isString().check();
    return clone(this, "resourceName", resourceName);
  }

  /**
  This is a static version of the "from" method and it creates a 'base' entityQuery for the specified resource name.
  >      let query = EntityQuery.from("Customers");

  is the same as
  >      let query = new EntityQuery("Customers");
  @param resourceName - The resource to query.
  **/
  static from(resourceName: string) {
    assertParam(resourceName, "resourceName").isString().check();
    return new EntityQuery(resourceName);
  }

  /**
  Specifies the top level EntityType that this query will return.  Only needed when a query returns a json result that does not include type information.
  >      let query = new EntityQuery()
  >        .from("MyCustomMethod")
  >        .toType("Customer")
  @param entityType - The top level EntityType that this query will return.  This method is only needed when a query returns a json result that
  does not include type information.  If the json result consists of more than a simple entity or array of entities, consider using a [[JsonResultsAdapter]] instead.
  **/
  toType(entityType: string | EntityType) {
    assertParam(entityType, "entityType").isString().or().isInstanceOf(EntityType).check();
    return clone(this, "resultEntityType", entityType);
  }


  where(predicate: Predicate): EntityQuery;
  where(predicate: Object): EntityQuery;
  where(property: string, operator: string, value: any): EntityQuery;
  where(property: string, operator: FilterQueryOp, value: any): EntityQuery;
  where(property: string, filterop: FilterQueryOp, property2: string, filterop2: FilterQueryOp, value: any): EntityQuery;  // for any/all clauses
  where(property: string, filterop: string, property2: string, filterop2: string, value: any): EntityQuery;  // for any/all clauses
  where(anArray: RecursiveArray<string | number | FilterQueryOp | Predicate>): EntityQuery;
  /**
  Returns a new query with an added filter criteria; Can be called multiple times which means to 'and' with any existing
  Predicate or can be called with null to clear all predicates.
  >      let query = new EntityQuery("Customers")
  >          .where("CompanyName", "startsWith", "C");

  This can also be expressed using an explicit [[FilterQueryOp]] as
  >      let query = new EntityQuery("Customers")
  >          .where("CompanyName", FilterQueryOp.StartsWith, "C");

  or a preconstructed [[Predicate]] may be used
  >      let pred = new Predicate("CompanyName", FilterQueryOp.StartsWith, "C");
  >      let query = new EntityQuery("Customers").where(pred);

  Predicates are often useful when you want to combine multiple conditions in a single filter, such as
  >      let pred = Predicate.create("CompanyName", "startswith", "C").and("Region", FilterQueryOp.Equals, null);
  >      let query = new EntityQuery("Customers")
  >          .where(pred);

  More complicated queries can make use of nested property paths
  >      let query = new EntityQuery("Products")
  >          .where("Category.CategoryName", "startswith", "S");

  or OData functions - A list of valid OData functions can be found within the [[Predicate]] documentation.
  
  >      let query = new EntityQuery("Customers")
  >          .where("toLower(CompanyName)", "startsWith", "c");

  or to be even more baroque
  >      let query = new EntityQuery("Customers")
  >          .where("toUpper(substring(CompanyName, 1, 2))", FilterQueryOp.Equals, "OM");
  @param predicate -  Can be either
    - a single [[Predicate]]

    - the parameters to create a 'simple' Predicate
    - -  a property name, a property path with '.' as path seperators or a property expression {String}
    - -  an operator - [[FilterQueryOp]] or it's string representation. Case is ignored
    when if a string is provided and any string that matches one of the FilterQueryOp aliases will be accepted.
    - -  a value {Object} - This will be treated as either a property expression or a literal depending on context.  
    In general, if the value can be interpreted as a property expression it will be, otherwise it will be treated as a literal.
    In most cases this works well, but you can also force the interpretation by making the value argument itself an object 
    with a 'value' property and an 'isLiteral' property set to either true or false.
    Breeze also tries to infer the dataType of any literal based on context, if this fails you can force this inference by making the value argument 
    an object with a 'value' property and a 'dataType'property set to one of the DataType enumeration instances.

    - a null or undefined ( this causes any existing where clause to be removed)
  **/
  where(...args: any[]) {
    let wherePredicate: Predicate | undefined;
    if (args.length > 0 && args[0] != null) {
      wherePredicate = Predicate.create(...<any>args);
      if (this.fromEntityType) wherePredicate._validate(this.fromEntityType);
      if (this.wherePredicate) {
        wherePredicate = this.wherePredicate.and(wherePredicate);
      }
    }
    return clone(this, "wherePredicate", wherePredicate);
  }


  orderBy(propertyPaths: string, isDescending?: boolean): EntityQuery;
  orderBy(propertyPaths: string[], isDescending?: boolean): EntityQuery;
  /**
  Returns a new query that orders the results of the query by property name.  By default sorting occurs is ascending order, but sorting in descending order is supported as well.
  OrderBy clauses may be chained.
  >     let query = new EntityQuery("Customers")
  >        .orderBy("CompanyName");

  or to sort across multiple properties
  >     let query = new EntityQuery("Customers")
  >        .orderBy("Region, CompanyName");

  Nested property paths are also supported
  >     let query = new EntityQuery("Products")
  >        .orderBy("Category.CategoryName");

  Sorting in descending order is supported via the addition of ' desc' to the end of any property path.
  >     let query = new EntityQuery("Customers")
  >        .orderBy("CompanyName desc");

  or
  >     let query = new EntityQuery("Customers")
  >        .orderBy("Region desc, CompanyName desc");
  @param propertyPaths - A comma-separated (',') string of property paths or an array of property paths.
  Each property path can optionally end with " desc" to force a descending sort order. If 'propertyPaths' is either null or omitted then all ordering is removed.
  @param isDescending - If specified, overrides all of the embedded 'desc' tags in the previously specified property paths.
  **/
  orderBy(propertyPaths: string | string[], isDescending?: boolean) {
    // propertyPaths: can pass in create("A.X,B") or create("A.X desc, B") or create("A.X desc,B", true])
    // isDesc parameter trumps isDesc in propertyName.
    let orderByClause = propertyPaths == null ? null : new OrderByClause(normalizePropertyPaths(propertyPaths), isDescending);
    if (this.orderByClause && orderByClause) {
      orderByClause = new OrderByClause([this.orderByClause, orderByClause]);
    }
    return clone(this, "orderByClause", orderByClause);
  }


  orderByDesc(propertyPaths: string): EntityQuery;
  orderByDesc(propertyPaths: string[]): EntityQuery;
  /**
  Returns a new query that orders the results of the query by property name in descending order.
  >     let query = new EntityQuery("Customers")
  >        .orderByDesc("CompanyName");

  or to sort across multiple properties
  >     let query = new EntityQuery("Customers")
  >        .orderByDesc("Region, CompanyName");

  Nested property paths are also supported
  >     let query = new EntityQuery("Products")
  >        .orderByDesc("Category.CategoryName");
  @param propertyPaths - A comma-separated (',') string of property paths or an array of property paths.
  If 'propertyPaths' is either null or omitted then all ordering is removed.
  **/
  orderByDesc(propertyPaths: string | string[]) {
    return this.orderBy(propertyPaths as any, true);
  }

  /**
  Returns a new query that selects a list of properties from the results of the original query and returns the values of just these properties. This
  will be referred to as a projection.
  If the result of this selection "projection" contains entities, these entities will automatically be added to EntityManager's cache and will
  be made 'observable'.
  Any simple properties, i.e. strings, numbers or dates within a projection will not be cached are will NOT be made 'observable'.
  
  Simple data properties can be projected
  >     let query = new EntityQuery("Customers")
  >         .where("CompanyName", "startsWith", "C")
  >         .select("CompanyName");

  This will return an array of objects each with a single "CompanyName" property of type string.
  A similar query could return a navigation property instead
  >     let query = new EntityQuery("Customers")
  >        .where("CompanyName", "startsWith", "C")
  >        .select("Orders");

  where the result would be an array of objects each with a single "Orders" property that would itself be an array of "Order" entities.
  Composite projections are also possible:
  >     let query = new EntityQuery("Customers")
  >        .where("CompanyName", "startsWith", "C")
  >        .select("CompanyName, Orders");

  As well as projections involving nested property paths
  >     let query = EntityQuery("Orders")
  >        .where("Customer.CompanyName", "startsWith", "C")
  >        .select("Customer.CompanyName, Customer, OrderDate");
  @param propertyPaths - A comma-separated (',') string of property paths or an array of property paths.
  If 'propertyPaths' is either null or omitted then any existing projection on the query is removed.
  **/
  select(propertyPaths: string | string[]) {
    let selectClause = propertyPaths == null ? null : new SelectClause(normalizePropertyPaths(propertyPaths));
    return clone(this, "selectClause", selectClause);
  }

  /**
  Returns a new query that skips the specified number of entities when returning results.
  Any existing 'skip' can be cleared by calling 'skip' with no arguments.
  >     let query = new EntityQuery("Customers")
  >       .where("CompanyName", "startsWith", "C")
  >       .skip(5);
  @param count - The number of entities to skip over. If omitted or null any existing skip count on the query is removed.
  **/
  skip(count?: number) {
    assertParam(count, "count").isOptional().isNumber().check();
    return clone(this, "skipCount", (count == null) ? null : count);
  }

  /**
  Returns a new query that returns only the specified number of entities when returning results. - Same as 'take'.
  Any existing 'top' can be cleared by calling 'top' with no arguments.
  >     let query = new EntityQuery("Customers")
  >        .top(5);
  @param count - The number of entities to return.
  If 'count' is either null or omitted then any existing 'top' count on the query is removed.
  **/
  top(count?: number) {
    return this.take(count);
  }

  /**
  Returns a new query that returns only the specified number of entities when returning results - Same as 'top'.
  Any existing take can be cleared by calling take with no arguments.
  >     let query = new EntityQuery("Customers")
  >        .take(5);
  @param count - The number of entities to return.
  If 'count' is either null or omitted then any existing 'take' count on the query is removed.
  **/
  take(count?: number) {
    assertParam(count, "count").isOptional().isNumber().check();
    return clone(this, "takeCount", (count == null) ? null : count);
  }

  /**
  Returns a new query that will return related entities nested within its results. The expand method allows you to identify related entities, via navigation property
  names such that a graph of entities may be retrieved with a single request. Any filtering occurs before the results are 'expanded'.
  >     let query = new EntityQuery("Customers")
  >        .where("CompanyName", "startsWith", "C")
  >        .expand("Orders");

  will return the filtered customers each with its "Orders" properties fully resolved.
  Multiple paths may be specified by separating the paths by a ','
  >     let query = new EntityQuery("Orders")
  >        .expand("Customer, Employee")

  and nested property paths my be specified as well
  >     let query = new EntityQuery("Orders")
  >        .expand("Customer, OrderDetails, OrderDetails.Product")
  @param propertyPaths - A comma-separated list of navigation property names or an array of navigation property names. Each Navigation Property name can be followed
  by a '.' and another navigation property name to enable identifying a multi-level relationship.
  If 'propertyPaths' is either null or omitted then any existing 'expand' clause on the query is removed.
  **/
  expand(propertyPaths: string | string[]) {
    let expandClause = propertyPaths == null ? null : new ExpandClause(normalizePropertyPaths(propertyPaths));
    return clone(this, "expandClause", expandClause);
  }

  /**
  Returns a new query that includes a collection of parameters to pass to the server.
  >     let query = EntityQuery.from("EmployeesFilteredByCountryAndBirthdate")
  >        .withParameters({ BirthDate: "1/1/1960", Country: "USA" });
   
  will call the 'EmployeesFilteredByCountryAndBirthdate' method on the server and pass in 2 parameters. This
  query will be uri encoded as
  >      {serviceApi}/EmployeesFilteredByCountryAndBirthdate?birthDate=1%2F1%2F1960&country=USA

  Parameters may also be mixed in with other query criteria.
  >     let query = EntityQuery.from("EmployeesFilteredByCountryAndBirthdate")
  >        .withParameters({ BirthDate: "1/1/1960", Country: "USA" })
  >        .where("LastName", "startsWith", "S")
  >        .orderBy("BirthDate");
  @param parameters - A parameters object where the keys are the parameter names and the values are the parameter values.
  **/
  withParameters(parameters: Object) {
    assertParam(parameters, "parameters").isObject().check();
    return clone(this, "parameters", parameters);
  }

  /**
  Returns a query with the 'inlineCount' capability either enabled or disabled.  With 'inlineCount' enabled, an additional 'inlineCount' property
  will be returned with the query results that will contain the number of entities that would have been returned by this
  query with only the 'where'/'filter' clauses applied, i.e. without any 'skip'/'take' operators applied. For local queries this clause is ignored.
  >     let query = new EntityQuery("Customers")
  >        .take(20)
  >        .orderBy("CompanyName")
  >        .inlineCount(true);

  will return the first 20 customers as well as a count of all of the customers in the remote store.
  @param enabled - (default = true) Whether or not inlineCount capability should be enabled. If this parameter is omitted, true is assumed.
  **/
  inlineCount(enabled?: boolean) {
    assertParam(enabled, "enabled").isBoolean().isOptional().check();
    enabled = (enabled === undefined) ? true : !!enabled;
    return clone(this, "inlineCountEnabled", enabled);
  }

  useNameOnServer(usesNameOnServer?: boolean) {
    assertParam(usesNameOnServer, "usesNameOnServer").isBoolean().isOptional().check();
    usesNameOnServer = (usesNameOnServer === undefined) ? true : !!usesNameOnServer;
    return clone(this, "usesNameOnServer", usesNameOnServer);
  }

  /**
  Returns a query with the 'noTracking' capability either enabled or disabled.  With 'noTracking' enabled, the results of this query
  will not be coerced into entities but will instead look like raw javascript projections. i.e. simple javascript objects.
  >     let query = new EntityQuery("Customers")
  >         .take(20)
  >         .orderBy("CompanyName")
  >         .noTracking(true);
  @param enabled - (default = true) Whether or not the noTracking capability should be enabled. If this parameter is omitted, true is assumed.
  **/
  noTracking(enabled?: boolean) {
    assertParam(enabled, "enabled").isBoolean().isOptional().check();
    enabled = (enabled === undefined) ? true : !!enabled;
    return clone(this, "noTrackingEnabled", enabled);
  }

  using(obj: EntityManager): EntityQuery;
  using(obj: DataService): EntityQuery;
  using(obj: JsonResultsAdapter): EntityQuery;
  using(obj: QueryOptions): EntityQuery;
  using(obj: MergeStrategy): EntityQuery;
  using(obj: FetchStrategy): EntityQuery;
  /**
  Returns a copy of this EntityQuery with the specified [[EntityManager]], [[DataService]],
  [[JsonResultsAdapter]], [[MergeStrategy]] or [[FetchStrategy]] applied.
  >      // 'using' can be used to return a new query with a specified EntityManager.
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders")
  >        .using(em);

  or with a specified [[MergeStrategy]]
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders")
  >        .using(MergeStrategy.PreserveChanges);

  or with a specified [[FetchStrategy]]
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders")
  >        .using(FetchStrategy.FromLocalCache);
  @param obj - The object to update in creating a new EntityQuery from an existing one.
  **/
  using(obj: any) {
    if (!obj) return this;
    let eq = clone(this);
    processUsing(eq, {
      "entityManager": null,
      "dataService": null,
      "queryOptions": null,
      "fetchStrategy": (eq: EntityQuery, val: any) => {
        eq.queryOptions = (eq.queryOptions || new QueryOptions()).using(val);
      },
      "mergeStrategy": (eq: EntityQuery, val: any) => {
        eq.queryOptions = (eq.queryOptions || new QueryOptions()).using(val);
      },
      "jsonResultsAdapter": (eq: EntityQuery, val: any) => {
        eq.dataService = (eq.dataService || new DataService()).using({ jsonResultsAdapter: val });
      }
    }, obj);
    return eq;
  }

  /**
  Executes this query.  This method requires that an EntityManager has been previously specified via the "using" method.
  
  This method can be called using a 'promises' syntax ( recommended)
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders").using(em);
  >      query.execute().then( function(data) {
  >          ... query results processed here
  >      }).fail( function(err) {
  >          ... query failure processed here
  >      });

  or with callbacks
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders").using(em);
  >      query.execute(
  >        function(data) {
  >                    let orders = data.results;
  >                    ... query results processed here
  >                },
  >        function(err) {
  >                    ... query failure processed here
  >                });

  Either way this method is the same as calling the EntityManager 'execute' method.
  >      let em = new EntityManager(serviceName);
  >      let query = new EntityQuery("Orders");
  >      em.executeQuery(query).then( function(data) {
  >         let orders = data.results;
  >          ... query results processed here
  >      }).fail( function(err) {
  >         ... query failure processed here
  >      });

  @param callback -  Function called on success.
  @param errorCallback - Function called on failure.
  @return Promise
  **/
  execute(callback?: Callback, errorCallback?: ErrorCallback): Promise<QueryResult> {
    if (!this.entityManager) {
      throw new Error("An EntityQuery must have its EntityManager property set before calling 'execute'");
    }
    return this.entityManager.executeQuery(this, callback, errorCallback);
  }

  /**
  Executes this query against the local cache.  This method requires that an EntityManager have been previously specified via the "using" method.
  >      // assume em is an entityManager already filled with order entities;
  >      let query = new EntityQuery("Orders").using(em);
  >      let orders = query.executeLocally();

  Note that calling this method is the same as calling [[EntityManager.executeQueryLocally]].
  **/
  executeLocally() {
    if (!this.entityManager) {
      throw new Error("An EntityQuery must have its EntityManager property set before calling 'executeLocally'");
    }
    return this.entityManager.executeQueryLocally(this);
  }

  toJSON() {
    return this.toJSONExt();
  }

  /** Typically only for use when building UriBuilderAdapters.  
  @hidden @internal  
  */
  toJSONExt(context?: EntityQueryJsonContext) {
    context = context || {};
    context.entityType = context.entityType || this.fromEntityType;
    context.propertyPathFn = context.toNameOnServer ? context.entityType!.clientPropertyPathToServer.bind(context.entityType) : core.identity;

    let toJSONExtFn = function (v: any) {
      return v ? v.toJSONExt(context) : undefined;
    };
    return core.toJson(this, {
      "from,resourceName": null,
      "toType,resultEntityType": function (v: any) {
        // resultEntityType can be either a string or an entityType
        return v ? (typeof v === 'string' ? v : v.name) : undefined;
      },
      "where,wherePredicate": toJSONExtFn,
      "orderBy,orderByClause": toJSONExtFn,
      "select,selectClause": toJSONExtFn,
      "expand,expandClause": toJSONExtFn,
      "skip,skipCount": null,
      "take,takeCount": null,
      parameters: function (v: any) {
        return core.isEmpty(v) ? undefined : v;
      },
      "inlineCount,inlineCountEnabled": false,
      "noTracking,noTrackingEnabled": false,
      queryOptions: null
    });

  }

  static fromEntities(entity: Entity): EntityQuery;
  static fromEntities(entities: Entity[]): EntityQuery;
  /**
  Static method that creates an EntityQuery that will allow 'requerying' an entity or a collection of entities by primary key. This can be useful
  to force a requery of selected entities, or to restrict an existing collection of entities according to some filter.

  Works for a single entity or an array of entities of the SAME type.
  Does not work for an array of entities of different types.
  >      // assuming 'customers' is an array of 'Customer' entities retrieved earlier.
  >      let customersQuery = EntityQuery.fromEntities(customers);

  The resulting query can, of course, be extended
  >      // assuming 'customers' is an array of 'Customer' entities retrieved earlier.
  >      let customersQuery = EntityQuery.fromEntities(customers)
  >        .where("Region", FilterQueryOp.NotEquals, null);

  Single entities can requeried as well.
  >      // assuming 'customer' is a 'Customer' entity retrieved earlier.
  >      let customerQuery = EntityQuery.fromEntities(customer);

  will create a query that will return an array containing a single customer entity.
  @param entities - The entities for which we want to create an EntityQuery.
  **/
  static fromEntities(entities: Entity | Entity[]) {
    assertParam(entities, "entities").isEntity().or().isNonEmptyArray().isEntity().check();
    let ents = (Array.isArray(entities)) ? entities : [entities];

    let firstEntity = ents[0];
    let type = firstEntity.entityType;
    if (ents.some(function (e) {
      return e.entityType !== type;
    })) {
      throw new Error("All 'fromEntities' must be the same type; at least one is not of type " +
        type.name);
    }
    let q = new EntityQuery(type.defaultResourceName);
    let preds = ents.map(function (entity) {
      return buildPredicate(entity);
    });
    let pred = Predicate.or(preds);
    q = q.where(pred);
    let em = firstEntity.entityAspect.entityManager;
    if (em) {
      q = q.using(em);
    }
    return q;
  }

  /**
  Creates an EntityQuery for the specified [[EntityKey]].
  >      let empType = metadataStore.getEntityType("Employee");
  >      let entityKey = new EntityKey(empType, 1);
  >      let query = EntityQuery.fromEntityKey(entityKey);

  or
  >      // 'employee' is a previously queried employee
  >      let entityKey = employee.entityAspect.getKey();
  >      let query = EntityQuery.fromEntityKey(entityKey);
  @param entityKey - The [[EntityKey]] for which a query will be created.
  **/
  static fromEntityKey(entityKey: EntityKey) {
    assertParam(entityKey, "entityKey").isInstanceOf(EntityKey).check();
    let q = new EntityQuery(entityKey.entityType.defaultResourceName);
    let pred = buildKeyPredicate(entityKey);
    q = q.where(pred).toType(entityKey.entityType);
    return q;
  }

  /**
  Creates an EntityQuery for the specified entity and [[NavigationProperty]].
  >      // 'employee' is a previously queried employee
  >      let ordersNavProp = employee.entityType.getProperty("Orders");
  >      let query = EntityQuery.fromEntityNavigation(employee, ordersNavProp);

  will return a query for the "Orders" of the specified 'employee'.
  @param entity - The Entity whose navigation property will be queried.
  @param navigationProperty - The [[NavigationProperty]] or name of the NavigationProperty to be queried.
  **/
  static fromEntityNavigation = function (entity: Entity, navigationProperty: NavigationProperty | string) {
    assertParam(entity, "entity").isEntity().check();
    let navProperty = entity.entityType._checkNavProperty(navigationProperty);
    let q = new EntityQuery(navProperty.entityType.defaultResourceName);
    let pred = buildNavigationPredicate(entity, navProperty);
    if (pred == null) {
      throw new Error("Unable to create a NavigationQuery for navigationProperty: " + navProperty.name );
    }
    q = q.where(pred);
    let em = entity.entityAspect.entityManager;
    return em ? q.using(em) : q;
  };

  // protected methods
  /** @hidden @internal */
  _getFromEntityType(metadataStore: MetadataStore, throwErrorIfNotFound?: boolean) {
    // Uncomment next two lines if we make this method public.
    // assertParam(metadataStore, "metadataStore").isInstanceOf(MetadataStore).check();
    // assertParam(throwErrorIfNotFound, "throwErrorIfNotFound").isBoolean().isOptional().check();
    let entityType = this.fromEntityType;
    if (entityType) return entityType;

    let resourceName = this.resourceName;
    if (!resourceName) {
      throw new Error("There is no resourceName for this query");
    }

    if (metadataStore.isEmpty()) {
      if (throwErrorIfNotFound) {
        throw new Error("There is no metadata available for this query. " +
          "Are you querying the local cache before you've fetched metadata?");
      } else {
        return undefined;
      }
    }

    let entityTypeName = metadataStore.getEntityTypeNameForResourceName(resourceName);
    if (entityTypeName) {
      entityType = metadataStore._getStructuralType(entityTypeName) as EntityType;
    } else {
      entityType = this._getToEntityType(metadataStore, true);
    }

    if (!entityType) {
      if (throwErrorIfNotFound) {
        throw new Error(core.formatString("Cannot find an entityType for resourceName: '%1'. "
          + " Consider adding an 'EntityQuery.toType' call to your query or "
          + "calling the MetadataStore.setEntityTypeForResourceName method to register an entityType for this resourceName.", resourceName));
      } else {
        return undefined;
      }
    }

    this.fromEntityType = entityType;
    return entityType;

  }

  /** @hidden @internal */
  _getToEntityType(metadataStore: MetadataStore, skipFromCheck?: boolean): EntityType | undefined {
    // skipFromCheck is to avoid recursion if called from _getFromEntityType;
    if (this.resultEntityType instanceof EntityType) {
      return this.resultEntityType;
    } else if (this.resultEntityType) {
      // resultEntityType is a string
      this.resultEntityType = metadataStore._getStructuralType(this.resultEntityType, false) as EntityType;
      return this.resultEntityType;
    } else {
      // resolve it, if possible, via the resourceName
      // do not cache this value in this case
      // cannot determine the resultEntityType if a selectClause is present.
      // return skipFromCheck ? null : (!this.selectClause) && this._getFromEntityType(metadataStore, false);
      if (skipFromCheck || this.selectClause) {
        return undefined;
      } else {
        this._getFromEntityType(metadataStore, false);
      }

    }
  }

  /** @hidden @internal */
  // for testing
  _toUri(em: EntityManager) {
    let ds = DataService.resolve([em.dataService]);
    return ds!.uriBuilder!.buildUri(this, em.metadataStore);
  }

}
EntityQuery.prototype._$typeName = "EntityQuery";

// private functions

function fromJSON(eq: EntityQuery, json: Object) {
  core.toJson(json, {
    "resourceName,from": null,
    // just the name comes back and will be resolved later
    "resultEntityType,toType": null,
    "wherePredicate,where": function (v: any) {
      return v ? new Predicate(v) : undefined;
    },
    "orderByClause,orderBy": function (v: any) {
      return v ? new OrderByClause(v) : undefined;
    },
    "selectClause,select": function (v: any) {
      return v ? new SelectClause(v) : undefined;
    },
    "expandClause,expand": function (v: any) {
      return v ? new ExpandClause(v) : undefined;
    },
    "skipCount,skip": null,
    "takeCount,take": null,
    parameters: function (v: any) {
      return core.isEmpty(v) ? undefined : v;
    },
    "inlineCountEnabled,inlineCount": false,
    "noTrackingEnabled,noTracking": false,
    queryOptions: function (v: any) {
      return v ? QueryOptions.fromJSON(v) : undefined;
    }
  }, eq);
  return eq;
}

function clone(eq: EntityQuery, propName?: string, value?: any) {
  // immutable queries mean that we don't need to clone if no change in value.
  if (propName) {
    if (eq[propName] === value) return eq;
  }
  // copying QueryOptions is safe because they are are immutable;
  let copy = core.extend(new EntityQuery(), eq, [
    "resourceName",
    "fromEntityType",
    "wherePredicate",
    "orderByClause",
    "selectClause",
    "skipCount",
    "takeCount",
    "expandClause",
    "inlineCountEnabled",
    "noTrackingEnabled",
    "usesNameOnServer",
    "queryOptions",
    "entityManager",
    "dataService",
    "resultEntityType"
  ]) as EntityQuery;
  copy.parameters = core.extend({}, eq.parameters);
  if (propName) {
    copy[propName] = value;
  }
  return copy;
}

function processUsing(eq: EntityQuery, map: Object, value: any, propertyName?: string) {
  let typeName = value._$typeName || ((value instanceof BreezeEnum) && (value.constructor as any).name);
  let key = typeName && typeName.substr(0, 1).toLowerCase() + typeName.substr(1);
  if (propertyName && key !== propertyName) {
    throw new Error("Invalid value for property: " + propertyName);
  }
  if (key) {
    let fn = map[key];
    if (fn === undefined) {
      throw new Error("Invalid config property: " + key);
    } else if (fn === null) {
      eq[key] = value;
    } else {
      fn(eq, value);
    }
  } else {
    core.objectForEach(value, (propName, val) => {
      processUsing(eq, map, val, propName);
    });
  }
}

function normalizePropertyPaths(propertyPaths: string | string[]) {
  assertParam(propertyPaths, "propertyPaths").isOptional().isString().or().isArray().isString().check();
  if (typeof propertyPaths === 'string') {
    propertyPaths = propertyPaths.split(",");
  }

  propertyPaths = propertyPaths.map(function (pp) {
    return pp.trim();
  });
  return propertyPaths;
}

function buildPredicate(entity: Entity) {
  let entityType = entity.entityType;
  let predParts = entityType.keyProperties.map(function (kp) {
    return Predicate.create(kp.name, FilterQueryOp.Equals, entity.getProperty(kp.name));
  });
  let pred = Predicate.and(predParts);
  return pred;
}

function buildKeyPredicate(entityKey: EntityKey) {
  let keyProps = entityKey.entityType.keyProperties;
  let preds = core.arrayZip(keyProps, entityKey.values, function (kp, v) {
    return Predicate.create(kp.name, FilterQueryOp.Equals, v);
  });
  let pred = Predicate.and(preds);
  return pred;
}

function buildNavigationPredicate(entity: Entity, navigationProperty: NavigationProperty) {
  if (navigationProperty.isScalar) {
    if (navigationProperty.foreignKeyNames.length === 0) return null;
    let relatedKeyValues = navigationProperty.foreignKeyNames.map((fkName) => {
      return entity.getProperty(fkName);
    });
    let entityKey = new EntityKey(navigationProperty.entityType, relatedKeyValues);
    return buildKeyPredicate(entityKey);
  } else {
    let inverseNp = navigationProperty.inverse;
    let foreignKeyNames = inverseNp ? inverseNp.foreignKeyNames : navigationProperty.invForeignKeyNames;
    if (foreignKeyNames.length === 0) return null;
    let keyValues = entity.entityAspect.getKey().values;
    let predParts = core.arrayZip(foreignKeyNames, keyValues, (fkName, kv) => {
      return Predicate.create(fkName, FilterQueryOp.Equals, kv);
    });
    return Predicate.and(predParts);
  }
}

/** Base class for BooleanQueryOp and FilterQueryOp */
export interface QueryOp {
  /** The operator for this enum. */
  operator: string;
}



/**
FilterQueryOp is an 'Enum' containing all of the valid  [[Predicate]]
filter operators for an [[EntityQuery]].
**/
export class FilterQueryOp extends BreezeEnum implements QueryOp {
  /** The operator for this enum. */
  operator: string;

  /** Aliases: "eq", "==" **/
  static Equals = new FilterQueryOp({ operator: "eq" });
  /**  Aliases: "ne", "!="  **/
  static NotEquals = new FilterQueryOp({ operator: "ne" });
  /** Aliases: "gt", ">"   **/
  static GreaterThan = new FilterQueryOp({ operator: "gt" });
  /** Aliases: "lt", "<"  **/
  static LessThan = new FilterQueryOp({ operator: "lt" });
  /**  Aliases: "ge", ">="  **/
  static GreaterThanOrEqual = new FilterQueryOp({ operator: "ge" });
  /**  Aliases: "le", "<="  **/
  static LessThanOrEqual = new FilterQueryOp({ operator: "le" });
  /**  String operation: Is a string a substring of another string.  Aliases: "substringof"   **/
  static Contains = new FilterQueryOp({ operator: "contains" });
  /** No aliases */
  static StartsWith = new FilterQueryOp({ operator: "startswith" });
  /** No aliases */
  static EndsWith = new FilterQueryOp({ operator: "endswith" });
  /**  Aliases: "some"  **/
  static Any = new FilterQueryOp({ operator: "any" });
  /**  Aliases: "every"  **/
  static All = new FilterQueryOp({ operator: "all" });
  /** No aliases */
  static In = new FilterQueryOp({ operator: "in" });
  /** No aliases */
  static IsTypeOf = new FilterQueryOp({ operator: "isof" });
}
FilterQueryOp.prototype._$typeName = "FilterQueryOp";
globalThis['x'] = FilterQueryOp.resolveSymbols();


/**
 BooleanQueryOp is an 'Enum' containing all of the valid  boolean
operators for an [[EntityQuery]].
**/
export class BooleanQueryOp extends BreezeEnum implements QueryOp {
  /** The operator for this enum. */
  operator: string;

  static And = new BooleanQueryOp({ operator: "and" });
  static Or = new BooleanQueryOp({ operator: "or" });
  static Not = new BooleanQueryOp({ operator: "not" });

}
BooleanQueryOp.prototype._$typeName = "BooleanQueryOp";
globalThis['x'] = BooleanQueryOp.resolveSymbols();


/** For use by breeze plugin authors only.  The class is used in most [[IUriBuilderAdapter]] implementations
@adapter (see [[IUriBuilderAdapter]])    
@hidden

An OrderByClause is a description of the properties and direction that the result
of a query should be sorted in.  OrderByClauses are immutable, which means that any
method that would modify an OrderByClause actually returns a new OrderByClause.

For example for an Employee object with properties of 'Company' and 'LastName' the following would be valid expressions:
>     let obc = new OrderByClause("Company.CompanyName, LastName")

or
>     let obc = new OrderByClause("Company.CompanyName desc, LastName")

or
>     let obc = new OrderByClause("Company.CompanyName, LastName", true);
*/
export class OrderByClause {
  /** @hidden @internal */
  items: OrderByItem[];

  constructor(propertyPaths: string[] | OrderByClause[], isDesc?: boolean) {
    if (propertyPaths.length === 0) {
      throw new Error("OrderByClause cannot be empty");
    }

    // you can also pass in an array of orderByClauses
    if (propertyPaths[0] instanceof OrderByClause) {
      let clauses = propertyPaths as OrderByClause[];
      this.items = core.arrayFlatMap(clauses, c => c.items);
      // this.items = Array.prototype.concat.apply(clauses[0].items, clauses.slice(1).map(core.pluck("items")));
      // this.items = Array.prototype.concat.apply([], clauses.map(core.pluck("items")));
    } else {
      this.items = (propertyPaths as string[]).map(function (pp) {
        return new OrderByItem(pp, isDesc);
      });
    }

  }

  validate(entityType: EntityType) {
    if (entityType == null || entityType.isAnonymous) return;
    this.items.forEach((item) => {
      item.validate(entityType);
    });
  }

  getComparer(entityType: EntityType) {
    let orderByFuncs = this.items.map(function (obc) {
      return obc.getComparer(entityType);
    });
    return function (entity1: any, entity2: any) {
      for (let i = 0; i < orderByFuncs.length; i++) {
        let result = orderByFuncs[i](entity1, entity2);
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    };
  }

  toJSONExt(context: EntityQueryJsonContext) {
    return this.items.map(function (item) {
      return context.propertyPathFn!(item.propertyPath) + (item.isDesc ? " desc" : "");
    });
  }

}

/** @hidden @internal */
export class OrderByItem {
  propertyPath: string;
  isDesc: boolean;
  lastProperty: EntityProperty;

  constructor(propertyPath: string, isDesc?: boolean) {
    if (!(typeof propertyPath === 'string')) {
      throw new Error("propertyPath is not a string");
    }
    propertyPath = propertyPath.trim();

    let parts = propertyPath.split(' ');
    // parts[0] is the propertyPath; [1] would be whether descending or not.
    // if (parts.length > 1 && isDesc !== true && isDesc !== false) {
    if (parts.length > 1 && isDesc == null) {
      isDesc = core.stringStartsWith(parts[1].toLowerCase(), "desc");
      if (!isDesc) {
        // isDesc is false but check to make sure its intended.
        let isAsc = core.stringStartsWith(parts[1].toLowerCase(), "asc");
        if (!isAsc) {
          throw new Error("the second word in the propertyPath must begin with 'desc' or 'asc'");
        }

      }
    }
    this.propertyPath = parts[0];
    this.isDesc = isDesc || false;
  }

  validate(entityType: EntityType): EntityProperty | undefined {
    if (entityType == null || entityType.isAnonymous) return;
    // will throw an exception on bad propertyPath
    this.lastProperty = entityType.getProperty(this.propertyPath, true) as EntityProperty;
    return this.lastProperty;
  }

  getComparer(entityType: EntityType) {
    let propDataType: DataType;
    let isCaseSensitive: boolean;
    if (!this.lastProperty) this.validate(entityType);
    if (this.lastProperty) {
      propDataType = (this.lastProperty as any).dataType;
      isCaseSensitive = this.lastProperty.parentType.metadataStore.localQueryComparisonOptions.isCaseSensitive;
    }

    let propertyPath = this.propertyPath;
    let isDesc = this.isDesc;

    return function (entity1: any, entity2: any) {
      let value1 = EntityAspect.getPropertyPathValue(entity1, propertyPath);
      let value2 = EntityAspect.getPropertyPathValue(entity2, propertyPath);
      let dataType = propDataType || (value1 && DataType.fromValue(value1)) || DataType.fromValue(value2);
      if (dataType === DataType.String) {
        if (isCaseSensitive) {
          value1 = value1 || "";
          value2 = value2 || "";
        } else {
          value1 = (value1 || "").toLowerCase();
          value2 = (value2 || "").toLowerCase();
        }
      } else {
        let normalize = DataType.getComparableFn(dataType);
        value1 = normalize(value1);
        value2 = normalize(value2);
      }
      if (value1 === value2) {
        return 0;
      } else if (value1 > value2 || value2 === undefined) {
        return isDesc ? -1 : 1;
      } else {
        return isDesc ? 1 : -1;
      }
    };
  }
}

/** For use by breeze plugin authors only.  The class is used in most [[IUriBuilderAdapter]] implementations
@adapter (see [[IUriBuilderAdapter]])    
@hidden 
**/
export class SelectClause {
  propertyPaths: string[];
  /** @hidden @internal */
  _pathNames: string[];

  constructor(propertyPaths: string[]) {
    this.propertyPaths = propertyPaths;
    this._pathNames = propertyPaths.map(function (pp) {
      return pp.replace(".", "_");
    });
  }

  validate(entityType: EntityType) {
    if (entityType == null || entityType.isAnonymous) return; // can't validate yet
    // will throw an exception on bad propertyPath
    this.propertyPaths.forEach(function (path) {
      entityType.getProperty(path, true);
    });
  }

  toFunction(/* config */) {
    let that = this;
    return function (entity: Entity) {
      let result = {};
      that.propertyPaths.forEach(function (path, i) {
        result[that._pathNames[i]] = EntityAspect.getPropertyPathValue(entity, path);
      });
      return result;
    };
  }

  toJSONExt(context: EntityQueryJsonContext) {
    return this.propertyPaths.map(function (pp) {
      return context.propertyPathFn!(pp);
    });
  }
}

/** For use by breeze plugin authors only.  The class is used in most [[IUriBuilderAdapter]] implementations
@adapter (see [[IUriBuilderAdapter]])    
@hidden 
**/
export class ExpandClause {
  propertyPaths: string[];

  constructor(propertyPaths: string[]) {
    this.propertyPaths = propertyPaths;
  }

  toJSONExt(context: EntityQueryJsonContext) {
    return this.propertyPaths.map(function (pp) {
      return context.propertyPathFn!(pp);
    });
  }

}


