"use strict";
const taskList = require('./TaskList');
const {writeTypes} = require('./Globals');
const requester = require('./ApiRequester');

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

syncToTrello();
"halt"; // Provides a breakpoint after statements finished