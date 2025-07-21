import { assertConfig } from './assert-param';
import { core } from './core';
import { config } from './config';

// TODO: strongly type context object passed to naming convention converter fns.

/** Configuration info to be passed to the [[NamingConvention]] constructor */
export interface NamingConventionConfig {
  /** The name of this NamingConvention */
  name?: string;
  /** Function that takes a server property name add converts it into a client side property name.  */
  serverPropertyNameToClient?: (nm: string, context?: any) => string;
  /** Function that takes a client property name add converts it into a server side property name. */
  clientPropertyNameToServer?: (nm: string, context?: any) => string;
}

/**
A NamingConvention instance is used to specify the naming conventions under which a MetadataStore
will translate property names between the server and the javascript client.

The default NamingConvention does not perform any translation, it simply passes property names thru unchanged.
@dynamic
**/
export class NamingConvention {
  /** @hidden @internal */
  declare _$typeName: string;
  /** The name of this NamingConvention. __Read Only__ */
  declare name: string;
  /** Function that takes a server property name add converts it into a client side property name.  __Read Only__ */
  serverPropertyNameToClient: (nm: string, context?: any) => string;
  /** Function that takes a client property name add converts it into a server side property name. __Read Only__ */
  clientPropertyNameToServer: (nm: string, context?: any) => string;

  /**
  NamingConvention constructor
  >      // A naming convention that converts the first character of every property name to uppercase on the server
  >      // and lowercase on the client.
  >      var namingConv = new NamingConvention({
  >          serverPropertyNameToClient: function(serverPropertyName) {
  >              return serverPropertyName.substr(0, 1).toLowerCase() + serverPropertyName.substr(1);
  >          },
  >          clientPropertyNameToServer: function(clientPropertyName) {
  >              return clientPropertyName.substr(0, 1).toUpperCase() + clientPropertyName.substr(1);
  >          }            
  >      });
  >      var ms = new MetadataStore({ namingConvention: namingConv });
  >      var em = new EntityManager( { metadataStore: ms });
  **/
  constructor(ncConfig: NamingConventionConfig ) {
    assertConfig(ncConfig || {})
        .whereParam("name").isOptional().isString()
        .whereParam("serverPropertyNameToClient").isFunction()
        .whereParam("clientPropertyNameToServer").isFunction()
        .applyAll(this);
    if (!this.name) {
      this.name = core.getUuid();
    }
    config._storeObject(this, "NamingConvention", this.name);
  }

  /**


  /**
  A noop naming convention - This is the default unless another is specified.
  **/
  static none = new NamingConvention({
    name: "noChange",
    serverPropertyNameToClient: (serverPropertyName) => {
      return serverPropertyName;
    },
    clientPropertyNameToServer: (clientPropertyName) => {
      return clientPropertyName;
    }
  });

  /**
  The "camelCase" naming convention - This implementation only lowercases the first character of the server property name
  but leaves the rest of the property name intact.  If a more complicated version is needed then one should be created via the ctor.
  **/
  static camelCase = new NamingConvention({
    name: "camelCase",
    serverPropertyNameToClient: (serverPropertyName) => {
      return serverPropertyName.substr(0, 1).toLowerCase() + serverPropertyName.substr(1);
    },
    clientPropertyNameToServer: (clientPropertyName) => {
      return clientPropertyName.substr(0, 1).toUpperCase() + clientPropertyName.substr(1);
    }
  });

  /**
  The default value whenever NamingConventions are not specified.
  **/
  static defaultInstance = new NamingConvention(NamingConvention.none);

  /**
  Sets the 'defaultInstance' by creating a copy of the current 'defaultInstance' and then applying all of the properties of the current instance.
  The current instance is returned unchanged.
  >      var namingConv = new NamingConvention({
  >          serverPropertyNameToClient: function(serverPropertyName) {
  >              return serverPropertyName.substr(0, 1).toLowerCase() + serverPropertyName.substr(1);
  >          },
  >          clientPropertyNameToServer: function(clientPropertyName) {
  >              return clientPropertyName.substr(0, 1).toUpperCase() + clientPropertyName.substr(1);
  >          }            
  >      });
  >      namingConv.setAsDefault();
  **/
  setAsDefault() {
    return core.setAsDefault(this, NamingConvention);
  }

}

NamingConvention.prototype._$typeName = "NamingConvention";




