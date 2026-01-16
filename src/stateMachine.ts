import { EventEmitter } from 'events';

import State from './state';
import {
  StateName,
  StateMachineConfig,
  EventName,
  EventPayload,
  StateMachinePrivateNamespace,
  StateChangeMeta,
  EventMeta,
  HandleMeta,
  ChangeStatePayload,
  HandlerObj,
  HandleStateChangeResult,
  StateChangeHandler,
  AddStateConfig,
  EventPayloadMap,
  DefaultEventPayloadMap,
  TypedAddStateConfig,
  TypedHandlePrivate
} from './types';

import { EVENT_NAME } from './constants';

// Default States
const BOOT = '_boot';

const namespace: WeakMap<StateMachine<any, any>, StateMachinePrivateNamespace> = new WeakMap();
function p(self: StateMachine<any, any>): StateMachinePrivateNamespace {
  if (!namespace.has(self)) namespace.set(self, {} as StateMachinePrivateNamespace);
  return namespace.get(self) as StateMachinePrivateNamespace;
}


/**
 * A finite state machine with optional typed event payloads.
 *
 * @typeParam TPublicEvents - Map of public event names to their payload types
 * @typeParam TPrivateEvents - Map of private event names to their payload types
 *
 * @example
 * // Typed usage:
 * type PublicEvents = { login: { username: string }; logout: void };
 * type PrivateEvents = { validate: { token: string } };
 * const sm = new StateMachine<PublicEvents, PrivateEvents>();
 *
 * // Untyped usage (backward compatible):
 * const sm = new StateMachine();
 */
export default class StateMachine<
  TPublicEvents extends EventPayloadMap = DefaultEventPayloadMap,
  TPrivateEvents extends EventPayloadMap = DefaultEventPayloadMap
> {
  constructor({
    // Allow active stateName to be written to external store.
    writeActiveStateName = (stateName) => p(this).activeStateName = stateName,
    // Allow active stateName to be read from external store.
    readActiveStateName = () => p(this).activeStateName
  }: StateMachineConfig = {} as StateMachineConfig) {
    p(this).states = {};

    p(this).emitter = new EventEmitter();

    p(this).writeActiveStateName = writeActiveStateName;
    p(this).readActiveStateName = readActiveStateName;

    p(this).stateChangeCount = 0;

    p(this).hasInitialized = false;
  }

  /**
   * Initializes the state machine by creating a boot state which transitions
   * to the provided state immediately.
   */
  init(stateName: StateName) {
    if (p(this).hasInitialized) throw new Error(`Unable to initialize state machine, has already initialized.`);
    p(this).hasInitialized = true;

    _writeActiveStateName(this, BOOT);
    this.addState(BOOT, {
      handlers: {
        initialize: (changeState) => changeState(stateName)
      }
    });

    // Internal event for boot state - use type assertion since 'initialize' is not a user-defined event
    return (this.handle as (eventName: string, eventPayload?: any) => Promise<HandleMeta>)('initialize');
  }

  /**
   * Handle an event within the context of the active state, executing any active
   * event handlers.
   *
   * When the state machine is typed, this method enforces correct payload types:
   * - Events with `void` payload don't require a second argument
   * - Events with defined payload types require the correct payload
   *
   * @example
   * // Typed state machine
   * type Events = { login: { user: string }; logout: void };
   * const sm = new StateMachine<Events>();
   * sm.handle('login', { user: 'john' }); // OK
   * sm.handle('logout'); // OK, no payload needed
   * sm.handle('login', { wrong: 'type' }); // Type error!
   */
  handle<TEventName extends keyof TPublicEvents & string>(
    eventName: TEventName,
    ...args: TPublicEvents[TEventName] extends void
      ? [eventPayload?: undefined]
      : [eventPayload: TPublicEvents[TEventName]]
  ): Promise<HandleMeta> {
    return _handleEvent(this, {
      activeStateName: _readActiveStateName(this),
      eventName,
      eventPayload: args[0],
      isPrivate: false,
      stateChangeCountSnapshot: p(this).stateChangeCount
    });
  }

  /**
   *
   */
   getActiveStateName() {
    return _readActiveStateName(this);
  }

  /**
   *
   */
   getPreviousStateName() {
    return p(this).previousStateName;
  }

  /**
   * Register an event handler to be notifed on state changes.
   */
  onStateChange(callback: StateChangeHandler) {
    p(this).emitter.on(EVENT_NAME.STATE_CHANGE, callback);
  }

  /**
   * Register an event handler to be notified on errors.
   */
  onError(callback: (err: Error) => void) {
    p(this).emitter.on(EVENT_NAME.ERROR, callback);
  }

  /**
   * Register a new state configuration with the state machine.
   *
   * When the state machine is typed, handlers receive typed payloads:
   *
   * @example
   * type Events = { login: { user: string; pass: string } };
   * const sm = new StateMachine<Events>();
   * sm.addState('loggedOut', {
   *   handlers: {
   *     login: (changeState, { eventPayload }) => {
   *       // eventPayload is typed as { user: string; pass: string }
   *       console.log(eventPayload.user);
   *       changeState('loggedIn');
   *     }
   *   }
   * });
   */
  addState(stateName: StateName, config: TypedAddStateConfig<TPublicEvents, TPrivateEvents> = {}) {
    if (!stateName) throw new Error(`Cannot add state, no stateName provided.`);
    if (p(this).states[stateName]) throw new Error(`Cannot add state "${stateName}" to state machine, a state with that name already exists.`);


    const state = new State({
      ...config as AddStateConfig,
      stateName
    });

    p(this).states[stateName] = state;
  }
}


