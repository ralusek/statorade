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

    p(this).pendingEventDispatch = [];
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
      eventName,
      eventPayload,
      isPrivate: false
    });
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
      stateName,
      attemptStateChange: (...args) => _handleStateChangeAttempt(this, ...args),
      attemptStateChangeAvailabilityToggle: (...args) => _handleStateChangeAvailabilityToggle(this, ...args),
      attemptEventDispatch: (...args) => _handleEvent(this, ...args)
    });

    p(this).states[stateName] = state;
  }
}


// Private Functions.


/**
 * Generates error messages for various invalid state change conditions.
 */
function _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState}) {
  if (toStateName === BOOT) return `Cannot change state to the boot state. "${BOOT}" is a reserved state name.`;
      
  if (p(sm).stateChangeDisabled) return `Cannot change state from "${fromStateName}" to "${toStateName}," state changes currently disabled.`;
  if (activeStateName !== fromStateName) return `Cannot change state from "${fromStateName}" to "${toStateName}," currently in "${activeStateName}."`;

  if (!nextState) return `Cannot change state from "${fromStateName}" to "${toStateName}," "${toStateName}" is not a defined state.`;
}

function _queueEventDispatch(sm, {eventName, eventPayload, isPrivate}) {
  p(sm).pendingEventDispatch.push({
    eventName,
    eventPayload,
    isPrivate,
    currentStateChangeCount: p(this).stateChangeCount
  });

  return _handleNextEvent(sm);
}

function _handleNextEvent(sm) {
  const nextEvent = p(sm).pendingEventDispatch.shift();

  const activeStateName = _readActiveStateName(sm);
  if (!activeStateName) throw new Error(`Unable to handle "${next.eventName}," state machine has not yet been initialized.`);

  const currentStateChangeCount = p(sm).stateChangeCount;
  if (nextEvent.currentStateChangeCount > ) currentStateChangeCount throw new Error(`Unable to handle "${nextEvent.eventName}," event was dispatched in a previous state.`);

  const handler = p(this).states[activeStateName].getHandler(eventName);

  const result = p(this).states[activeStateName].handle(eventName, eventPayload, nextEvent.isPrivate);

  // If state change occurred, emit event.
  if (result.changeStateResult) p(this).emitter.emit('stateChange', result);

  return result;
}


function _handleStateChangeAttempt(sm, {toStateName, eventPayload, changeStatePayload}) {
  const activeStateName = _readActiveStateName(sm);
  const fromStateName = stateName;
  const nextState = p(sm).states[toStateName];

  const validationErrorMessage = _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState});
  if (validationErrorMessage) throw new Error(validationErrorMessage);
  
  const result = {};

  const currentState = p(sm).states[activeStateName];
  // Exit current state.
  if (currentState) result.exit = currentState.exit({fromStateName, toStateName, eventPayload, changeStatePayload});

  const currentStateChangeCount = p(sm).stateChangeCount;

  _writeActiveStateName(sm, toStateName);
  result.enter = nextState.enter({fromStateName, toStateName, eventPayload, changeStatePayload}, {
    handlePrivate: (eventName, eventPayload) => _queueEventDispatch(sm, {eventName, eventPayload, isPrivate: true}) 
  });

  return result;
}

function _handleStateChangeAvailabilityToggleAttempt() {

}


/**
 * Generate a requestStateChange in a closure, enclosing stateName for validation.
 */
function _generateRequestStateChange(sm, stateName) {
  return ({toStateName, eventPayload, changeStatePayload}) => {
    const activeStateName = _readActiveStateName(sm);
    const fromStateName = stateName;
    const nextState = p(sm).states[toStateName];

    const validationErrorMessage = _validateStateChange(sm, {activeStateName, toStateName, fromStateName, nextState});
    if (validationErrorMessage) throw new Error(validationErrorMessage);
    
    const result = {};

    const currentState = p(sm).states[activeStateName];
    // Exit current state.
    if (currentState) result.exit = currentState.exit({fromStateName, toStateName, eventPayload, changeStatePayload});


    _writeActiveStateName(sm, toStateName);
    result.enter = nextState.enter({fromStateName, toStateName, eventPayload, changeStatePayload});

    return result;
  };
}


/**
 * Writes the active stateName using the provided or default storage mechanism.
 */
function _writeActiveStateName(sm, stateName) {
  if (stateName !== BOOT && !p(sm).states[stateName]) throw new Error(`Attempted to set ${stateName} as activeStateName, but no such state is defined.`);
  p(sm).writeActiveStateName(stateName);
  const readStateName = _readActiveStateName(sm, stateName);
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
