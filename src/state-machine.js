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
  constructor() {
    p(this).states = {};

    p(this).stateChangeDisabled = false;

    
  }

  init(stateName) {
    if (p(this).activeStateName) throw new Error(`Unable to initialize state machine, has already initialized.`);

    p(this).activeStateName = BOOT;
    this.addState(p(this).activeStateName, {
      handlers: {
        init: (changeState) => changeState(stateName)
      }
    });

    return this.handle('init');
  }

  handle(eventName, eventPayload) {
    if (!p(this).activeStateName) throw new Error(`Unable to handle "${eventName}," no state machine has not yet been initialized.`);

    return p(this).states[p(this).activeStateName].handle(eventName, eventPayload);
  }

  addState(stateName, config = {}) {
    if (!stateName) throw new Error(`Cannot add state, no stateName provided.`);
    if (p(this).states[stateName]) throw new Error(`Cannot add state "${stateName}" to state machine, a state with that name already exists.`);

    // We capture the request state change in a closure to keep a reference to this
    // state, in order to prevent state changes being requested from states when
    // they are not active in the state machine.
    const requestStateChange = ({toState, eventPayload, changeStatePayload}) => {
      if (toState === BOOT) throw new Error(`Cannot change state to the boot state. "${BOOT}" is a reserved state name.`);
      const fromState = stateName;

      if (p(this).stateChangeDisabled) throw new Error(`Cannot change state from "${fromState}" to "${toState}," state changes currently disabled.`);
      if (p(this).activeStateName !== fromState) throw new Error(`Cannot change state from "${fromState}" to "${toState}," currently in "${p(this).activeStateName}."`);

      const nextState = p(this).states[toState];
      if (!nextState) throw new Error(`Cannot change state from "${fromState}" to "${toState}," "${toState}" is not a defined state.`);
      
      const result = {};

      const currentState = p(this).states[p(this).activeStateName];
      // Exit current state.
      if (currentState) result.exit = currentState.exit({fromState, toState, eventPayload, changeStatePayload});


      p(this).activeStateName = toState;
      result.enter = nextState.enter({fromState, toState, eventPayload, changeStatePayload});

      return result;
    };

    // We capture this as a closure to keep a reference to this state, in order
    // to prevent state changes to be enabled/disabled by a nonactive state.
    const setCanStateChange = (value) => {
      const action = value ? 'enable' : 'disable';
      if (p(this).activeStateName !== stateName) throw new Error(`Attempted to ${action} state changes from "${stateName}," but currently in "${p(this).activeStateName}." "${stateName}" must be active state in order for it to disable state changes.`);
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



/**
 *
 */
module.exports = StateMachine;
