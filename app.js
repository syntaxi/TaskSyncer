"use strict";
global.Promise = require("bluebird"); // Globally use bluebird for promises

const taskSyncer = require("./TaskSyncer.js");

// Treats google as the source of truth.
taskSyncer.loadFromGoogle() // Load from google
    .then(() => taskSyncer.loadFromTrello()) // Overwrite from trello
    .then(() => taskSyncer.writeToGoogle()) // Push to google
    .then(() => taskSyncer.writeToTrello()) // Push to trello
    .then(() => taskSyncer.monitorTrello()) // Monitor trello for changes
    .then(() => taskSyncer.monitorGoogle()); // Monitor google for changes

// newTaskList.loadUsingInterface(trelloInterface)
//     .then(() => trelloMonitor.setupMonitoring(newTaskList));

// newTaskList.loadUsingInterface(trelloInterface) // Load things from trello
//     .then(() => newTaskList.loadUsingInterface(googleInterface)) // Overwrite them with the stuff from google
//     .then(() => newTaskList.writeUsingInterface(googleInterface, true)) // Write this new list back to google
//     .then(() => newTaskList.writeUsingInterface(trelloInterface, true)) // Write this new list back to trello
//     .then(result => {
//         console.log("Finished!");
//     });

// Warn if overriding existing method
if(Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time
    if (this.length !== array.length)
        return false;

    for (let i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] !== array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
};
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});
