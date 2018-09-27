const EventEmitter = require('events');

const State = require('./state');

const BOOT = '_boot';



// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 *
 */
class StateMachine {
  constructor({
    // Allow active stateName to be written to external store.
    writeActiveStateName = (stateName) => p(this).activeStateName = stateName,
    // Allow active stateName to be read from external store.
    readActiveStateName = () => p(this).activeStateName
  } = {}) {
    p(this).states = {};

    p(this).emitter = new EventEmitter();

    p(this).writeActiveStateName = writeActiveStateName;
    p(this).readActiveStateName = readActiveStateName;


    p(this).stateChangeCount = 0;

    p(this).pendingDispatchEventMeta = [];
  }

  /**
   * Initializes the state machine by creating a boot state which transitions
   * to the provided state immediately.
   */
  init(stateName) {
    if (_readActiveStateName(this)) throw new Error(`Unable to initialize state machine, has already initialized.`);

    _writeActiveStateName(this, BOOT);
    this.addState(BOOT, {
      handlers: {
        init: (changeState) => changeState(stateName)
      }
    });

    return this.handle('init');
  }

  /**
   * Handle an event within the context of the active state, executing any active
   * event handlers.
   */
  handle(eventName, eventPayload) {
    return _queueEventDispatch(this, {
      activeStateName: _readActiveStateName(this),
      eventName,
      eventPayload,
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
   * Register an event handler to be notifed on state changes.
   */
  onStateChange(callback) {
    p(this).emitter.on('stateChange', callback);
  }

  /**
   * Register a new state configuration with the state machine.
   */
  addState(stateName, config = {}) {
    if (!stateName) throw new Error(`Cannot add state, no stateName provided.`);
    if (p(this).states[stateName]) throw new Error(`Cannot add state "${stateName}" to state machine, a state with that name already exists.`);


    const state = new State({
      ...config,
      stateName
    });

    p(this).states[stateName] = state;
  }
}


// Private Functions.



function _queueEventDispatch(sm, {activeStateName, eventName, eventPayload, isPrivate, stateChangeCountSnapshot}) {
  if (!activeStateName) return Promise.reject(new Error(`Unable to queue event for dispatch, no active state to handle it.`));

  p(sm).pendingDispatchEventMeta.push({
    activeStateName,
    eventName,
    eventPayload,
    isPrivate,
    stateChangeCountSnapshot
  });

  return _handleNextEvent(sm);
}

function _validateEventHandling(sm, eventMeta, handler) {
  const activeStateName = _readActiveStateName(sm);
  if (!activeStateName) throw new Error(`Unable to handle "${eventMeta.eventName}," state machine has not yet been initialized.`);

  if (handler.isPrivate && !eventMeta.isPrivate) throw new Error(`Unable to handle "${eventMeta.eventName}," the handler defined for this event in "${activeStateName}" is private. This means that it can only be called from a "handlePrivate function passed into the state's own methods.`);

  const currentStateChangeCount = p(sm).stateChangeCount;
  const stateChangesSinceDispatch = currentStateChangeCount - eventMeta.stateChangeCountSnapshot;
  if (stateChangesSinceDispatch) {
    throw new Error(`Unable to handle "${eventMeta.eventName}," ${stateChangesSinceDispatch} state changes have occurred since this was dispatched.`);
  }

  // Should not logically be possible, likely redundant.
  if (activeStateName !== eventMeta.activeStateName) throw new Error(`Unable to handle "${eventMeta.eventName}," event was fired while in "${eventMeta.activeStateName}," currently in "${activeStateName}."`);
}

function _handleNextEvent(sm) {
  const meta = {};

  // Although we do not await any asynchronous behavior, we wrap this in a promise
  // so that it will execute on next tick. This ensures that any events dispatched
  // within the handler or state change will not be dealt with until any synchronous
  // state changes or other synchronous event behaviors are finished.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const eventMeta = p(sm).pendingDispatchEventMeta.shift();
      const activeState = p(sm).states[eventMeta.activeStateName];

      const stateChangeCountSnapshot = p(sm).stateChangeCount;

      const handler = activeState.getHandler(eventMeta.eventName);

      meta.hasHandler = !!handler;
      meta.beforeHandleResult = activeState.beforeHandle({...meta, ...eventMeta});


      if (meta.hasHandler && meta.beforeHandleResult !== false) {
        meta.isPrivate = handler.isPrivate;

        _validateEventHandling(sm, eventMeta, handler);

        const changeStateClosure = (toStateName, changeStatePayload) => {
          meta.changeStateResult = _handleChangeState(sm, {toStateName, changeStatePayload}, eventMeta);
        }

        meta.handlerResult = handler.fn(
          changeStateClosure,
          {eventPayload: eventMeta.eventPayload},
          {
            handlePrivate: (eventName, eventPayload) => _queueEventDispatch(sm, {
              activeStateName: eventMeta.activeStateName,
              eventName,
              eventPayload,
              isPrivate: true,
              stateChangeCountSnapshot
            })
          }
        );

        meta.afterHandler = activeState.afterHandle({...meta, ...eventMeta});
      }

      resolve(meta);
    });
  })
  .then((meta) => {
    // If state change occurred, emit event.
    if (meta.changeStateResult) p(sm).emitter.emit('stateChange', meta);
    return meta;
  });
}

