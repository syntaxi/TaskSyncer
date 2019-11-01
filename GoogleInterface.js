const requester = require("./GoogleApiRequester.js");
const {fields} = require("./Globals");
const ApiInterface = require("./ApiInterface.js");
const Promise = require("bluebird");

class GoogleInterface extends ApiInterface {
    /**
     * Loads all the tasks from GCI into the list.
     * If possible tasks will be overwritten
     * @param taskList {TaskList} The list to write into
     */
    loadAllTasks(taskList) {
        return requester.getAllTasks().then(rawTasks => {
            for (let rawTask of rawTasks) {
                let task = taskList.getOrMakeTask(task => this.doesTaskMatchData(task, rawTask));
                this.loadIntoTask(rawTask, task);
            }
            return taskList;
        })
    }

    /**
     * Writes all the tasks contained with the list to google.
     *
     * If a task has a google id try and write to that task.
     * If the task does not have a google id, or the write fails then make a new task and write to that.
     *
     * Update the Google Id in the task if applicable
     * @param taskList {TaskList}
     */
    writeAllTasks(taskList) {
        return Promise.all(taskList.tasks.map(task => this.writeTask(task)));
    }

    loadTask(task) {
        super.loadTask(task);  //TODO: Implement
    }

    /**
     *
     * @param task {Task}
     * @return {Promise|Promise<any | never>}
     */
    writeOrCreate(task) {
        let rawTask = this.taskToRaw(task);
        if (task.getField(fields.GOOGLE_ID)) {
            return requester.updateTask(task.getField(fields.GOOGLE_ID), rawTask)
                .catch(
                    reason => {
                        if (reason.statusCode === 404) {
                            console.log(`Updating task '${task.getField(fields.NAME)}' failed. Creating new task`);
                            return requester.createTask(rawTask);
                        }
                    });
        } else {
            return requester.createTask(rawTask);
        }
    }

    /**
     *  Writes a single task to google.
     *  If it can find a task using the {@link fields.GOOGLE_ID} field then it will update that one,
     *  if it cannot then it will create a new task.
     *
     *  Updating a task will overwrite all fields with the data in the task.
     * @param task {Task} The task to push to GCI
     */
    writeTask(task) {
        return this.writeOrCreate(task)
            .then(result => {
                if (result["id"] !== task.getField(fields.GOOGLE_ID)) {
                    // We made a new task
                    console.log(`Task '${task.getField(fields.NAME)}' created on GCI`);
                    task.setField(fields.GOOGLE_ID, result["id"]);
                } else {
                    console.log(`Task '${task.getField(fields.NAME)}' updated on GCI`);
                }
            });
    }

    /**
     *
     * @param task {Task}
     * @return The data in google format
     */
    taskToRaw(task) {
        let data = {};
        data["id"] = task.getField(fields.GOOGLE_ID) || 0;
        data["name"] = task.getField(fields.NAME) || "";
        data["description"] = task.getField(fields.DESCRIPTION) || "";
        data["max_instances"] = task.getField(fields.MAX_INSTANCES) || 1;
        data["tags"] = task.getField(fields.TAGS) || [];
        data["is_beginner"] = task.getField(fields.IS_BEGINNER) || false;
        data["categories"] = task.getField(fields.CATEGORIES) || [];
        data["time_to_complete_in_days"] = task.getField(fields.DAYS) || 3;
        data["private_metadata"] = task.getField(fields.TRELLO_ID) || "";

        // Un-replicated fields
        data["status"] = task.getField(fields.STATUS) || 1;
        data["mentors"] = task.getField(fields.MENTORS) || [];
        data["external_url"] = task.getField(fields.EXTERNAL_URL) || "";

        return data;
    }

    /**
     *  Attempts to match a task by either google id or trello id prioritising google id.
     *
     * @param task {Task} The task to match with
     * @param data The data to match with
     * @return {Boolean} True if the data and the task match, False otherwise
     */
    doesTaskMatchData(task, data) {
        return task.getField(fields.GOOGLE_ID) === data["id"] || task.getField(fields.TRELLO_ID) === data["private_metadata"];
    }

    /**
     *  Overwrite a task with the given data.
     *
     * @param data The data to write in
     * @param task {Task} The task to overwrite
     */
    loadIntoTask(data, task) {
        task.setIfData(fields.GOOGLE_ID, data["id"]);
        task.setIfData(fields.NAME, data["name"]);
        task.setIfData(fields.DESCRIPTION, data["description"]);
        task.setIfData(fields.MAX_INSTANCES, data["max_instances"]);
        task.setIfData(fields.TAGS, data["tags"]);
        task.setIfData(fields.IS_BEGINNER, data["is_beginner"]);
        task.setIfData(fields.CATEGORIES, data["categories"]);
        task.setIfData(fields.DAYS, data["time_to_complete_in_days"]);
        task.setIfData(fields.TRELLO_ID, data["private_metadata"]);

        // Un-replicated fields
        task.setIfData(fields.STATUS, data["status"]);
        task.setIfData(fields.MENTORS, data["mentors"]);
        task.setIfData(fields.EXTERNAL_URL, data["external_url"]);


        // Read-only fields
        task.setIfData(fields.AVAILABLE_COUNT, data["available_count"]);
        task.setIfData(fields.CLAIMED_COUNT, data["claimed_count"]);
        task.setIfData(fields.COMPLETED_COUNT, data["completed_count"]);
        task.setIfData(fields.LAST_MODIFIED, data["last_modified"]);
    }
}

module.exports = new GoogleInterface();