import {
  StateName,
  EventName,
  OnEnter,
  OnExit,
  Handler,
  StateConfig,
  HandlerObj,
  StateChangeHookMeta,
  HandlePrivate,
  StatePrivateNamespace
} from './types';

const namespace: WeakMap<State, StatePrivateNamespace> = new WeakMap();
function p(self: State): StatePrivateNamespace {
  if (!namespace.has(self)) namespace.set(self, {} as StatePrivateNamespace);
  return namespace.get(self) as StatePrivateNamespace;
}

/**
 *
 */
export default class State {
  constructor({
    // User provided props:
    stateName, // State Name
    onEnter = () => {}, // Callback to be called on entering state.
    onExit = () => {}, // Callback to be called on exiting state.
    onEnterFrom = {}, // Callbacks keyed by state to be called when entering this state, when arriving from the keyed state.
    onExitTo = {}, // Callbacks keyed by state to be called when exiting this state, when leaving to the keyed state.
    handlers: publicHandlers = {}, // Event handlers which may be triggered from the state machine.
    privateHandlers = {}, // Event handlers which may only be triggered from the state's onEnter function.

    beforeHandle, // Callback to be called prior to handlers
    afterHandle, // Callback to be called after handlers
  }: StateConfig = {} as StateConfig) {
    p(this).stateName = stateName;

    p(this).onEnter = onEnter;
    p(this).onExit = onExit;
    p(this).onEnterFrom = onEnterFrom;
    p(this).onExitTo = onExitTo;

    p(this).handlerMiddleware = {
      before: beforeHandle,
      after: afterHandle,
    };

    p(this).handlers = _formatHandlers(this, publicHandlers, privateHandlers);
  }

  enter(
    {fromStateName, toStateName, eventPayload, changeStatePayload}: StateChangeHookMeta,
    {handlePrivate}: {handlePrivate: HandlePrivate}
  ): {
    onEnterFrom?: {
      state: StateName;
      result: ReturnType<OnEnter>;
    };
    onEnter: ReturnType<OnEnter>;
  } {
    const result: any = {};

    const onEnterFrom = p(this).onEnterFrom[fromStateName];
    if (onEnterFrom) {
      result.onEnterFrom = {
        state: fromStateName,
        result: onEnterFrom(
          {fromStateName, toStateName, eventPayload, changeStatePayload},
          {handlePrivate}
        )
      };
    }
    result.onEnter = p(this).onEnter(
      {fromStateName, toStateName, eventPayload, changeStatePayload},
      {handlePrivate}
    );

    return result;
  }

  exit({fromStateName, toStateName, eventPayload, changeStatePayload}: StateChangeHookMeta): {
    onExitTo?: {
      state: StateName;
      result: ReturnType<OnExit>;
    };
    onExit: ReturnType<OnExit>;
  } {
    const result: any = {};

    const onExitTo = p(this).onExitTo[toStateName];
    if (onExitTo) {
      result.onExitTo = {
        state: toStateName,
        result: onExitTo({fromStateName, toStateName, eventPayload, changeStatePayload})
      };
    }
    result.onExit = p(this).onExit({fromStateName, toStateName, eventPayload, changeStatePayload});

    return result;
  }

  beforeHandle(meta: any) {
    const before = p(this).handlerMiddleware.before;
    return before && before(meta);
  }

  afterHandle(meta: any) {
    const after = p(this).handlerMiddleware.after;
    return after && after(meta);
  }

  getHandler(eventName: EventName) {
    return p(this).handlers[eventName];
  }
}


// Private Functions.


/**
 *
 */
function _formatHandlers(
  state: State,
  publicHandlers: {[KEventName in EventName]: Handler},
  privateHandlers: {[KEventName in EventName]: Handler},
) {
  const formatted: {[KEventName in EventName]: HandlerObj} = {};

  [publicHandlers, privateHandlers].forEach((handlers, i) => {
    const isPrivate = i === 1;
    Object.keys(handlers).forEach(eventName => {
      if (formatted[eventName]) throw new Error(`Attempted to add multiple handlers to "${p(state).stateName}" for "${eventName}."`);
      formatted[eventName] = {
        fn: handlers[eventName],
        isPrivate
      };
    });
  });

  return formatted;
}
