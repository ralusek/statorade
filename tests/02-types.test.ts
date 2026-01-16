import StateMachine from '../lib';

const sm = new StateMachine();

sm.addState('red', {
  onEnter: () => {
    console.log('Entered red state');
  },
  handlers: {
    green: (changeState, eventPayload) => {
      changeState('green');
      console.log('Green event payload:', eventPayload);
    },
  },
});

sm.addState('green', {
  onEnter: () => {
    console.log('Entered green state');
  },
  handlers: {
    yellow: (changeState, eventPayload) => {
      changeState('yellow');
      console.log('Yellow event payload:', eventPayload);
    },
  },
});

sm.addState('yellow', {
  onEnter: () => {
    console.log('Entered yellow state');
  },
  handlers: {
    red: (changeState, eventPayload) => {
      changeState('red');
      console.log('Red event payload:', eventPayload);
    },
  },
});

