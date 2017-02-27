"use strict";

var test = require('tape'),
    delay = require('delay');
var path = require('path');
var embeddedStart = require('../');

const REDsettings = {
    httpAdminRoot: false,
    httpNodeRoot: false,
    functionGlobalContext: {},
    disableEditor: true,
    userDir: path.join(__dirname, '.node-red'),
    logging: {
        console: {
            level: process.env.NODE_RED_LOGLEVEL || "info"
        }
    }
};

var RED;
var REDstart;
var testFlow;

function failAndEnd(t) {
    return (err) => {
        t.fail(err);
        t.end();
    };
}

test.onFinish(function() {

    function closeUp() {
        let prom = testFlow ? RED.nodes.removeFlow(testFlow) : Promise.resolve();
        if (RED) {
            prom = prom.then(() => RED.stop());
        }
        prom.catch((e) => {
            console.error("stopping Node-RED failed:");
            console.error(e.stack ? e.stack : e);
        });
    }

    if (REDstart && RED.start !== REDstart) RED.start = REDstart;
    closeUp();
});

RED = require('node-red');
RED.init(undefined, REDsettings);

test('can inject wait into RED.start()', function(t) {
    t.plan(6);

    let flow = {
        label: "Test Flow",
        nodes: [{
            id: RED.util.generateId(),
            type: 'comment',
            name: 'test',
            wires: []
        }]
    };

    function addFlow() {
        return RED.nodes.addFlow(flow).then((id) => {
            testFlow = id;
            t.ok(id, `creates valid flow ID (${id})`);
        });
    }

    REDstart = RED.start;
    embeddedStart.inject(RED);
    let ourStart = RED.start;
    t.notEqual(ourStart, REDstart, 'replaces RED.start with ours');
    embeddedStart.inject(RED);
    t.equal(RED.start, ourStart, 'repeating injection does not change this');
    RED.start = REDstart;
    embeddedStart.inject(RED);
    t.notEqual(RED.start, REDstart, 'injects again if RED.start isn\'t ours');

    RED.stop().then(delay(1000)).then(() => RED.start()).then(() => {
        t.ok(RED.nodes.getFlows(), 'getFlows() returns a valid value right away');
        let prom;
        t.doesNotThrow(() => { prom = addFlow() },
                       undefined,
                       'addFlow() returns without error');
        return prom;
    }).catch(failAndEnd(t));
});
