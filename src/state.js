// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 *
 */
class State {
  constructor({
    // User provided props:
    stateName, // State Name
    onEnter = () => {}, // Callback to be called on entering state.
    onExit = () => {}, // Callback to be called on exiting state.
    handlers: publicHandlers = {}, // Event handlers which may be triggered from the state machine.
    privateHandlers = {}, // Event handlers which may only be triggered from the state's onEnter function.

    // State machine provided props:
    requestStateChange,
    setCanStateChange
  } = {}) {
    p(this).stateName = stateName;

    p(this).onEnter = onEnter;
    p(this).onExit = onExit;

    p(this).handlers = formatHandlers(this, publicHandlers, privateHandlers);
    
    p(this).requestStateChange = requestStateChange;
    p(this).setCanStateChange = setCanStateChange;
  }

  enter({fromState, toState, eventPayload, changeStatePayload}) {
    return p(this).onEnter(
      {fromState, toState, eventPayload, changeStatePayload},
      {
        disableStateChange: () => p(this).setCanStateChange(false),
        enableStateChange: () => p(this).setCanStateChange(true),
        handlePrivate: (eventName, eventPayload) => this.handle(eventName, eventPayload, true)
      }
    );
  }

  exit({fromState, toState, eventPayload, changeStatePayload}) {
    return p(this).onExit({fromState, toState, eventPayload, changeStatePayload});
  }

  handle(eventName, eventPayload, internalCall = false) {
    const meta = {fromState: p(this).stateName}; // Collection of useful data to output as response.

    const handler = p(this).handlers[eventName];

    if (meta.hasHandler = !!handler) {
      if (handler.isPrivate && !internalCall) throw new Error(`State "${p(this).stateName}" attempted to handle "${eventName}" externally. This event is registered to a privateHandler, and can only be triggered from within a state\'s onEnter function.`);
      meta.isPrivate = handler.isPrivate;

      const changeState = (stateName, changeStatePayload) => {
        meta.changeStateResult = p(this).requestStateChange({
          toState: stateName,
          eventPayload,
          changeStatePayload
        });

        meta.toState = stateName;
      }

      meta.handlerResult = handler.fn(
        changeState,
        {eventPayload},
        {
          disableStateChange: () => p(this).setCanStateChange(false),
          enableStateChange: () => p(this).setCanStateChange(true)
        }
      );
    }

    return meta;
  }
}


// Private Functions.


/**
 *
 */
function formatHandlers(state, publicHandlers, privateHandlers) {
  const formatted = {};

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



/**
 *
 */
module.exports = State;
