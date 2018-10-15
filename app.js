"use strict";
const taskList = require('./TaskList');

taskList.loadFromGoogle()
    .then(() => taskList.loadFromTrello()
        .then(() => {
            console.log("Done loading.\n\n");
            taskList.writeToGoogle()
                // .then(() => taskList.writeToGoogle()
                    .then(() => console.log("\n\nDone."))
                // )
        })
    );
