const Statorade = require('../lib');


const trafficLight = new Statorade();


// Define the states.

trafficLight.addState('greenLight', {
  // Entry point for 'greenLight' state.
  onEnter: () => console.log('Entered greenLight.'),
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
  // Events the 'redLight' state will react to.
  handlers: {
    REQUEST_TURN_GREEN: (changeState) => changeState('greenLight')
  }
});


// Initialize the state machine.
trafficLight.init('redLight');


// Fire an event.
trafficLight.handle('REQUEST_TURN_GREEN');
