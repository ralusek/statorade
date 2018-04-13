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

    p(this).stateChangeDisabled = false;

    p(this).emitter = new EventEmitter();

    p(this).writeActiveStateName = writeActiveStateName;
    p(this).readActiveStateName = readActiveStateName;
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
    const activeStateName = _readActiveStateName(this);
    if (!activeStateName) throw new Error(`Unable to handle "${eventName}," state machine has not yet been initialized.`);

    const result = p(this).states[activeStateName].handle(eventName, eventPayload);

    // If state change occurred, emit event.
    if (result.changeStateResult) p(this).emitter.emit('stateChange', result);

    return result;
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


    // We capture this as a closure to keep a reference to this state, in order
    // to prevent state changes to be enabled/disabled by a nonactive state.
    const setCanStateChange = (value) => {
      const action = value ? 'enable' : 'disable';
      const activeStateName = _readActiveStateName(this);
      if (activeStateName !== stateName) throw new Error(`Attempted to ${action} state changes from "${stateName}," but currently in "${activeStateName}." "${stateName}" must be active state in order for it to disable state changes.`);
      p(this).stateChangeDisabled = !value;
    }

    const state = new State({
      ...config,
      stateName,
      requestStateChange: _generateRequestStateChange(this, stateName),
      setCanStateChange
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
      
  if (p(this).stateChangeDisabled) return `Cannot change state from "${fromStateName}" to "${toStateName}," state changes currently disabled.`;
  if (activeStateName !== fromStateName) return `Cannot change state from "${fromStateName}" to "${toStateName}," currently in "${activeStateName}."`;

  if (!nextState) return `Cannot change state from "${fromStateName}" to "${toStateName}," "${toStateName}" is not a defined state.`;
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
