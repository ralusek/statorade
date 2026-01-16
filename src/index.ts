import StateMachine from './stateMachine';

export default StateMachine;

// Export types for typed event payloads
export type {
  EventPayloadMap,
  DefaultEventPayloadMap,
  OverlappingKeys,
  AssertNoOverlap,
  TypedPublicHandler,
  TypedPrivateHandler,
  TypedHandlePrivate,
  TypedOnEnter,
  TypedHandlers,
  TypedPrivateHandlers,
  TypedStateConfig,
  TypedAddStateConfig,
} from './types';
