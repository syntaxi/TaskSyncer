const Task = require('./Task');

const trelloInterface = require("./TrelloInterface.js");
const googleInterface = require("./GoogleInterface.js");

class TaskList {


    constructor() {
        /**
         *
         * @type {Array<Task>}
         */
        this.tasks = [];
    }

    getNewDefaultTask() {
        return new Task();
    }

    /**
     * Returns a task matching the given predicate
     * If no task in the list matched, then a new task is created.
     * This new task will be blank, aside from the defaults set in the config
     *
     * This is primarily to be used to get a task via ID.
     * @param matching The predicate to use to find matching tasks
     * @returns {Task} A task that matched the predicate or a new task
     */
    getOrMakeTask(matching) {
        /* Find index */
        let index = this.tasks.findIndex(matching);

        /* Make new task if one doesn't exist */
        if (index === -1) {
            this.tasks.push(this.getNewDefaultTask());
            index = this.tasks.length - 1;
        }
        return this.tasks[index];
    }

    /**
     * Loads all the tasks from an interface
     * @param apiInterface {ApiInterface}
     */
    loadUsingInterface(apiInterface) {
        return apiInterface.loadAllTasks(this)
    }

    /**
     * Where a new entry in a service was made, propagate that ID to the other services
     * This ensures that the data in the services is still linked
     * @return {Promise<void>} A promise that finishes when all ID's have been propagated
     * @private
     */
    async _propagateIds() {
        for (let task of this.tasks) {
            if (task.trelloCardMade) { // If we made a trello then google needs to link to it
                await googleInterface.updateOtherId(task);
            }
            if (task.googleTaskMade) { // If we made a google then trello needs to link to it
                await trelloInterface.updateOtherId(task);
            }
        }
    }

    /**
     *
     * @param apiInterface {ApiInterface}
     * @param propagateIds
     */
    writeUsingInterface(apiInterface, propagateIds) {
        return apiInterface.writeAllTasks(this)
            .tap(() => propagateIds ? this._propagateIds() : undefined)
    }
}

module.exports = new TaskList();