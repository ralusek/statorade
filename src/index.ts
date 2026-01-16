import StateMachine from './stateMachine';

export default StateMachine;

// Export types for typed event payloads
export type {
  EventPayloadMap,
  DefaultEventPayloadMap,
  TypedHandler,
  TypedHandlePrivate,
  TypedOnEnter,
  TypedHandlers,
  TypedPrivateHandlers,
  TypedStateConfig,
  TypedAddStateConfig,
} from './types';
