import { BreezeEnum} from './enum';

/** EntityAction is an 'Enum' containing all of the valid actions that can occur to an 'Entity'. 
 
*/

export class EntityAction extends BreezeEnum {

  /** Entity was attached via an AttachEntity call. */
  static Attach = new EntityAction( { _isAttach: true });
  /**  Entity was attached as a result of a query. */
  static AttachOnQuery = new EntityAction({ _isAttach: true});
  /**  Entity was attached as a result of an import. */
  static AttachOnImport = new EntityAction({ _isAttach: true});

  /** Entity was detached */
  static Detach = new EntityAction( { _isDetach: true });

  /** Properties on the entity were merged as a result of a query. */
  static MergeOnQuery = new EntityAction({ _isModification: true });
  /** Properties on the entity were merged as a result of an import. */
  static MergeOnImport = new EntityAction({ _isModification: true });
  /** Properties on the entity were merged as a result of a save */
  static MergeOnSave = new EntityAction({ _isModification: true });

  /** A property on the entity was changed. */
  static PropertyChange = new EntityAction({ _isModification: true});

  /** The EntityState of the entity was changed. */
  static EntityStateChange = new EntityAction();

  /** AcceptChanges was called on the entity, or its entityState was set to Unmodified. */
  static AcceptChanges = new EntityAction();
  /** RejectChanges was called on the entity. */
  static RejectChanges = new EntityAction({ _isModification: true});

  /** The EntityManager was cleared.  All entities detached. */
  static Clear = new EntityAction({ _isDetach: true});

  /** @hidden @internal */
  _isAttach?: boolean;
  /** @hidden @internal */
  _isDetach?: boolean;
  /** @hidden @internal */
  _isModification: boolean;
  /** Is this an 'attach' operation? ( Attach, AttachOnQuery or AttachOnImport) */
  isAttach() {
    return !!this._isAttach;
  }
  /** Is this a 'detach' operation? ( Detach, Clear) */
  isDetach() {
    return !!this._isDetach;
  }
  /** Is this a 'modification' operation? ( PropertyChange, MergeOnQuery, MergeOnSave, MergeOnImport, RejectChanges) */
  isModification() {
    return !!this._isModification;
  }
}
EntityAction.prototype._$typeName = "EntityAction";
EntityAction.resolveSymbols();



