const Statorade = require('../dist').default;


const trafficLight = new Statorade();

// Add a logger so we can see some info about the state changes.
trafficLight.onStateChange((info) => console.log('State Change occured!', info));


// Define the states.

trafficLight.addState('greenLight', {
  // Entry point for 'greenLight' state.
  onEnter: () => console.log('Entered greenLight.'),
  // Events the 'greenLight' state will react to.
  privateHandlers: {
    REQUEST_TURN_YELLOW: (changeState) => changeState('yellowLight')
  }
});

trafficLight.addState('yellowLight', {
  // Entry point for 'yellowLight' state.
  onEnter: () => console.log('Entered yellowLight.'),
  // Events the 'yellowLight' state will react to.
  privateHandlers: {
    REQUEST_TURN_RED: (changeState) => changeState('redLight')
  }
});

trafficLight.addState('redLight', {
  // Entry point for 'redLight' state.
  onEnter: ({}, {handlePrivate}) => {
    console.log('Entered redLight.');

    handlePrivate('REQUEST_TURN_GREEN');
  },
  // Events the 'redLight' state will react to.
  privateHandlers: {
    REQUEST_TURN_GREEN: (changeState) => changeState('greenLight')
  }
});


// Initialize the state machine.
trafficLight.init('redLight');

