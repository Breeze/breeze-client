import { core } from './core';
import { assertConfig } from './assert-param';
import { config } from './config';


/** Configuration info to be passed to the [[LocalQueryComparisonOptions]] constructor. */
export interface LocalQueryComparisonOptionsConfig {
  /** The name of this collection of configuration settings. */
  name?: string;
  /** Whether predicates that involve strings will be interpreted in a "caseSensitive" manner. Default is 'false'. */
  isCaseSensitive?: boolean;
  /* Whether or not to enforce the ANSI SQL standard
  of padding strings of unequal lengths before comparison with spaces. Note that per the standard, padding only occurs with equality and
  inequality predicates, and not with operations like 'startsWith', 'endsWith' or 'contains'.  Default is true. */
  usesSql92CompliantStringComparison?: boolean;
}

/**
A LocalQueryComparisonOptions instance is used to specify the "comparison rules" used when performing "local queries" in order
to match the semantics of these same queries when executed against a remote service.  These options should be set based on the
manner in which your remote service interprets certain comparison operations.

The default LocalQueryComparisonOptions stipulates 'caseInsensitive" queries with ANSI SQL rules regarding comparisons of unequal
length strings.
**/
export class LocalQueryComparisonOptions {
  /** @hidden @internal */
  _$typeName: string; // on prototype
  /** The name for this instance. */
  name: string;
  /** Whether predicates that involve strings will be interpreted in a "caseSensitive" manner. (default = false).  */
  isCaseSensitive: boolean;
  /* Whether or not to enforce the ANSI SQL standard
  of padding strings of unequal lengths before comparison with spaces. Note that per the standard, padding only occurs with equality and
  inequality predicates, and not with operations like 'startsWith', 'endsWith' or 'contains'.  Default is true. */
  usesSql92CompliantStringComparison: boolean;

  /**
  LocalQueryComparisonOptions constructor
  >      // create a 'caseSensitive - non SQL' instance.
  >      var lqco = new LocalQueryComparisonOptions({
  >              name: "caseSensitive-nonSQL"
  >              isCaseSensitive: true;
  >              usesSql92CompliantStringComparison: false;
  >          });
  >      // either apply it globally
  >      lqco.setAsDefault();
  >      // or to a specific MetadataStore
  >      var ms = new MetadataStore({ localQueryComparisonOptions: lqco });
  >      var em = new EntityManager( { metadataStore: ms });
  @param config - A configuration object.
  **/
  constructor(lqcoConfig: LocalQueryComparisonOptionsConfig) {
    assertConfig(lqcoConfig || {})
        .whereParam("name").isOptional().isString()
        .whereParam("isCaseSensitive").isOptional().isBoolean()
        .whereParam("usesSql92CompliantStringComparison").isBoolean()
        .applyAll(this);
    if (!this.name) {
      this.name = core.getUuid();
    }
    config._storeObject(this, "LocalQueryComparisonOptions", this.name);
  }

  /**
  Case insensitive SQL compliant options - this is also the default unless otherwise changed.
  **/
  static caseInsensitiveSQL = new LocalQueryComparisonOptions({
    name: "caseInsensitiveSQL",
    isCaseSensitive: false,
    usesSql92CompliantStringComparison: true
  });

  /**
  The default value whenever LocalQueryComparisonOptions are not specified. By default this is 'caseInsensitiveSQL'.
  **/
  static defaultInstance = new LocalQueryComparisonOptions(LocalQueryComparisonOptions.caseInsensitiveSQL);

  /**
  Sets the 'defaultInstance' by creating a copy of the current 'defaultInstance' and then applying all of the properties of the current instance.
  The current instance is returned unchanged.
  >     var lqco = new LocalQueryComparisonOptions({
  >        isCaseSensitive: false;
  >        usesSql92CompliantStringComparison: true;
  >     });
  >     lqco.setAsDefault();
  **/
  setAsDefault() {
    return core.setAsDefault(this, LocalQueryComparisonOptions);
  }

}
LocalQueryComparisonOptions.prototype._$typeName = "LocalQueryComparisonOptions";
