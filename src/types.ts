import State from './state';
import { EventEmitter } from 'events';
import { EVENT_NAME } from './constants';

// General Util Types
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;


export type StateName = string;
export type EventName = string;
export type EventPayload = any;

// ============================================================================
// Event Payload Map Types (for typed event payloads)
// ============================================================================

/**
 * Base type for defining event payload mappings.
 * Keys are event names, values are payload types.
 * Use `void` for events that don't require a payload.
 *
 * @example
 * type MyEvents = {
 *   login: { username: string; password: string };
 *   logout: void;
 * };
 */
export type EventPayloadMap = Record<string, any>;

/**
 * Default event payload map for backward compatibility.
 * When no generic is provided, all events accept any payload.
 */
export type DefaultEventPayloadMap = Record<string, any>;

/**
 * Extracts the payload type for a given event name from an event map.
 * Returns `any` if the event name is not in the map.
 */
export type PayloadForEvent<
  TEventMap extends EventPayloadMap,
  TEventName extends string
> = TEventName extends keyof TEventMap ? TEventMap[TEventName] : any;

/**
 * Typed handler function for a specific event.
 */
export type TypedHandler<
  TPublicEvents extends EventPayloadMap,
  TPrivateEvents extends EventPayloadMap,
  TEventName extends keyof TPublicEvents | keyof TPrivateEvents
> = (
  changeState: ChangeStateClosure,
  eventPayloadObj: {
    eventPayload: TEventName extends keyof TPublicEvents
      ? TPublicEvents[TEventName]
      : TEventName extends keyof TPrivateEvents
        ? TPrivateEvents[TEventName]
        : any
  },
  misc: {
    handlePrivate: TypedHandlePrivate<TPrivateEvents>;
    activeStateName: string;
    previousStateName: string;
  }
) => any;

/**
 * Typed handlePrivate function that enforces correct payload types.
 */
export type TypedHandlePrivate<TPrivateEvents extends EventPayloadMap> = <
  TEventName extends keyof TPrivateEvents & string
>(
  eventName: TEventName,
  ...args: TPrivateEvents[TEventName] extends void
    ? [eventPayload?: undefined]
    : [eventPayload: TPrivateEvents[TEventName]]
) => Promise<HandleMeta>;

/**
 * Typed onEnter callback with typed handlePrivate.
 */
export type TypedOnEnter<TPrivateEvents extends EventPayloadMap> = (
  meta: StateChangeHookMeta,
  misc: { handlePrivate: TypedHandlePrivate<TPrivateEvents> }
) => any;

/**
 * Typed handlers object for a state.
 */
export type TypedHandlers<
  TPublicEvents extends EventPayloadMap,
  TPrivateEvents extends EventPayloadMap
> = {
  [K in keyof TPublicEvents]?: TypedHandler<TPublicEvents, TPrivateEvents, K>;
};

/**
 * Typed private handlers object for a state.
 */
export type TypedPrivateHandlers<
  TPublicEvents extends EventPayloadMap,
  TPrivateEvents extends EventPayloadMap
> = {
  [K in keyof TPrivateEvents]?: TypedHandler<TPublicEvents, TPrivateEvents, K>;
};

/**
 * Typed state configuration.
 */
export type TypedStateConfig<
  TPublicEvents extends EventPayloadMap = DefaultEventPayloadMap,
  TPrivateEvents extends EventPayloadMap = DefaultEventPayloadMap
> = {
  /** The name of the state. */
  stateName: StateName;
  /** Callback to be called on entering state. */
  onEnter?: TypedOnEnter<TPrivateEvents>;
  /** Callback to be called on exiting state. */
  onExit?: OnExit;
  /** Callbacks keyed by state to be called when entering this state, when arriving from the keyed state. */
  onEnterFrom?: { [KStateName in StateName]: TypedOnEnter<TPrivateEvents> };
  /** Callbacks keyed by state to be called when exiting this state, when leaving to the keyed state. */
  onExitTo?: { [KStateName in StateName]: OnExit };
  /** Event handlers which may be triggered from the state machine. */
  handlers?: TypedHandlers<TPublicEvents, TPrivateEvents>;
  /** Event handlers which may only be triggered from the state's onEnter function. */
  privateHandlers?: TypedPrivateHandlers<TPublicEvents, TPrivateEvents>;
  /** Callback to be called prior to handlers. */
  beforeHandle?: HandlerMiddleware;
  /** Callback to be called after handlers. */
  afterHandle?: HandlerMiddleware;
};

/**
 * Typed AddStateConfig (without stateName).
 */
export type TypedAddStateConfig<
  TPublicEvents extends EventPayloadMap = DefaultEventPayloadMap,
  TPrivateEvents extends EventPayloadMap = DefaultEventPayloadMap
> = Omit<TypedStateConfig<TPublicEvents, TPrivateEvents>, 'stateName'>;
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
    handlePrivate: HandlePrivate;
    activeStateName: string;
    previousStateName: string;
  }
) => any;
export type HandlerObj = {
  fn: Handler;
  isPrivate: boolean;
};
export type HandlePrivate = (eventName: EventName, eventPayload: EventPayload) => Promise<HandleMeta>;
export type HandlerMiddleware = (meta: any) => any;
/** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
export type WriteActiveStateName = (stateName: StateName) => StateName;
/** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
export type ReadActiveStateName = () => StateName;

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
export type StateMachineConfig= {
  /** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
  writeActiveStateName: WriteActiveStateName;
  /** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
  readActiveStateName: ReadActiveStateName;
};

interface Emitter {
  on(event: EVENT_NAME.ERROR, callback: (err: Error) => void): void;
  on(event: EVENT_NAME.STATE_CHANGE, callback: StateChangeHandler): void;
  emit(event: EVENT_NAME.ERROR, err: Error): void; 
  emit(event: EVENT_NAME.STATE_CHANGE, meta: HandleMeta): void;
};

/**
 * The namespace for the StateMachine class.
 */
export type StateMachinePrivateNamespace = {
  /** The currently active state name. */
  activeStateName: StateName;
  /** The previously active state name. */
  previousStateName: StateName;
  /** The mapping reference of states. */
  states: {[KStateName in StateName]: State};
  /** The state machine's event emitter. */
  emitter: Emitter;
  /** A custom setter to write the state, used if state is stored elsewhere (such as redux store or DB) */
  writeActiveStateName: WriteActiveStateName;
  /** A custom getter to read the state, used if the state is stored elsewhere (such as redux store or DB) */
  readActiveStateName: ReadActiveStateName;
  /** How many times the state has changed. Acts as an identifier for the current state change. */
  stateChangeCount: number;
  /** Backlogged events to dispatch. */
  pendingDispatchEventMeta: EventMeta[];
  /** Whether or not the state machine has been initialized. */
  hasInitialized: boolean;
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
