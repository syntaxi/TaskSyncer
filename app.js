"use strict";
const taskList = require('./TaskList');

/* First we load from Google */
taskList.loadFromGoogle()
/* Then we overwrite from Trello. */
    .then(() => {
        taskList.resetStatus();
        taskList.loadFromTrello()
        /* Then we write what wasn't updated to Trello (ie blank fields) */
            .then(() => {
                console.log("Done loading.\n\n");
                taskList.writeToTrello()
                    .then(() => {
                        console.log("\n\nDone!\n");
                    });
            });
    });
"halt"; // Provides a breakpoint after statements finished