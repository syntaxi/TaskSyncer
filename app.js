"use strict";
const taskList = require('./TaskList');
const {writeTypes} = require('./Globals');
const requester = require('./ApiRequester');

const request = require('request-promise');
const express = require('express');
const bodyParser = require('body-parser');

function syncToGoogle() {
    /* First we load from Google */
    taskList.loadFromGoogle()
        .then(() => {
            /* Then we overwrite from Trello. */
            taskList.resetStatus();
            taskList.loadFromTrello()
                .then(() => {
                    /* Then we write what wasn't updated to Trello (ie blank fields) */
                    console.log("Done loading.\n\n");
                    taskList.writeToTrello(writeTypes.ONLY_UNUPDATED)
                        .then(() => {
                            /* Then we write the tasks to Google */
                            taskList.writeToGoogle(writeTypes.ONLY_UPDATED)
                                .then(() => {
                                    console.log("\n\nDone!\n");
                                    requester.stop();
                                });
                        });
                });
        });
}

function syncToTrello() {
    /* First we load from Trello */
    taskList.loadFromTrello()
        .then(() => {
            /* Then we overwrite from Google. */
            taskList.resetStatus();
            taskList.loadFromGoogle()
                .then(() => {
                    /* Then we write only what was changed to trello */
                    console.log("Done loading.\n\n");
                    taskList.writeToTrello(writeTypes.ONLY_CHANGED)
                        .then(() => {
                            console.log("\n\nDone!\n");
                            requester.stop();
                        });
                });
        });
}

function listenToChanges() {
    /* Load from google */
    taskList.loadFromGoogle().then(() => {
        /* Overwrite with trello */
        taskList.loadFromTrello().then(() => {
            /* Listen to trello changes */
            _createExpressApp();
        });
    });

}

function _createExpressApp() {
    /* Create the app to listen with */
    const app = express();
    app.use(bodyParser.json());

    /* Listen and respond to webhooks */
    app.post('/trelloWebhook/', (req, res) => {
        const body = req.body;
        console.log(body);
        res.set('Content-Type', 'text/plain');
        res.send(`You sent: ${body} to Express`);
    });

    /* Listen and respond to get requests so we can create webhooks */
    app.get("/trelloWebhook/", (req, res) => {
        console.log("Get request received");
        res.set('Content-Type', 'text/plain');
        res.send("Get received.");
    });

    /* Start the app */
    app.listen(3000, function (err) {
        if (err) {
            throw err
        }
        console.log('Server started on port 3000')
    });
}

listenToChanges();