/**
 * Generates error messages for various invalid state change conditions.
 */
function _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState}, eventMeta) {
  if (toStateName === BOOT) return `Cannot change state to the boot state. "${BOOT}" is a reserved state name.`;
  
  const currentStateChangeCount = p(sm).stateChangeCount;
  const stateChangesSinceDispatch = currentStateChangeCount - eventMeta.stateChangeCountSnapshot;
  if (stateChangesSinceDispatch) {
    throw new Error(`Unable to change state from "${fromStateName}" to "${toStateName}," ${stateChangesSinceDispatch} state changes have occurred since the enclosing event handler was dispatched.`);
  }

  // Should not logically be possible, likely redundant.
  if (activeStateName !== fromStateName) return `Cannot change state from "${fromStateName}" to "${toStateName}," currently in "${activeStateName}."`;

  if (!nextState) return `Cannot change state from "${fromStateName}" to "${toStateName}," "${toStateName}" is not a defined state.`;
}


function _handleChangeState(sm, {toStateName, changeStatePayload}, eventMeta) {
  const fromStateName = eventMeta.activeStateName;
  const activeStateName = _readActiveStateName(sm);
  const nextState = p(sm).states[toStateName];

  const validationErrorMessage = _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState}, eventMeta);
  if (validationErrorMessage) throw new Error(validationErrorMessage);

  const result = {fromStateName, toStateName};

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


  _writeActiveStateName(sm, toStateName);

  // Enter next state.
  result.enter = nextState.enter({
    fromStateName,
    toStateName,
    eventPayload: eventMeta.eventPayload,
    changeStatePayload
  }, {
    handlePrivate: (eventName, eventPayload) => _queueEventDispatch(sm, {
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
function _writeActiveStateName(sm, stateName) {
  if (stateName !== BOOT && !p(sm).states[stateName]) throw new Error(`Attempted to set ${stateName} as activeStateName, but no such state is defined.`);
  p(sm).writeActiveStateName(stateName);
  const readStateName = _readActiveStateName(sm);
  if (stateName !== readStateName) throw new Error(`Issue encountered with provided writeActiveStateName/readActiveStateName functions. The read state did not produce the expected stateName immediately following a write. Got "${readStateName}," expected "${stateName}."`);
  return readStateName;
}


/**
 * Reads the active stateName using the provided read mechanism.
 */
function _readActiveStateName(sm) {
  return p(sm).readActiveStateName();
}



/**
 *
 */
module.exports = StateMachine;
