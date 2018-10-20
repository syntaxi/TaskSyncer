"use strict";
const taskList = require('./TaskList');
const {writeTypes} = require('./Globals');

/* First we load from Google */
taskList.loadFromGoogle()
/* Then we overwrite from Trello. */
    .then(() => {
        taskList.resetStatus();
        taskList.loadFromTrello()
        /* Then we write what wasn't updated to Trello (ie blank fields) */
            .then(() => {
                console.log("Done loading.\n\n");
                taskList.writeToTrello(writeTypes.ONLY_UNCHANGED)
                    .then(() => {
                        console.log("\n\nDone!\n");
                    });
            });
    });
"halt"; // Provides a breakpoint after statements finished