const TaskList = require("./TaskList.js");

const {fields, categories} = require("./Globals");
const trelloInterface = require("./TrelloInterface.js");
const trelloMonitor = require("./TrelloMonitor.js");
const googleInterface = require("./GoogleInterface.js");
const googleMonitor = require("./GoogleMonitor.js");

class TaskSyncer {
    taskList = TaskList;
    google = googleInterface;
    trello = trelloInterface;


    loadFromTrello() {
        return this.trello.loadAllTasks(this.taskList);
    }

    writeToTrello() {
        return this.trello.writeAllTasks(this.taskList)
            .tap(this._propagateIds.bind(this));
    }

    monitorTrello() {
        trelloMonitor.setMonitorCallbacks(this.onTrelloCreated, this.onTrelloDeleted, this.onTrelloAltered);
        trelloMonitor.setupMonitoring(this.taskList);
    }

    /**
     * @param task {Task}
     */
    onTrelloCreated(task) {
        return googleInterface.writeOrCreate(task)
    }

    /**
     * @param task {Task}
     */
    onTrelloDeleted(task) {
        return googleInterface.deleteTask(task)
    }

    /**
     *
     * @param task {Task}
     * @param updatedFields {String[]}
     */
    onTrelloAltered(task, updatedFields) {
        return googleInterface.writeTask(task)
    }

    loadFromGoogle() {
        return this.google.loadAllTasks(this.taskList);
    }

    writeToGoogle() {
        return this.google.writeAllTasks(this.taskList)
            .tap(this._propagateIds.bind(this));
    }

    monitorGoogle() {
        googleMonitor.setMonitorCallbacks(this.onGoogleCreated, this.onGoogleDeleted, this.onGoogleAltered);
        googleMonitor.setupMonitoring(this.taskList);
    }

    /**
     *
     * @param task {Task}
     */
    onGoogleCreated(task) {
        return trelloInterface.createCard(task);
    }

    /**
     *
     * @param task {Task}
     */
    onGoogleDeleted(task) {
        return trelloInterface.deleteTask(task);
    }

    /**
     *
     * @param task {Task}
     * @param alteredFields {String[]}
     */
    onGoogleAltered(task, alteredFields) {
        return trelloInterface.writeFields(task, alteredFields);
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