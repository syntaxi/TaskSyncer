const Task = require('./Task');

const trelloInterface = require("./TrelloInterface.js");
const googleInterface = require("./GoogleInterface.js");

/**
 * @callback TaskMatcher
 * @param task {Task} The task to match
 * @return {boolean} True if the task matched, false otherwise
 */
class TaskList {

    constructor() {
        /**
         *
         * @type {Array<Task>}
         */
        this.tasks = [];
    }

    getDefaultTask(){
        return new Task();
    }

    createTask() {
        let task = this.getDefaultTask();
        this.tasks.push(task);
        return task;
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
        return index === -1 ? this.createTask() : this.tasks[index];
    }



    /**
     * Gets a task matching the given predicate
     *
     * @param matching {TaskMatcher} The predicate to check each card against
     * @return {Task|undefined} A matching car dif there is one, undefined if there is not
     */
    getTask(matching) {
        return this.tasks.find(matching);
    }

    /**
     * Deletes the first task matching the predicate
     * @param matching {TaskMatcher} The predicate to check each task against
     * @return {boolean} True if the task was deleted, false otherwise.
     */
    deleteTask(matching) {
        let matchingIndex = this.tasks.findIndex(matching);
        if (matchingIndex >= 0) {
            this.tasks.splice(matchingIndex, 1);
            return true;
        } else {
            // TODO error? Need to decide on a universal method
            return false;
        }
    }

    /**
     * Deletes a given task from the list
     * @param task The task to delete
     * @return {boolean} True if it was deleted false otherwise
     */
    deleteThisTask(task) {
        return this.deleteTask(other => other === task);
    }

    /**
     * Get a mutable collection of all the tasks this list contains
     * @return {[Task]}
     */
    getTasks() {
        return this.tasks;
    }

}

module.exports = new TaskList();