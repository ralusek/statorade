import State from './state';
import { EventEmitter } from 'events';

// General Util Types
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;


export type StateName = string;
export type EventName = string;
export type EventPayload = any;
export type OnEnter = (meta: StateChangeHookMeta, misc: {handlePrivate: HandlePrivate}) => any;
export type OnExit = (meta: StateChangeHookMeta) => any;
export type StateChangeHookMeta = {
  fromStateName: StateName,
  toStateName: StateName,
  eventPayload: EventPayload,
  changeStatePayload: ChangeStatePayload,
};
export type ChangeStateClosure = (toStateName: StateName, changeStatePayload?: ChangeStatePayload) => void;
export type ChangeStatePayload = any;
export type Handler = (
  changeState: ChangeStateClosure,
  eventPayloadObj: { eventPayload: EventPayload },
  misc: {
    handlePrivate: HandlePrivate
  }
) => any;
export type HandlerObj = {
  fn: Handler;
  isPrivate: boolean;
};
export type HandlePrivate = (eventName: EventName, eventPayload: EventPayload) => Promise<HandleMeta>;
export type HandlerMiddleware = (meta: any) => any;
/** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
export type WriteActiveStateName<TStateName extends StateName = StateName> = (stateName: TStateName) => TStateName;
/** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
export type ReadActiveStateName<TStateName extends StateName = StateName> = () => TStateName;

export type EventMeta = {
  activeStateName: StateName;
  eventName: EventName;
  eventPayload: EventPayload;
  isPrivate: boolean;
  stateChangeCountSnapshot: number;
};

export type StateChangeMeta = {
  activeStateName: StateName;
  toStateName: StateName;
  fromStateName: StateName;
  nextState: State;
};

export type StateChangeHandler = (meta: HandleMeta) => void;

export type HandleStateChangeResult = {
  fromStateName: StateName;
  toStateName: StateName;
  enter: ReturnType<State['enter']>;
  exit: ReturnType<State['exit']>;
};

export type HandleMeta = {
  hasHandler: boolean;
  beforeHandleResult: ReturnType<HandlerMiddleware>;
  afterHandleResult: ReturnType<HandlerMiddleware>;
  handlerResult: ReturnType<Handler>;
  changeStateResult: HandleStateChangeResult;
  isPrivate: boolean;
};

/**
 * Constructor configuration object for StateMachine class.
 */
export type StateMachineConfig<TStateName extends StateName = StateName> = {
  /** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
  writeActiveStateName: WriteActiveStateName<TStateName>;
  /** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
  readActiveStateName: ReadActiveStateName<TStateName>;
};

/**
 * The namespace for the StateMachine class.
 */
export type StateMachinePrivateNamespace<TStateName extends StateName = StateName> = {
  /** The currently active state name. */
  activeStateName: StateName;
  /** The mapping reference of states. */
  states: {[KStateName in StateName]: State};
  /** The state machine's event emitter. */
  emitter: EventEmitter;
  /** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
  writeActiveStateName: WriteActiveStateName<TStateName>;
  /** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
  readActiveStateName: ReadActiveStateName<TStateName>;
  /** How many times the state has changed. Acts as an identifier for the current state change. */
  stateChangeCount: number;
  /** Backlogged events to dispatch. */
  pendingDispatchEventMeta: EventMeta[];
};

/**
 * Constructor configuration object for State class.
 */
export type StateConfig = {
  /** The name of the state. */
  stateName: StateName,
  /** Callback to be called on entering state. */
  onEnter?: OnEnter,
  /** Callback to be called on exiting state. */
  onExit?: OnExit,
  /** Callbacks keyed by state to be called when entering this state, when arriving from the keyed state. */
  onEnterFrom?: {[KStateName in StateName]: OnEnter},
  /** Callbacks keyed by state to be called when exiting this state, when leaving to the keyed state. */
  onExitTo?: {[KStateName in StateName]: OnExit},
  /** Event handlers which may be triggered from the state machine. */
  handlers?: {[KEventName in EventName]: Handler},
  /** Event handlers which may only be triggered from the state's onEnter function. */
  privateHandlers?: {[KEventName in EventName]: Handler},
  /** Callback to be called prior to handlers. */
  beforeHandle?: HandlerMiddleware,
  /** Callback to be called after handlers. */
  afterHandle?: HandlerMiddleware,
};

export type AddStateConfig = Omit<StateConfig, 'stateName'>;

/**
 * The namespace for the State\ class.
 */
export type StatePrivateNamespace = {
  stateName: StateName;
  onEnter: OnEnter;
  onExit: OnExit;
  onEnterFrom: {[KStateName in StateName]: OnEnter};
  onExitTo: {[KStateName in StateName]: OnExit};
  handlers: {[KEventName in EventName]: HandlerObj};
  handlerMiddleware: {
    before?: HandlerMiddleware;
    after?: HandlerMiddleware;
  };
};
