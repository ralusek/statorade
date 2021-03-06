const Statorade = require('../dist').default;


const trafficLight = new Statorade();

// Add a logger so we can see some info about the state changes.
trafficLight.onStateChange((info) => console.log('State Change occured!', JSON.stringify(info, null, 2)));


// Define the states.

trafficLight.addState('greenLight', {
  // Entry point for 'greenLight' state.
  onEnterFrom: {
    'redLight': () => console.log('Entered greenLight from redLight.')
  },
  // Events the 'greenLight' state will react to.
  handlers: {
    REQUEST_TURN_YELLOW: (changeState) => changeState('yellowLight')
  }
});

trafficLight.addState('yellowLight', {
  // Entry point for 'yellowLight' state.
  onEnter: () => console.log('Entered yellowLight.'),
  // Events the 'yellowLight' state will react to.
  handlers: {
    REQUEST_TURN_RED: (changeState) => changeState('redLight')
  }
});

trafficLight.addState('redLight', {
  // Entry point for 'redLight' state.
  onEnter: () => console.log('Entered redLight.'),
  onExitTo: {
    'greenLight': () => console.log('Exiting redLight to greenLight.')
  },
  // Events the 'redLight' state will react to.
  handlers: {
    REQUEST_TURN_GREEN: (changeState) => changeState('greenLight')
  }
});


// Initialize the state machine.
trafficLight.init('redLight');


setTimeout(() => {
  // Fire an event.
  trafficLight.handle('REQUEST_TURN_GREEN');
}, 500);
