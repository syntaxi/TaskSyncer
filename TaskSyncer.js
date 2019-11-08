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
            .tap(this._propagateIds);
    }

    monitorTrello() {
        trelloMonitor.setMonitorCallbacks(this.onTrelloCreated, this.onTrelloDeleted, this.onTrelloAltered);
        trelloMonitor.setupMonitoring(this.taskList);
    }

    /**
     * @param task {Task}
     */
    onTrelloCreated(task) {
        googleInterface.writeOrCreate(task)
            .then(() => console.log("Creation pushed to google"));
    }

    /**
     * @param task {Task}
     */
    onTrelloDeleted(task) {
        googleInterface.deleteTask(task)
            .then(() => console.log(`Deletion pushed to google`));
    }

    /**
     *
     * @param task {Task}
     * @param updatedFields {String[]}
     */
    onTrelloAltered(task, updatedFields) {
        googleInterface.writeTask(task)
            .then(() => console.log("Alteration pushed to google"));
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

    onGoogleCreated(task) {
        console.log(`Task ${task.getField(fields.NAME)} created`)
    }

    onGoogleDeleted(task) {
        console.log(`Task ${task.getField(fields.NAME)} deleted`)
    }

    onGoogleAltered(task, alteredFields) {
        console.log(`Task ${task.getField(fields.NAME)} updated: "${alteredFields.map(field => `'${field}'`).join(", ")}"`)
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