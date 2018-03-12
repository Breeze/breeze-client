import { core } from './core';
import { assertConfig } from './assert-param';
import { DataService } from './data-service';

/** Configuration info to be passed to the [[SaveOptions]] constructor */
export interface SaveOptionsConfig {
  /** Resource name to be used during the save - this defaults to "SaveChanges" */
  resourceName?: string;
  /** The DataService to be used for this save. */
  dataService?: DataService;
  /** Whether multiple saves can be in-flight at the same time. The default is false. */
  allowConcurrentSaves?: boolean;
  /** Free form value that will be sent to the server during the save. */
  tag?: any;
}

/**
A SaveOptions instance is used to specify the 'options' under which a save will occur.
**/
export class SaveOptions {
  /** @hidden @internal */
  _$typeName: string; // on proto
  /** Resource name to be used during the save - this defaults to "SaveChanges". __Read Only__ */
  resourceName: string;
  /** The DataService to be used for this save. __Read Only__ */
  dataService: DataService;
  /** Whether multiple saves can be in-flight at the same time. The default is false. __Read Only__ */
  allowConcurrentSaves: boolean;
  /** Free form value that will be sent to the server during the save. __Read Only__ */
  tag: any;

  /** The default value whenever SaveOptions are not specified. */
  static defaultInstance = new SaveOptions({ allowConcurrentSaves: false});

  constructor(config: SaveOptionsConfig) {
    SaveOptions._updateWithConfig(this, config);
  }


  /**
  Sets the 'defaultInstance' by creating a copy of the current 'defaultInstance' and then applying all of the properties of the current instance.
  The current instance is returned unchanged.
  **/
  setAsDefault() {
    return core.setAsDefault(this, SaveOptions);
  }

  /**
  Returns a copy of this SaveOptions with the specified config options applied.
  >     var saveOptions = em1.saveOptions.using( {resourceName: "anotherResource" });
  **/
  using(config: SaveOptionsConfig) {
    return SaveOptions._updateWithConfig(this, config);
  }

  /** @hidden @internal */
  private static _updateWithConfig(obj: SaveOptions, config: SaveOptionsConfig) {
    if (config) {
      assertConfig(config)
          .whereParam("resourceName").isOptional().isString()
          .whereParam("dataService").isOptional().isInstanceOf(DataService)
          .whereParam("allowConcurrentSaves").isBoolean().isOptional()
          .whereParam("tag").isOptional()
          .applyAll(obj);
    }
    return obj;
  }

}
SaveOptions.prototype._$typeName = "SaveOptions";



