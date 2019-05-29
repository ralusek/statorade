const Statorade = require('../dist').default;

const trafficLight = new Statorade();

// Add a logger so we can see some info about the state changes.
trafficLight.onStateChange((info) => console.log('State Change occurred!', info));
trafficLight.onError((err) => console.log('Error Event occurred', err));


// Define the states.

trafficLight.addState('greenLight', {
  // Entry point for 'greenLight' state.
  onEnter: () => console.log('Entered greenLight.'),
  // Events the 'greenLight' state will react to.
  handlers: {
    REQUEST_TURN_YELLOW: (changeState) => {
      changeState('yellowLight');
      // Should error
      setTimeout(() => {
        console.log('Attempt to change to yellow.');
        changeState('yellowLight');
      }, 1000);
    }
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
trafficLight.init('greenLight');


setTimeout(() => {
  // Fire an event.
  trafficLight.handle('REQUEST_TURN_YELLOW');
}, 500);
