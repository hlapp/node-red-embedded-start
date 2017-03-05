"use strict";

var path = require('path');

module.exports = {
    failAndEnd: function(test) {
        return (err) => {
            if (err && err.stack) console.error(err.stack);
            test.fail(err);
            test.end();
        };
    },
    closeUp: function(RED, flow) {
        let prom = flow ? RED.nodes.removeFlow(flow) : Promise.resolve();
        if (RED) {
            prom = prom.then(() => RED.stop());
        }
        prom.catch((e) => {
            console.error("stopping Node-RED failed:");
            console.error(e.stack ? e.stack : e);
        });
    },
    settings: {
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
    }
};
