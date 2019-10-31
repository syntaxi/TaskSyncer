"use strict";
const taskList = require('./TaskList');
const {writeTypes} = require('./Globals');
const requester = require('./ApiRequester');

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
            /* Write this to google */
            taskList.writeToGoogle(writeTypes.ALL).then(() => {
                /* Listen to trello changes */
                _createExpressApp();
            });
        });
    });

}

function _createExpressApp() {
    /* Create the app to listen with */
    const app = express();
    app.use(bodyParser.json());

    /* Listen and respond to webhooks */
    app.post('/trelloWebhook/', (req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send("Webhook received");

        /* We exclude webhooks from this bot */
        if (req.body.action.idMemberCreator === "5bcaf9208a1b09652e06f735") {
            return;
        } else {
        }
        taskList.handleWebhookActivate(req.body);
    });

    /* Listen and respond to get requests so we can create webhooks */
    app.get("/trelloWebhook/", (req, res) => {
        console.log("Web server received a GET request");
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
    taskList.createWebhooks();

    //testing
    //requester.createTrelloWebhook("5bcdd944e1746b884c6f2db5").then(() => console.log("Created webhook for test card"));

}

// listenToChanges();
//
// const googleInterface = require("./GoogleInterface.js");
const newTaskList = require("./TaskList.js");
const trelloInterface = require("./TrelloInterface.js");
const googleInterface = require("./GoogleInterface.js");
//
// googleInterface.loadAllTasks(newTaskList).then(
//     () => {
//         googleInterface.writeTask(newTaskList.tasks[0]);
//     }
// );

// Treats google as the source of truth.
trelloInterface.loadAllTasks(newTaskList) // Load things from trello
    .then(() => googleInterface.loadAllTasks(newTaskList)) // Overwrite them with the stuff from google
    .then(() => googleInterface.writeAllTasks(newTaskList)) // Write this new list back to google
    .then(() => trelloInterface.writeAllTasks(newTaskList)) // Write this new list back to trello
    .then(result => {
        console.log("Finished!");
    });
