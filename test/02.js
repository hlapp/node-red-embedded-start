"use strict";

/*
 * Note this test suite needs to be run as its independent process, i.e., as
 * its own invocation with tape. Otherwise the RED embedded runtime will have
 * been initialized already, and the tests here are then not only mostly
 * pointless, but the calls to RED.init() and RED.start() will produce
 * warning messages.
 */

var test = require('tape'),
    sinon = require('sinon');
var embeddedStart = require('../'),
    fixture = require('./fixture');

var RED;
var REDstart;
var testFlow;

test.onFinish(function() {
    if (REDstart && RED.start !== REDstart) RED.start = REDstart;
    fixture.closeUp(RED, testFlow);
});

RED = require('node-red');
RED.init(undefined, fixture.settings);

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

    RED.start().then(() => {
        t.ok(RED.nodes.getFlows(), 'getFlows() returns a valid value right away');
        let prom;
        t.doesNotThrow(() => { prom = addFlow() },
                       undefined,
                       'addFlow() returns without error');
        return prom;
    }).catch(fixture.failAndEnd(t));
});

test('arguments with which RED.start() is called are passed on', function(t) {
    t.plan(5);

    let funcToRestore = RED.start;
    let stub = sinon.stub(RED, "start");
    stub.returns(Promise.resolve(42));

    embeddedStart.inject(RED);
    RED.start("one").then((result) => {
        t.equal(result, 42, 'passes on to the stub we presented');
        let call = stub.getCall(0);
        t.deepEqual(call.args, ["one"], 'correctly passes through one argument');
        t.equal(call.thisValue, RED, '"this" is set to RED');
        return RED.start("one", "two", "three");
    }).then(() => {
        let call = stub.getCall(1);
        RED.start = funcToRestore; // should precede last test = this is async
        t.deepEqual(call.args, ["one", "two", "three"],
                    'correctly passes through multiple arguments');
        t.equal(call.thisValue, RED, '"this" is set to RED');
    }).catch((err) => {
        RED.start = funcToRestore;
        fixture.failAndEnd(t)(err);
    });
});
