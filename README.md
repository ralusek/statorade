#Statorade

Statorade is an event-driven state machine with many protections in place to
prevent you from shooting yourself in the foot, with very helpful and descriptive
error handling in place.

At it's core, it is as basic as it gets: the *only* way to change state is by
triggering an event. States define ways that they handle events, most commonly
in order to change states.

`$ npm install --save statorade`

```js
const Statorade = require('statorade');


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
  onEnter: () => console.log('Entered yellowLight.'),
  handlers: {
    REQUEST_TURN_RED: (changeState) => changeState('redLight')
  }
});

trafficLight.addState('redLight', {
  onEnter: () => console.log('Entered redLight.'),
  handlers: {
    REQUEST_TURN_GREEN: (changeState) => changeState('greenLight')
  }
});


// Initialize the state machine.
trafficLight.init('redLight');


// Fire an event. State will change to green, because the handler in the redLight
// state (the state we have initialized to) is defined to do so.
trafficLight.handle('REQUEST_TURN_GREEN');
```
