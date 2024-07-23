import { BreezeEnum } from './enum';

/**
EntityState is an 'Enum' containing all of the valid states for an 'Entity'.
**/
export class EntityState extends BreezeEnum {

  /** The 'Unchanged' state. **/
  static Unchanged = new EntityState();
  /**  The 'Added' state.  **/
  static Added = new EntityState();
  /**  The 'Modified' state.   **/
  static Modified = new EntityState();
  /**  The 'Deleted' state.  **/
  static Deleted = new EntityState();
  /**  The 'Detached' state.  **/
  static Detached = new EntityState();

  /**
  Returns whether an entityState instance is EntityState.Unchanged.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isUnchanged();

  is the same as
  >     return es === EntityState.Unchanged;
  **/
  isUnchanged() {
    return this === EntityState.Unchanged;
  }

  /**
  Return whether an entityState instance is EntityState.Added.
  
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isAdded();

  is the same as
  >     return es === EntityState.Added;
  **/
  isAdded() {
    return this === EntityState.Added;
  }

  /**
  Returns whether an entityState instance is EntityState.Modified.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isModified();

  is the same as
  >     return es === EntityState.Modified;
  **/
  isModified() {
    return this === EntityState.Modified;
  }

  /**
  Returns whether an entityState instance is EntityState.Deleted.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isDeleted();

  is the same as
  
  >     return es === EntityState.Deleted;
  **/
  isDeleted() {
    return this === EntityState.Deleted;
  }

  /**
  Returns whether an entityState instance is EntityState.Detached.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isDetached();

  is the same as
  >     return es === EntityState.Detached;
  **/
  isDetached() {
    return this === EntityState.Detached;
  }

  /** Return true if EntityState is Deleted or Detached */
  isDeletedOrDetached() {
    return this === EntityState.Detached || this === EntityState.Detached;
  }

  /**
  Returns whether an entityState instance is EntityState.Unchanged or EntityState.Modified.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isUnchangedOrModified();

  is the same as
  >     return es === EntityState.Unchanged || es === EntityState.Modified
  **/
  isUnchangedOrModified() {
    return this === EntityState.Unchanged || this === EntityState.Modified;
  }

  /** Return true if EntityStatis is Added or Modified */
  isAddedOrModified() {
    return this === EntityState.Added || this === EntityState.Modified;
  }

  /** Returns whether an entityState instance is EntityState.Added or EntityState.Modified or EntityState.Deleted.
  >     var es = anEntity.entityAspect.entityState;
  >     return es.isAddedModifiedOrDeleted();

  is the same as
  >     return es === EntityState.Added || es === EntityState.Modified || es === EntityState.Deleted
  **/
  isAddedModifiedOrDeleted() {
    return this === EntityState.Added ||
      this === EntityState.Modified ||
      this === EntityState.Deleted;
  }

}
EntityState.prototype._$typeName = "EntityState";
Error['x'] = EntityState.resolveSymbols();
