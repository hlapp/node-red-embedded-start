"use strict";

const FLOWS_TIMEOUT = 30000;

function waitNodesStarted(RED, timeout, result) {
    // if flows are loaded and started, then all is good
    if (RED.nodes.getFlows()) return result;
    // otherwise wait for the nodes-started event
    let events = require('node-red/red/runtime/events');
    return new Promise((resolve, reject) => {
        // timeout with failure
        let timer = setTimeout(() => {
            events.removeListener('nodes-started', nodesStarted);
            reject(new Error("timed out waiting for flows to start"));
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
    let genFunc = true;
    if (arguments.length === 1 && (RED === undefined || ! RED.start)) {
        if (arguments.length > 0) result = arguments[arguments.length-1];
        RED = require('node-red');
        genFunc = false;
    }
    if (arguments.length < 3 || timeout === undefined) timeout = FLOWS_TIMEOUT;
    if (genFunc) {
        return function(value) { waitNodesStarted(RED, timeout, value) };
    }
    return waitNodesStarted(RED, timeout, result);
};

REDstart.inject = function(RED, timeout) {
    if (! RED) RED = require('node-red');
    let start = RED.start;
    // the function we will be injecting
    function injectedStart() {
        return start(arguments).then(REDstart(RED, timeout));
    }
    // injected previously already?
    if (start === injectedStart) return;
    // if not, inject ourselves
    RED.start = injectedStart;
};
