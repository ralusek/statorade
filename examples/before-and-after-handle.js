const Statorade = require('../dist').default;


const trafficLight = new Statorade();

// Add a logger so we can see some info about the state changes.
trafficLight.onStateChange((info) => console.log('State Change occured!', info));


// Define the states.

trafficLight.addState('greenLight', {
  // Entry point for 'greenLight' state.
  onEnter: () => console.log('Entered greenLight.'),
  beforeHandle: (meta) => console.log('Before handling:', meta),
  // Events the 'greenLight' state will react to.
  handlers: {
    REQUEST_TURN_YELLOW: (changeState) => changeState('yellowLight')
  },
  afterHandle: (meta) => console.log('After Handling:', meta)
});

trafficLight.addState('yellowLight', {
  // Entry point for 'yellowLight' state.
  onEnter: () => console.log('Entered yellowLight.'),
  beforeHandle: () => false,
  // Events the 'yellowLight' state will react to.
  handlers: {
    REQUEST_TURN_RED: (changeState) => changeState('redLight')
  }
});

trafficLight.addState('redLight', {
  // Entry point for 'redLight' state.
  onEnter: () => console.log('Entered redLight.'),
  // Events the 'redLight' state will react to.
  handlers: {
    REQUEST_TURN_GREEN: (changeState) => changeState('greenLight')
  }
});


// Initialize the state machine.
trafficLight.init('greenLight');


setTimeout(() => {
  // Fire an event.
  trafficLight.handle('REQUEST_TURN_YELLOW');
}, 500);

setTimeout(() => {
  // Will not happen, because the beforeHandle on yellowLight returns false.
  trafficLight.handle('REQUEST_TURN_RED');
}, 1000);