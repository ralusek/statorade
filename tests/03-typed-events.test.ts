import 'mocha';
import { expect } from 'chai';

import StateMachine from '../lib';

// Define typed event payloads
type PublicEvents = {
  login: { username: string; password: string };
  logout: void;
  submitForm: { data: Record<string, unknown> };
};

type PrivateEvents = {
  validateCredentials: { username: string };
  clearSession: void;
};

describe('Typed Event Payloads', () => {
  describe('Typed StateMachine', () => {
    it('should accept correctly typed payloads in handle()', async () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();
      let receivedPayload: { username: string; password: string } | undefined;

      sm.addState('loggedOut', {
        handlers: {
          login: (changeState, { eventPayload }) => {
            receivedPayload = eventPayload;
            changeState('loggedIn');
          },
        },
      });

      sm.addState('loggedIn', {});

      await sm.init('loggedOut');

      // Wait for init to complete
      await new Promise((resolve) => setTimeout(resolve, 5));

      // This should be type-safe: payload matches { username: string; password: string }
      sm.handle('login', { username: 'testuser', password: 'testpass' });

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(receivedPayload).to.deep.equal({ username: 'testuser', password: 'testpass' });
      expect(sm.getActiveStateName()).to.equal('loggedIn');
    });

    it('should allow void events without payload', async () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();
      let logoutCalled = false;

      sm.addState('loggedIn', {
        handlers: {
          logout: (changeState) => {
            logoutCalled = true;
            changeState('loggedOut');
          },
        },
      });

      sm.addState('loggedOut', {});

      await sm.init('loggedIn');
      await new Promise((resolve) => setTimeout(resolve, 5));

      // void events don't require a payload
      sm.handle('logout');

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(logoutCalled).to.be.true;
      expect(sm.getActiveStateName()).to.equal('loggedOut');
    });

    it('should work with handlePrivate for private events', async () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();
      let validateCalled = false;
      let validatedUsername: string | undefined;

      sm.addState('loggedOut', {
        handlers: {
          login: (changeState, { eventPayload }, { handlePrivate }) => {
            // handlePrivate should be typed to accept PrivateEvents
            handlePrivate('validateCredentials', { username: eventPayload.username });
            changeState('loggedIn');
          },
        },
        privateHandlers: {
          validateCredentials: (_changeState, { eventPayload }) => {
            validateCalled = true;
            validatedUsername = eventPayload.username;
          },
        },
      });

      sm.addState('loggedIn', {});

      await sm.init('loggedOut');
      await new Promise((resolve) => setTimeout(resolve, 5));

      sm.handle('login', { username: 'testuser', password: 'testpass' });

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(validateCalled).to.be.true;
      expect(validatedUsername).to.equal('testuser');
    });

    it('should work with onEnter and handlePrivate', async () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();
      let clearSessionCalled = false;

      sm.addState('loggedIn', {
        handlers: {
          logout: (changeState) => {
            changeState('loggedOut');
          },
        },
      });

      sm.addState('loggedOut', {
        onEnter: (_meta, { handlePrivate }) => {
          // void private events don't need a payload
          handlePrivate('clearSession');
        },
        privateHandlers: {
          clearSession: () => {
            clearSessionCalled = true;
          },
        },
      });

      await sm.init('loggedIn');
      await new Promise((resolve) => setTimeout(resolve, 5));

      sm.handle('logout');

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(clearSessionCalled).to.be.true;
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without generics (untyped)', async () => {
      // This is the traditional usage without type parameters
      const sm = new StateMachine();
      let eventReceived = false;

      sm.addState('stateA', {
        handlers: {
          anyEvent: (changeState, { eventPayload }) => {
            eventReceived = true;
            expect(eventPayload.someValue).to.equal(123);
            changeState('stateB');
          },
        },
      });

      sm.addState('stateB', {});

      await sm.init('stateA');
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Without generics, any event name and payload is allowed
      sm.handle('anyEvent', { someValue: 123 });

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(eventReceived).to.be.true;
      expect(sm.getActiveStateName()).to.equal('stateB');
    });

    it('should allow string event names even with typed state machine', async () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();

      sm.addState('test', {});

      await sm.init('test');
      await new Promise((resolve) => setTimeout(resolve, 5));

      // String fallback should still work for events not in the type
      // @ts-expect-error - unknownEvent is not in PublicEvents, but string fallback allows it at runtime
      sm.handle('unknownEvent', { any: 'payload' });
    });
  });

  describe('Type Safety Verification', () => {
    // These tests verify compile-time type checking.
    // The actual function bodies are never executed - we just need the code to type-check.
    // We wrap them in a condition that's always false at runtime to prevent execution.

    it('should catch incorrect payload types at compile time', () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();

      sm.addState('test', {
        handlers: {
          login: (changeState, { eventPayload }) => {
            // TypeScript should infer eventPayload as { username: string; password: string }
            const _username: string = eventPayload.username;
            const _password: string = eventPayload.password;

            // @ts-expect-error - nonExistent property doesn't exist on login payload
            const _invalid = eventPayload.nonExistent;

            changeState('other');
          },
        },
      });

      // Wrap type-checking-only code in a never-executed block
      if (false as boolean) {
        // @ts-expect-error - wrong payload shape for login event
        sm.handle('login', { wrong: 'shape' });

        // @ts-expect-error - missing required properties
        sm.handle('login', { username: 'only' });

        // This should be valid
        sm.handle('login', { username: 'test', password: 'test' });
      }
    });

    it('should enforce void events have no payload', () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();

      sm.addState('test', {
        handlers: {
          logout: (changeState) => {
            changeState('other');
          },
        },
      });

      // Wrap type-checking-only code in a never-executed block
      if (false as boolean) {
        // Valid: void event with no payload
        sm.handle('logout');

        // @ts-expect-error - void events shouldn't accept a payload
        sm.handle('logout', { unexpected: 'payload' });
      }
    });

    it('should type handlePrivate correctly in handlers', () => {
      const sm = new StateMachine<PublicEvents, PrivateEvents>();

      sm.addState('test', {
        handlers: {
          login: (changeState, { eventPayload }, { handlePrivate }) => {
            // Valid: correct payload for validateCredentials
            handlePrivate('validateCredentials', { username: eventPayload.username });

            // Valid: void private event
            handlePrivate('clearSession');

            // @ts-expect-error - wrong payload for validateCredentials
            handlePrivate('validateCredentials', { wrong: 'type' });

            // @ts-expect-error - clearSession is void, shouldn't accept payload
            handlePrivate('clearSession', { unexpected: 'data' });

            changeState('other');
          },
        },
        privateHandlers: {
          validateCredentials: (_changeState, { eventPayload }) => {
            // Should be typed as { username: string }
            const _username: string = eventPayload.username;
          },
        },
      });
    });
  });
});
