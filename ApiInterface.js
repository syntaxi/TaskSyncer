/**
 * The ApiInterface is the class that does the bulk lifting in converting the data in a task, into the data a service uses.
 * At present the only two services supported are Trello ({@link TrelloInterface} and the GCI site ({@link GoogleInterface})
 *
 * The basic class for an ApiInterface, with no methods implemented
 */
class ApiInterface {
    /**
     * Load all the tasks from the service into the task list.
     * This will attempt to match pre-existing tasks via service ID.
     * If no match was possible it will instead create a new task and populate that.
     *
     * Data in tasks is only overwritten if the new data is not "blank". At present this means it is not:
     *  - undefined
     *  - null
     *  - []
     *  - {}
     *  - ""
     * The exception to this is if the field on the task contains null, in which case it will always be overwritten
     * @param taskList {TaskList} The list to populate
     * @return {Promise<TaskList>} A Promise containing the now updated TaskList
     */
    loadAllTasks(taskList) {
        throw new Error("Method Unimplemented");

    }

    /**
     * Write every task in the task list into the service.
     *
     * If possible, will attempt to update an existing entry using the relevant unique service ID.
     * If this fails the interface will instead fall back and create a new entry in that service and populate it with the values
     * After this method the service ID on the task will point to whatever entry was updated, new or pre-existing
     *
     * Note, if an entry is created rather than updated this will be reflected in the relevant flag field on the Task.
     *
     * @param taskList {TaskList} The list to write to the service
     * @return {Promise<TaskList>} A Promise containing the (potentially updated) task list
     */
    writeAllTasks(taskList) {
        return Promise.all( // Group all the following promises into one
            taskList.getTasks() // Get all the tasks
                .map(task => this.writeTask(task)) // Convert each task into a map that will updated the task
        ).then(() => taskList); // Make the return type the taskList
    }

    /**
     * Writes a single task to the service.
     *
     * Like the related method {@link ApiInterface#writeAllTasks()} this will attempt to update and existing entry,
     * but will fall back and create a new one if this fails.
     * Also similarly, after this method the task will point to whatever entry was updated
     *
     * @param task {Task} The task to write
     * @return {Promise<Task>} The task that was written
     */
    writeTask(task) {
        throw new Error("Method Unimplemented");
    }

    /**
     * Deletes a single entry from the service.
     *
     * This will fail silently if the task could not be found on the service,
     * as this will be assumed to indicate that it is already deleted.
     * The deletion will not be propagated over to other services
     *
     * @param task {Task} The task to delete
     * @return {Promise<>} A promise that with finish when the task is deleted
     */
    deleteTask(task) {
        throw new Error("Method Unimplemented");
    }

    /**
     * Updates the ID of the other services in the entry for this task.
     * This is used to ensure that the task can be correctly matched across all services
     *
     * @param task {Task} The task to update
     * @return {Promise<Task>} The task once it is updated
     */
    updateOtherId(task) {
        throw new Error("Method Unimplemented");
    }

}

module.exports = ApiInterface;