const requester = require("./GoogleApiRequester.js");
const {fields} = require("./Globals");
const ApiInterface = require("./ApiInterface.js");

/**
 * An interface between the Google Code-In site, and the internal data representation
 *
 * @typedef {{
 *      categories: [number]
 *      id:number
 *      name:string
 *      description:string
 *      available_count: number
 *      claimed_count: number
 *      completed_count: number
 *      external_url: string
 *      is_beginner: boolean
 *      last_modified: string
 *      max_instances: number
 *      mentors: [string]
 *      private_metadata: string
 *      status: number
 *      tags: [string]
 *      time_to_complete_in_days: number
 *  }} RawGoogle
 *
 * @see ApiInterface
 */
class GoogleInterface extends ApiInterface {
    /**
     * @inheritDoc
     */
    updateOtherId(task) {
        return requester.updateTask(task, this.taskToRaw(task));
    }

    /**
     * @inheritDoc
     */
    loadAllTasks(taskList) {
        return requester.getAllTasks().then(rawTasks => {
            for (let rawTask of rawTasks) {
                let task = taskList.getOrMakeTask(task => this.doesTaskMatchData(task, rawTask));
                this.loadIntoTask(rawTask, task);
                console.log(`Loaded task '${task.getField(fields.NAME)}' from GCI`);
            }
            return taskList;
        })
    }

    /**
     * @inheritDoc
     */
    writeTask(task) {
        task.resetUpdatedFields();
        return this.writeOrCreate(task)
            .then(() => {
                if (task.wasFieldUpdated(fields.GOOGLE_ID)) {// We made a new task
                    console.log(`Task '${task.getField(fields.NAME)}' created on GCI`);
                    task.googleTaskMade = true;
                } else {
                    console.log(`Task '${task.getField(fields.NAME)}' updated on GCI`);
                    task.googleTaskMade = false;
                }
            });
    }

    /**
     * @inheritDoc
     */
    loadTask(task) {
        return super.loadTask(task);  //TODO: Implement
    }

    /**
     * Attempts to either write the given data to a pre-existing entry,
     * If that fails, then falls back to creating a new entry and updating that instead
     *
     * @param task {Task}
     * @return {Promise<RawGoogle>}
     */
    writeOrCreate(task) {
        let rawTask = this.taskToRaw(task);
        if (task.getField(fields.GOOGLE_ID)) {
            return requester.updateTask(task.getField(fields.GOOGLE_ID), rawTask)
                .catch(
                    reason => {
                        if (reason.statusCode === 404) { // 404 code indicates the ID is bogus and we need to make a new task
                            console.log(`Updating task '${task.getField(fields.NAME)}' failed. Creating new task`);
                            return requester.createTask(rawTask)
                                .tap(response => task.setField(fields.GOOGLE_ID, response[id]));
                        }
                    });
        } else {
            return requester.createTask(rawTask)
                .tap(response => task.setField(fields.GOOGLE_ID, response["id"]));
        }
    }

    /**
     * Converts a task into the raw data used by the google service
     *
     * @param task {Task} The task to convert
     * @return {RawGoogle} The data in google format
     */
    taskToRaw(task) {
        let data = {};
        data.id = task.getField(fields.GOOGLE_ID) || 0;
        data.name = task.getField(fields.NAME) || "";
        data.description = task.getField(fields.DESCRIPTION) || "";
        data.max_instances = task.getField(fields.MAX_INSTANCES) || 1;
        data.tags = task.getField(fields.TAGS) || [];
        data.is_beginner = task.getField(fields.IS_BEGINNER) || false;
        data.categories = task.getField(fields.CATEGORIES) || [];
        data.time_to_complete_in_days = task.getField(fields.DAYS) || 3;
        data.private_metadata = task.getField(fields.TRELLO_ID) || "";

        // Un-replicated fields
        data.status = task.getField(fields.STATUS) || 1;
        data.mentors = task.getField(fields.MENTORS) || [];
        data.external_url = task.getField(fields.EXTERNAL_URL) || "";

        return data;
    }

    /**
     * Attempts to match a task by either google id or trello id (prioritising google id).
     *
     * @param task {Task} The task to match with
     * @param data {RawGoogle} The data to match with
     * @return {Boolean} True if the data and the task match, False otherwise
     */
    doesTaskMatchData(task, data) {
        return task.getField(fields.GOOGLE_ID) === data.id || task.getField(fields.TRELLO_ID) === data.private_metadata;
    }

    /**
     *  Overwrite a task with the given data.
     *
     *  The field is only overwritten following the rules given in {@link ApiInterface#loadAllTasks()}
     *
     * @param data {RawGoogle} The data to write in
     * @param task {Task} The task to overwrite
     */
    loadIntoTask(data, task) {
        task.setIfData(fields.GOOGLE_ID, data.id);
        task.setIfData(fields.NAME, data.name);
        task.setIfData(fields.DESCRIPTION, data.description);
        task.setIfData(fields.MAX_INSTANCES, data.max_instances);
        task.setIfData(fields.TAGS, data.tags);
        task.setIfData(fields.IS_BEGINNER, data.is_beginner);
        task.setIfData(fields.CATEGORIES, data.categories);
        task.setIfData(fields.DAYS, data.time_to_complete_in_days);
        task.setIfData(fields.TRELLO_ID, data.private_metadata);

        // Un-replicated fields
        task.setIfData(fields.STATUS, data.status);
        task.setIfData(fields.MENTORS, data.mentors);
        task.setIfData(fields.EXTERNAL_URL, data.external_url);

        // Read-only fields
        task.setIfData(fields.AVAILABLE_COUNT, data.available_count);
        task.setIfData(fields.CLAIMED_COUNT, data.claimed_count);
        task.setIfData(fields.COMPLETED_COUNT, data.completed_count);
        task.setIfData(fields.LAST_MODIFIED, data.last_modified);
    }
}

module.exports = new GoogleInterface();