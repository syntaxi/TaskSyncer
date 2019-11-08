const TaskList = require("./TaskList.js");

const trelloInterface = require("./TrelloInterface.js");
const trelloMonitor = require("./TrelloMonitor.js");
const googleInterface = require("./GoogleInterface.js");

class TaskSyncer {
    taskList = new TaskList();
    google = googleInterface;
    trello = trelloInterface;


    loadFromTrello() {
        return this.trello.loadAllTasks(this.taskList);
    }

    writeToTrello() {
        return this.trello.writeAllTasks(this.taskList)
            .tap(this._propagateIds);
    }

    monitorTrello() {
        trelloMonitor.setupMonitoring(this.taskList);
    }

    loadFromGoogle() {
        return this.google.loadAllTasks(this.taskList);
    }

    writeToGoogle() {
        return this.google.writeAllTasks(this.taskList)
            .tap(this._propagateIds);
    }

    monitorGoogle() {

    }

    /**
     * Where a new entry in a service was made, propagate that ID to the other services
     * This ensures that the data in the services is still linked
     * @return {Promise<void>} A promise that finishes when all ID's have been propagated
     * @private
     */
    async _propagateIds() {
        for (let task of this.taskList.getTasks()) {
            if (task.trelloCardMade) { // If we made a trello then google needs to link to it
                await googleInterface.updateOtherId(task);
            }
            if (task.googleTaskMade) { // If we made a google then trello needs to link to it
                await trelloInterface.updateOtherId(task);
            }
        }
    }
}


module.exports = new TaskSyncer();