"use strict";

const FLOWS_TIMEOUT = 30000;

function waitNodesStarted(RED, timeout, result) {
    // if flows are loaded and started, then all is good
    if (RED.nodes.getFlows()) return Promise.resolve(result);
    // otherwise wait for the nodes-started event
    let events = require('node-red/red/runtime/events');
    return new Promise((resolve, reject) => {
        // timeout with failure
        let timer = setTimeout(() => {
            events.removeListener('nodes-started', nodesStarted);
            let err = new Error("timed out waiting for flows to start");
            if (result !== undefined) err.result = result;
            reject(err);
        }, timeout);

        // handler for 'nodes-started' event
        function nodesStarted() {
            clearTimeout(timer);
            resolve(result);
        }

        events.once('nodes-started', nodesStarted);
    });
}

var REDstart = module.exports = function(RED, timeout, result) {
    let genFunc = arguments.length <= 2;
    // is the first argument not RED?
    if (RED === undefined || ! RED.start) {
        // as a default, load RED object from modules
        RED = require('node-red');
        // if there is only one argument but it isn't RED, assume we are being
        // used directly as the wait function
        if (arguments.length === 1) genFunc = false;
    }
    // if we are being used directly, the last argument is the result value to be passed through
    if (arguments.length > 0) result = arguments[arguments.length-1];
    // timeout can only be provided in the 2 and 3-argument form
    if (arguments.length < 2 || timeout === undefined) timeout = FLOWS_TIMEOUT;
    if (genFunc) {
        return function(value) { return waitNodesStarted(RED, timeout, value) };
    }
    return waitNodesStarted(RED, timeout, result);
};

var injected = new Map();

REDstart.inject = function(RED, timeout) {
    if (! RED) RED = require('node-red');
    let start = RED.start;
    // injected previously already?
    if (injected.get(RED) === start) return;
    // if not, inject ourselves
    RED.start = injectedStart;
    injected.set(RED, injectedStart);

    /* eslint-disable no-invalid-this */
    // the function we will be injecting
    function injectedStart() {
        return start.apply(this, arguments).then(REDstart(RED, timeout));
    }
    /* eslint-enable no-invalid-this */
};
