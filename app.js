"use strict";
const taskList = require('./TaskList');
const {writeTypes} = require('./Globals');
const requester = require('./ApiRequester');

/* First we load from Google */
taskList.loadFromGoogle()
    .then(() => {
        /* Then we overwrite from Trello. */
        taskList.resetStatus();
        taskList.loadFromTrello()
            .then(() => {
                /* Then we write what wasn't updated to Trello (ie blank fields) */
                console.log("Done loading.\n\n");
                taskList.writeToTrello(writeTypes.ONLY_UNCHANGED)
                    .then(() => {
                        /* Then we write the tasks to Google */
                        taskList.writeToGoogle(writeTypes.ALL)
                            .then(() => {
                                console.log("\n\nDone!\n");
                                requester.stop();
                            });
                    });
            });
    });
"halt"; // Provides a breakpoint after statements finished