// Private Functions.

function _validateEventHandling(sm: StateMachine<any, any>, eventMeta: EventMeta, handler: HandlerObj) {
  const activeStateName = _readActiveStateName(sm);
  if (!activeStateName) throw new Error(`Unable to handle "${eventMeta.eventName}," state machine has not yet been initialized.`);

  if (handler.isPrivate && !eventMeta.isPrivate) throw new Error(`Unable to handle "${eventMeta.eventName}," the handler defined for this event in "${activeStateName}" is private. This means that it can only be called from a "handlePrivate function passed into the state's own methods.`);

  const currentStateChangeCount = p(sm).stateChangeCount;
  const stateChangesSinceDispatch = currentStateChangeCount - eventMeta.stateChangeCountSnapshot;
  if (stateChangesSinceDispatch) {
    p(sm).emitter.emit(EVENT_NAME.ERROR, new Error(`Unable to handle "${eventMeta.eventName}," ${stateChangesSinceDispatch} state changes have occurred since this was dispatched.`));
  }

  // Should not logically be possible, likely redundant.
  if (activeStateName !== eventMeta.activeStateName) p(sm).emitter.emit(EVENT_NAME.ERROR, new Error(`Unable to handle "${eventMeta.eventName}," event was fired while in "${eventMeta.activeStateName}," currently in "${activeStateName}."`));
}

function _handleEvent(sm: StateMachine<any, any>, eventMeta: EventMeta): Promise<HandleMeta> {
  // Although we do not await any asynchronous behavior, we wrap this in a promise
  // so that it will execute on next tick. This ensures that any events dispatched
  // within the handler or state change will not be dealt with until any synchronous
  // state changes or other synchronous event behaviors are finished.
  const promise: Promise<HandleMeta> = new Promise((resolve, reject) => {
    setImmediate(() => {
      const activeState = p(sm).states[eventMeta.activeStateName];

      const stateChangeCountSnapshot = p(sm).stateChangeCount;

      const handler = activeState.getHandler(eventMeta.eventName);

      const meta: any = {
        hasHandler: !!handler,
      };
      meta.beforeHandleResult = activeState.beforeHandle({...meta, ...eventMeta});

      if (meta.hasHandler && meta.beforeHandleResult !== false) {
        meta.isPrivate = handler.isPrivate;

        _validateEventHandling(sm, eventMeta, handler);

        const changeStateClosure = (toStateName: StateName, changeStatePayload: ChangeStatePayload) => {
          meta.changeStateResult = _handleChangeState(sm, {toStateName, changeStatePayload}, eventMeta);
        }

        meta.handlerResult = handler.fn(
          changeStateClosure,
          { eventPayload: eventMeta.eventPayload },
          {
            handlePrivate: (eventName, eventPayload) => _handleEvent(sm, {
              activeStateName: eventMeta.activeStateName,
              eventName,
              eventPayload,
              isPrivate: true,
              stateChangeCountSnapshot
            }),
            get activeStateName() {
              return sm.getActiveStateName();
            },
            get previousStateName() {
              return sm.getPreviousStateName();
            },
          },
        );

        meta.beforeHandleResult = activeState.afterHandle({...meta, ...eventMeta});
      }

      resolve(meta);
    });
  });

  return promise.then((meta) => {
    // If state change occurred, emit event.
    if (meta.changeStateResult) p(sm).emitter.emit(EVENT_NAME.STATE_CHANGE, meta);
    return meta;
  });
}

