import { core } from './core';
import { BreezeEnum } from './enum';
import { assertConfig } from './assert-param';

/**
MergeStrategy is an 'Enum' that determines how entities are merged into an EntityManager.

@class MergeStrategy
@static
**/
export class MergeStrategy extends BreezeEnum {

  /**
  MergeStrategy.PreserveChanges updates the cached entity with the incoming values unless the cached entity is in a changed
  state (added, modified, deleted) in which case the incoming values are ignored. The updated cached entity’s EntityState will
  remain [[EntityState.Unchanged]] unless you’re importing entities in which case the new EntityState will
  be that of the imported entities.
  **/
  static PreserveChanges = new MergeStrategy();
  /**
  MergeStrategy.OverwriteChanges always updates the cached entity with incoming values even if the entity is in
  a changed state (added, modified, deleted). After the merge, the pending changes are lost.
  The new EntityState will be  [[EntityState/Unchanged]] unless you’re importing entities
  in which case the new EntityState will be that of the imported entities.
  **/
  static OverwriteChanges = new MergeStrategy();

  /**
  SkipMerge is used to ignore incoming values. Adds the incoming entity to the cache only if there is no cached entity with the same key.
  This is the fastest merge strategy but your existing cached data will remain “stale”.
  **/
  static SkipMerge = new MergeStrategy();

  /**
  Disallowed is used to throw an exception if there is an incoming entity with the same key as an entity already in the cache.
  Use this strategy when you want to be sure that the incoming entity is not already in cache.
  This is the default strategy for EntityManager.attachEntity.
  **/
  static Disallowed = new MergeStrategy();


}
MergeStrategy.prototype._$typeName = "MergeStrategy";
globalThis['x'] = MergeStrategy.resolveSymbols();

/**
FetchStrategy is an 'Enum' that determines how and where entities are retrieved from as a result of a query.
**/
export class FetchStrategy extends BreezeEnum {

  /**
  FromServer is used to tell the query to execute the query against a remote data source on the server.
  **/
  static FromServer = new FetchStrategy();
  /**
  FromLocalCache is used to tell the query to execute the query against a local EntityManager instead of going to a remote server.
  **/
  static FromLocalCache = new FetchStrategy();

}
FetchStrategy.prototype._$typeName = "FetchStrategy";
globalThis['x'] = FetchStrategy.resolveSymbols();

/** Configuration info to be passed to the [[QueryOptions]] constructor. */
export interface QueryOptionsConfig {
  /** The [[FetchStrategy]] to use with any queries.*/
  fetchStrategy?: FetchStrategy;
  /** The [[MergeStrategy]] to use with any queries.*/
  mergeStrategy?: MergeStrategy;
  /** Whether to include cached deleted entities in a query result (false by default). __Read Only__ */
  includeDeleted?: boolean;
}

/**
A QueryOptions instance is used to specify the 'options' under which a query will occur.
**/
export class QueryOptions {
  /** @hidden @internal */
  _$typeName: string;
  /** The [[FetchStrategy]] to use with any queries. __Read Only__ */
  fetchStrategy: FetchStrategy;
  /** The [[MergeStrategy]] to use with any queries. __Read Only__ */
  mergeStrategy: MergeStrategy;
  /** Whether to include cached deleted entities in a query result (false by default). __Read Only__ */
  includeDeleted: boolean;

  /**
  The default instance for use whenever QueryOptions are not specified.
  **/
  static defaultInstance = new QueryOptions({
    fetchStrategy: FetchStrategy.FromServer,
    mergeStrategy: MergeStrategy.PreserveChanges,
    includeDeleted: false
  });

  /**
  QueryOptions constructor
  >     var newQo = new QueryOptions( { mergeStrategy: MergeStrategy.OverwriteChanges });
  >     // assume em1 is a preexisting EntityManager
  >     em1.setProperties( { queryOptions: newQo });
  Any QueryOptions property that is not defined will be defaulted from any QueryOptions defined at a higher level in the breeze hierarchy, i.e.
  -  from query.queryOptions
  -  to   entityManager.queryOptions
  -  to   QueryOptions.defaultInstance;

  @param config - A configuration object.
  **/
  constructor(config?: QueryOptionsConfig) {
    QueryOptions._updateWithConfig(this, config);
  }

  static resolve(queryOptionsArray: any[]) {
    return new QueryOptions(core.resolveProperties(queryOptionsArray, ["fetchStrategy", "mergeStrategy", "includeDeleted"]));
  }

  /**
  Returns a copy of this QueryOptions with the specified [[MergeStrategy]],
  [[FetchStrategy]], or 'includeDeleted' option applied.
  >     // Given an EntityManager instance, em
  >     var queryOptions = em.queryOptions.using(MergeStrategy.PreserveChanges);

  or
  >     var queryOptions = em.queryOptions.using(FetchStrategy.FromLocalCache);

  or
  >     var queryOptions = em.queryOptions.using({ mergeStrategy: MergeStrategy.OverwriteChanges });

  or
  >     var queryOptions = em.queryOptions.using({
  >        includeDeleted: true,
  >        fetchStrategy:  FetchStrategy.FromLocalCache 
  >     });
  @param config - A configuration object or a standalone [[MergeStrategy]] or [[FetchStrategy]] 
  @return A new QueryOptions instance.
  **/
  using(qoConfig: QueryOptionsConfig | MergeStrategy | FetchStrategy) {
    if (!qoConfig) return this;
    let result = new QueryOptions(this);
    if ( qoConfig instanceof MergeStrategy) {
      qoConfig = { mergeStrategy: qoConfig };
    } else if ( qoConfig instanceof FetchStrategy) {
      qoConfig = { fetchStrategy: qoConfig };
    }
    return QueryOptions._updateWithConfig(result, qoConfig);
  }

  /**
  Sets the 'defaultInstance' by creating a copy of the current 'defaultInstance' and then applying all of the properties of the current instance.
  The current instance is returned unchanged.
  >     var newQo = new QueryOptions( { mergeStrategy: MergeStrategy.OverwriteChanges });
  >     newQo.setAsDefault();
  **/
  setAsDefault() {
    return core.setAsDefault(this, QueryOptions);
  }

  toJSON() {
    return core.toJson(this, {
      fetchStrategy: null,
      mergeStrategy: null,
      includeDeleted: false
    });
  }

  static fromJSON(json: any) {
    return new QueryOptions({
      fetchStrategy: FetchStrategy.fromName(json.fetchStrategy),
      mergeStrategy: MergeStrategy.fromName(json.mergeStrategy),
      includeDeleted: json.includeDeleted === true
    });
  }

  /** @hidden @internal */
  private static _updateWithConfig(obj: QueryOptions, config?: QueryOptionsConfig) {
    if (config) {
      assertConfig(config)
        .whereParam("fetchStrategy").isEnumOf(FetchStrategy).isOptional()
        .whereParam("mergeStrategy").isEnumOf(MergeStrategy).isOptional()
        .whereParam("includeDeleted").isBoolean().isOptional()
        .applyAll(obj);
    }
    return obj;
  }

}
QueryOptions.prototype._$typeName = "QueryOptions";
