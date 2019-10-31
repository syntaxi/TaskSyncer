const Task = require('./Task');

class TaskList {

    constructor() {
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
     * @param apiInterface {GoogleInterface}
     */
    loadUsingParser(apiInterface) {
        apiInterface.loadAllTasks(this)
    }
}

module.exports = new TaskList();