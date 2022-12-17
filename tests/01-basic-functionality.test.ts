import 'mocha';
import { expect } from 'chai';

import StateMachine from '../lib';

describe('Basic Functionality', () => {
  let sm: StateMachine;
  let greenEntered = 0;
  let greenExited = 0;
  let redEntered = 0;
  let redExited = 0;
  let yellowEntered = 0;

  let greenEnteredFromRed = 0;

  it('should be able to be instantiated.', async () => {
    sm = new StateMachine();

    expect(sm).to.not.be.undefined;
  });

  it('should be able to define states.', async () => {
    sm.addState('red', {
      onEnter: () => {
        redEntered++;
      },
      onExit: () => {
        redExited++;
        expect(greenEntered).to.equal(0);
      },
      handlers: {
        green: (changeState) => changeState('green'),
      },
    });

    sm.addState('green', {
      onEnter: () => {
        greenEntered++;
      },
      onEnterFrom: {
        red: () => {
          expect(greenEntered).to.equal(0);
          greenEnteredFromRed++;
        },
      },
      onExit: () => {
        greenExited++;
        expect(yellowEntered).to.equal(0);
      },
      handlers: {
        yellow: (changeState, eventPayload, misc) => {
          changeState('yellow');
        },
      },
    });

    sm.addState('yellow', {
      onEnter: () => {
        yellowEntered++;
      },
    });
  });

  it('should initialize', async () => {
    sm.init('red');

    await new Promise((resolve) => {
      setTimeout(() =>{
        expect(greenEntered).to.equal(0);
        expect(redEntered).to.equal(1);
        expect(yellowEntered).to.equal(0);
        expect(sm.getActiveStateName()).to.equal('red');
        resolve(null);
      }, 5);
    });

    sm.handle('green');
    await new Promise((resolve) => {
      setTimeout(() =>{
        expect(greenEntered).to.equal(1);
        expect(redEntered).to.equal(1);
        expect(yellowEntered).to.equal(0);
        expect(greenEnteredFromRed).to.equal(1);
        expect(redExited).to.equal(1);
        expect(greenExited).to.equal(0);
        expect(sm.getPreviousStateName()).to.equal('red');
        expect(sm.getActiveStateName()).to.equal('green');
        resolve(null);
      }, 5);
    });

    sm.handle('yellow');
    await new Promise((resolve) => {
      setTimeout(() =>{
        expect(greenEntered).to.equal(1);
        expect(redEntered).to.equal(1);
        expect(yellowEntered).to.equal(1);
        expect(greenExited).to.equal(1);
        expect(sm.getPreviousStateName()).to.equal('green');
        expect(sm.getActiveStateName()).to.equal('yellow');
        resolve(null);
      }, 5);
    });
  });
});