/**
 * Generates error messages for various invalid state change conditions.
 */
function _validateStateChange(
  sm: StateMachine<any, any>,
  {activeStateName, toStateName, fromStateName, nextState}: StateChangeMeta,
  eventMeta: EventMeta
) {
  if (toStateName === BOOT) return `Cannot change state to the boot state. "${BOOT}" is a reserved state name.`;
  
  const currentStateChangeCount = p(sm).stateChangeCount;
  const stateChangesSinceDispatch = currentStateChangeCount - eventMeta.stateChangeCountSnapshot;
  if (stateChangesSinceDispatch) {
    return `Unable to change state from "${fromStateName}" to "${toStateName}," ${stateChangesSinceDispatch} state changes have occurred since the enclosing event handler was dispatched.`;
  }

  // Should not logically be possible, likely redundant.
  if (activeStateName !== fromStateName) return `Cannot change state from "${fromStateName}" to "${toStateName}," currently in "${activeStateName}."`;

  if (!nextState) return `Cannot change state from "${fromStateName}" to "${toStateName}," "${toStateName}" is not a defined state.`;
}


function _handleChangeState(
  sm: StateMachine<any, any>,
  {
    toStateName,
    changeStatePayload,
  }: {
    toStateName: StateName,
    changeStatePayload: ChangeStatePayload,
  },
  eventMeta: EventMeta
): HandleStateChangeResult | void {
  const fromStateName = eventMeta.activeStateName;
  const activeStateName = _readActiveStateName(sm);
  const nextState = p(sm).states[toStateName];

  const validationErrorMessage = _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState}, eventMeta);
  if (validationErrorMessage) return p(sm).emitter.emit(EVENT_NAME.ERROR, new Error(validationErrorMessage));

  const result: any = {fromStateName, toStateName};

  const currentState = p(sm).states[activeStateName];

  // We increment the state change count to prevent any delayed state changes or event dispatches from being
  // handled.
  const newStateChangeCount = ++p(sm).stateChangeCount;


  // Exit current state.
  if (currentState) result.exit = currentState.exit({
    fromStateName,
    toStateName,
    eventPayload: eventMeta.eventPayload,
    changeStatePayload
  });

  p(sm).previousStateName = activeStateName;
  _writeActiveStateName(sm, toStateName);

  // Enter next state.
  result.enter = nextState.enter({
    fromStateName,
    toStateName,
    eventPayload: eventMeta.eventPayload,
    changeStatePayload
  }, {
    handlePrivate: (eventName: EventName, eventPayload: EventPayload) => _handleEvent(sm, {
      activeStateName: toStateName,
      eventName,
      eventPayload,
      isPrivate: true,
      stateChangeCountSnapshot: newStateChangeCount
    })
  });

  return result;
}


/**
 * Writes the active stateName using the provided or default storage mechanism.
 */
function _writeActiveStateName(sm: StateMachine<any, any>, stateName: StateName) {
  if (stateName !== BOOT && !p(sm).states[stateName]) throw new Error(`Attempted to set ${stateName} as activeStateName, but no such state is defined.`);
  p(sm).writeActiveStateName(stateName);
  const readStateName = _readActiveStateName(sm);
  if (stateName !== readStateName) throw new Error(`Issue encountered with provided writeActiveStateName/readActiveStateName functions. The read state did not produce the expected stateName immediately following a write. Got "${readStateName}," expected "${stateName}."`);
  return readStateName;
}


/**
 * Reads the active stateName using the provided read mechanism.
 */
function _readActiveStateName(sm: StateMachine<any, any>) {
  return p(sm).readActiveStateName();
}
