class ApiInterface {
    /**
     * @param taskList {TaskList}
     */
    loadAllTasks(taskList) {
        throw new Error("Method Unimplemented");

    }

    /**
     * @param taskList {TaskList}
     *
     * @return {Promise}
     */
    writeAllTasks(taskList) {
        throw new Error("Method Unimplemented");

    }

    /**
     * @param task {Task}
     */
    writeTask(task) {
        throw new Error("Method Unimplemented");
    }

    /**
     * @param task {Task}
     */
    loadTask(task) {
        throw new Error("Method Unimplemented");
    }

    /**
     *
     * @param task {Task}
     */
    updateOtherId(task) {
        throw new Error("Method Unimplemented");
    }
}

module.exports = ApiInterface;