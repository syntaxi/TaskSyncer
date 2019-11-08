"use strict";
global.Promise = require("bluebird"); // Globally use bluebird for promises

const taskSyncer = require("./TaskSyncer.js");

const newTaskList = require("./TaskList.js");
const trelloInterface = require("./TrelloInterface.js");
const trelloMonitor = require("./TrelloMonitor.js");
const googleInterface = require("./GoogleInterface.js");

// Treats google as the source of truth.

taskSyncer.loadFromTrello()
    .then(()=>taskSyncer.monitorTrello());

// newTaskList.loadUsingInterface(trelloInterface)
//     .then(() => trelloMonitor.setupMonitoring(newTaskList));

// newTaskList.loadUsingInterface(trelloInterface) // Load things from trello
//     .then(() => newTaskList.loadUsingInterface(googleInterface)) // Overwrite them with the stuff from google
//     .then(() => newTaskList.writeUsingInterface(googleInterface, true)) // Write this new list back to google
//     .then(() => newTaskList.writeUsingInterface(trelloInterface, true)) // Write this new list back to trello
//     .then(result => {
//         console.log("Finished!");
//     });
