"use strict";
const taskList = require('./TaskList');

/* First we load from Google */
taskList.loadFromGoogle()
    /* Then we overwrite from Trello. */
    .then(() => taskList.loadFromTrello()
        /* Then we write to Google() */
        // .then(() => {
        //     console.log("Done loading.\n\n");
        //     taskList.writeToGoogle()
                    .then(() => console.log("\n\nDone."))
        // })
    );
"halt";