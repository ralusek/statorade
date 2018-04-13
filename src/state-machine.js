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

    // We capture the request state change in a closure to keep a reference to this
    // state, in order to prevent state changes being requested from states when
    // they are not active in the state machine.
    const requestStateChange = ({toState, eventPayload, changeStatePayload}) => {
      const activeStateName = _readActiveStateName(this);
      if (toState === BOOT) throw new Error(`Cannot change state to the boot state. "${BOOT}" is a reserved state name.`);
      const fromState = stateName;

      if (p(this).stateChangeDisabled) throw new Error(`Cannot change state from "${fromState}" to "${toState}," state changes currently disabled.`);
      if (activeStateName !== fromState) throw new Error(`Cannot change state from "${fromState}" to "${toState}," currently in "${activeStateName}."`);

      const nextState = p(this).states[toState];
      if (!nextState) throw new Error(`Cannot change state from "${fromState}" to "${toState}," "${toState}" is not a defined state.`);
      
      const result = {};

      const currentState = p(this).states[activeStateName];
      // Exit current state.
      if (currentState) result.exit = currentState.exit({fromState, toState, eventPayload, changeStatePayload});


      _writeActiveStateName(this, toState);
      result.enter = nextState.enter({fromState, toState, eventPayload, changeStatePayload});

      return result;
    };

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
      requestStateChange,
      setCanStateChange
    });

    p(this).states[stateName] = state;
  }
}


// Private Functions.


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
