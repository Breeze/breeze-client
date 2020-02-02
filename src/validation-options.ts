import { core  } from './core';
import { assertConfig } from './assert-param';

/** Configuration info to be passed to the [[ValidationOptions]] constructor */
export interface ValidationOptionsConfig {
  /** Whether entity and property level validation should occur when entities are attached to the EntityManager 
  other than via a query. (default = true) */
  validateOnAttach?: boolean;
  /**  Whether entity and property level validation should occur before entities are saved. 
  A failed validation will force the save to fail early. (default = true)  */
  validateOnSave?: boolean;
  /** Whether entity and property level validation should occur after entities are queried from a remote server.
  (default = false)  **/
  validateOnQuery?: boolean;
  /** Whether property level validation should occur after entities are modified.
  (default = true)  **/
  validateOnPropertyChange?: boolean;
}

/**
A ValidationOptions instance is used to specify the conditions under which validation will be executed.

*/
export class ValidationOptions implements ValidationOptionsConfig {
  /** @hidden @internal */
  _$typeName: string; // on proto
  /** Whether entity and property level validation should occur when entities are attached to the EntityManager 
  other than via a query. (default = true) __Read Only__ */
  validateOnAttach: boolean;
  /** Whether entity and property level validation should occur before entities are saved. 
  A failed validation will force the save to fail early. (default = true) __Read Only__ */
  validateOnSave: boolean;
  /** Whether entity and property level validation should occur after entities are queried from a remote server.
  (default = false) __Read Only__  **/
  validateOnQuery: boolean;
  /** Whether property level validation should occur after entities are modified.
  (default = true) __Read Only__ **/
  validateOnPropertyChange: boolean;



  /** 
  ValidationOptions constructor
  >     var newVo = new ValidationOptions( { validateOnSave: false, validateOnAttach: false });
  >     // assume em1 is a preexisting EntityManager
  >     em1.setProperties( { validationOptions: newVo });
  @param config - A configuration object.
  **/
  constructor(config?: ValidationOptionsConfig) {
    updateWithConfig(this, config);
  }


  /**
  Returns a copy of this ValidationOptions with changes to the specified config properties.
  >     var validationOptions = new ValidationOptions();
  >     var newOptions = validationOptions.using( { validateOnQuery: true, validateOnSave: false} );
  @param config - A configuration object
  @return A new ValidationOptions instance.
  **/
  using(config: ValidationOptionsConfig) {
    if (!config) return this;
    let result = new ValidationOptions(this);
    updateWithConfig(result, config);
    return result;
  }

  /**
  Sets the 'defaultInstance' by creating a copy of the current 'defaultInstance' and then applying all of the properties of the current instance.
  The current instance is returned unchanged.
  >     var validationOptions = new ValidationOptions()
  >     var newOptions = validationOptions.using( { validateOnQuery: true, validateOnSave: false} );
  >     var newOptions.setAsDefault();
  **/
  setAsDefault() {
    return core.setAsDefault(this, ValidationOptions);
  }

  /**
  The default instance for use whenever ValidationOptions are not specified.
  **/
  static defaultInstance = new ValidationOptions({
    validateOnAttach: true,
    validateOnSave: true,
    validateOnQuery: false,
    validateOnPropertyChange: true
  });
}
ValidationOptions.prototype._$typeName = "ValidationOptions";

function updateWithConfig(options: ValidationOptions, config: ValidationOptionsConfig) {
  if (config) {
    assertConfig(config)
        .whereParam("validateOnAttach").isBoolean().isOptional()
        .whereParam("validateOnSave").isBoolean().isOptional()
        .whereParam("validateOnQuery").isBoolean().isOptional()
        .whereParam("validateOnPropertyChange").isBoolean().isOptional()
        .applyAll(options);
  }
  return options;
}
