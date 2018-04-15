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
    requestStateChange
  } = {}) {
    p(this).stateName = stateName;

    p(this).onEnter = onEnter;
    p(this).onExit = onExit;

    p(this).handlers = _formatHandlers(this, publicHandlers, privateHandlers);
    
    p(this).requestStateChange = requestStateChange;

  }

  enter(
    {fromStateName, toStateName, eventPayload, changeStatePayload},
    {handlePrivate}
  ) {
    return p(this).onEnter(
      {fromStateName, toStateName, eventPayload, changeStatePayload},
      {handlePrivate}
    );
  }

  exit({fromStateName, toStateName, eventPayload, changeStatePayload}) {
    return p(this).onExit({fromStateName, toStateName, eventPayload, changeStatePayload});
  }

  getHandler(eventName) {
    return p(this).handlers[eventName];
  }
}


// Private Functions.


/**
 *
 */
function _formatHandlers(state, publicHandlers, privateHandlers) {
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
