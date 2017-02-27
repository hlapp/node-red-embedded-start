"use strict";

var test = require('tape'),
    sinon = require('sinon');
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
var REDevents;
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

    closeUp();
});

test('can create and initialize Node-RED runtime', function(t) {
    t.plan(3);

    t.doesNotThrow(() => {
        RED = require('node-red');
    }, undefined, 'instantiates Node-RED runtime without error');
    t.doesNotThrow(RED.init.bind(RED, undefined, REDsettings),
                   undefined,
                   'initializes Node-RED runtime without error');
    t.doesNotThrow(() => {
        REDevents = require('node-red/red/runtime/events');
    }, undefined, 'loads RED events object without erorr');
});

test('can be used to generate wait function', function(t) {
    t.plan(3);

    let f;
    t.timeoutAfter(20);
    f = embeddedStart();
    t.equal(typeof f, "function", "generates function with default runtime and timeout");
    f = embeddedStart(RED);
    t.equal(typeof f, "function", "generates function with default timeout");
    // ensure that the following don't result in executing a wait function
    f = embeddedStart(RED, 10000);
    t.equal(typeof f, "function", "generates function with given timeout");
});

test('can be used to promise waiting for \'nodes-started\'', function(t) {

    let REDresult = {}, spy = sinon.spy();

    function testWaiting(p, tt) {
        tt.ok(p instanceof Promise, 'returns promise if waiting');
        spy.reset();
        p.then((result) => {
            spy();
            tt.pass('resolves once nodes-started event fires');
            tt.equal(result, REDresult, 'passes result through');
        }).catch(failAndEnd(tt));
        setTimeout(() => {
            tt.ok(spy.notCalled, 'does not resolve before node-started event fires');
            REDevents.emit('nodes-started');
        }, 10);
    }

    t.test('using defaults', function(subtest) {
        subtest.plan(4);
        subtest.timeoutAfter(40);
        testWaiting(embeddedStart(REDresult), subtest);
    });
    t.test('using full signature', function(subtest) {
        subtest.plan(4);
        subtest.timeoutAfter(40);
        testWaiting(embeddedStart(RED, 30, REDresult), subtest);
    });
    t.end();
});

test('generated function promises to wait for \'nodes-started\'', function(t) {
    t.plan(4);

    let REDresult = {}, spy = sinon.spy();
    t.timeoutAfter(30);
    let waitFunc = embeddedStart(RED);
    let p = waitFunc(REDresult);
    t.ok(p instanceof Promise, 'returns promise if waiting');
    p.then((result) => {
        spy();
        t.pass('resolves once nodes-started event fires');
        t.equal(result, REDresult, 'passes result through');
    }).catch(failAndEnd(t));
    setTimeout(() => {
        t.ok(spy.notCalled, 'does not resolve before node-started event fires');
        REDevents.emit('nodes-started');
    }, 10);
});

test('generated function rejects if waiting times out', function(t) {
    t.plan(5);

    let REDresult = {}, spy = sinon.spy();
    t.timeoutAfter(30);
    let waitFunc = embeddedStart(RED, 20);
    let p = waitFunc(REDresult);
    t.ok(p instanceof Promise, 'returns promise if waiting');
    p.then(() => {
        t.fail('resolves despite timeout once nodes-started event fires');
        t.skip('therefore no error object either');
    }).catch((err) => {
        spy();
        t.pass('returned promise rejects if timeout before event fires');
        t.ok(err instanceof Error, 'rejects with an Error object');
    });
    setTimeout(() => {
        t.ok(spy.notCalled, 'does not resolve before node-started event fires');
    }, 10);
    setTimeout(() => {
        t.ok(spy.calledOnce, 'has rejected due to timeout before event');
        REDevents.emit('nodes-started');
    }, 25);
});

test('waiting for \'nodes-started\' results in flow API ready', function(t) {
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

    function addFlow(tt, expectSuccess) {
        let pass = (expectSuccess ? tt.pass : tt.fail).bind(tt);
        let fail = (expectSuccess ? tt.fail : tt.pass).bind(tt);

        return RED.nodes.addFlow(flow).then((id) => {
            pass('successfully created flow');
            if (id) {
                pass(`created a valid flow ID (${id})`);
            } else {
                fail(`created flow ID is not valid (${id})`);
            }
            testFlow = id;
        }).catch((err) => {
            // maintain the same number of assertions, but fail them all
            fail('addFlow() rejected with eror ' + err);
            fail('hence, no valid flow ID either');
        });
    }

    RED.start().then((result) => {
        t.comment('before waiting for \'nodes-started\':');
        t.notOk(RED.nodes.getFlows(), 'getFlows() returns null');
        t.throws(() => addFlow(t, false),
                 TypeError,
                 'addFlow() throws internal TypeError');
        return embeddedStart(RED, 5000, result);
    }).then(() => {
        t.comment('after waiting for \'nodes-started\':');
        t.ok(RED.nodes.getFlows(), 'getFlows() now returns a valid value');
        t.doesNotThrow(() => addFlow(t, true),
                       undefined,
                       'addFlow() now returns without error');
    }).catch(failAndEnd(t));
});
