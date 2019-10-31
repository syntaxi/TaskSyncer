const tokens = require('./tokens.json');
const BaseApiRequester = require("./BaseApiRequester.js");

/**
 * An API requester that interfaces with the GCI site.
 */
class GoogleApiRequester extends BaseApiRequester {
    constructor(googleToken) {
        super(95);
        this.token = googleToken;
        this.start();
    }

    getName() {
        return "GoogleRequester"
    }

    /**
     * Updates a task in the Google API
     *
     * @param task The id of the task to update
     * @param data The data to update the task to
     * @returns {Promise} A promise which is fulfilled by the request response
     */
    updateTask(task, data) {
        return this.queueRequest(this.buildGooglePut(task, data));
    }

    /**
     * Creates a new task on the google site
     * @param data The data to set on the new task
     * @returns {Promise} A promise which is fulfilled by the request response
     */
    createTask(data) {
        return this.queueRequest(this.buildGooglePost(data));
    }

    /**
     * Gets a page of responses
     * @param pageNum The number of the page to get
     * @returns {Promise} A promise which is fulfilled by the request response
     */
    getTaskPage(pageNum) {
        return this.queueRequest(this.buildGoogleGet('tasks', pageNum));
    }

    async _getAllTasks() {
        let next = 1;
        let result = [];
        while (next !== -1) {
            let response = await this.getTaskPage(next);
            result.push(...response.results);
            if (response.next) {
                next = response.next.split("?")[1];
            } else {
                next = -1;
            }
        }
        return result;
    }

    /**
     *
     * @returns {Promise|Promise<*>}
     */
    getAllTasks() {
        return this._getAllTasks();
    }

    /**
     * Performs a GET request to the Google api
     *
     * @param item The area of the api to make the request to
     * @param queryArg Any query arg to include
     */
    buildGoogleGet(item, queryArg) {
        return {
            method: 'GET',
            uri: `https://codein.withgoogle.com/api/program/current/${item}/${queryArg ? "?" : ""}${queryArg}`,
            auth: {
                'bearer': this.token
            },
            json: true
        };
    }

    /**
     * Makes a PUT request to the google api
     * @param taskId The id of the task to PUT to
     * @param data The data to sent to the task
     */
    buildGooglePut(taskId, data) {
        return {
            method: 'PUT',
            uri: `https://codein.withgoogle.com/api/program/current/tasks/${taskId}/`,
            auth: {
                'bearer': this.token
            },
            body: data,
            json: true
        };
    }

    /**
     * Makes a POST request to the google api
     * @param data The data to sent to the task
     */
    buildGooglePost(data) {
        return {
            method: 'POST',
            uri: `https://codein.withgoogle.com/api/program/current/tasks/`,
            auth: {
                'bearer': this.token
            },
            body: data,
            json: true
        };
    }

}

module.exports = new GoogleApiRequester(tokens.googleToken);