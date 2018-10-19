const tokens = require('./tokens.json');
const request = require('request-promise');

/**
 * Interacts with the api.
 * Includes limiting where needed to slow down requests
 */
class ApiRequester {
    constructor(googleToken, trelloKey, trelloToken) {
        this.googleToken = googleToken;
        this.trelloKey = trelloKey;
        this.trelloToken = trelloToken;
        this.trelloRequests = [];
        this.requestsPer10Sec = 95;
        this.requestCount = 0;
        setInterval(() => {
            this.requestCount = 0;
            this.processTrello()
        }, 10000);
    }

    /**
     * Processes as many trello requests as it can.
     * Once it hits the maximum it pauses until the interval function set in the constructor resets the request counter
     */
    processTrello() {
        while (this.requestCount <= this.requestsPer10Sec && this.trelloRequests.length > 0) {
            let [payload, resolve] = this.trelloRequests.pop();
            request(payload).then(resolve)
        }
    }

    /**
     * Get all cards from a Trello list
     * @param id The id of the trello list
     * @return {Promise} A promise that is resolved with the data
     */
    getListCards(id) {
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloGet(`lists/${id}/cards`),
                resolve
            ])
        );
        this.processTrello();
        return promise;
    }

    /**
     * Get all the custom fields on a given card
     * @param card The Trello card
     * @return {Promise} A promise that is resolved with the data
     */
    getCustomFields(card) {
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloGet(`cards/${card}`, "&customFieldItems=true"),
                resolve
            ])
        );
        this.processTrello();
        return promise
    }

    /**
     * Sets the value of a custom field on a Trello card
     *
     * @param card The id of the card to set the field on
     * @param field The id of the field to set
     * @param type The type of the value
     * @param value The value to set to
     * @return {Promise} A promise that is fulfilled when the PUT is finished.+
     */
    setCustomField(card, field, type, value) {
        let data = {value: {}};
        //TODO: Infer the value for `type` from the type of `value`
        data.value[type] = value.toString();
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift(
                this.buildTrelloPut(`/card/${card}/customField/${field}/item`, data),
                resolve
            )
        );
        this.processTrello();
        return promise;
    }

    /**
     * Builds the options for a get request to trello
     * @param path
     * @param queryArg
     * @return {{method: string, uri: string, json: boolean}}
     */
    buildTrelloGet(path, queryArg) {
        return {
            method: `GET`,
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${queryArg || ""}`,
            json: true
        };
    }

    buildTrelloPut(path, data) {
        return {
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}`,
            body: data,
            json: true
        }
    }

    /**
     * Updates a task in the Google API
     *
     * @param task The id of the task to update
     * @param data The data to update the task to
     * @return {Promise} A promise resolved when the PUT is finished
     */
    updateGoogle(task, data) {
        return this.googlePut(task, data)
            .catch(error => console.log(`Could not write to card ${task}.\n\tGot '${error}'`));
    }

    /**
     * Performs a GET request to the Google api
     *
     * @param item The area of the api to make the request to
     * @param queryArg Any query arg to include
     * @return {Promise} A promise that is resolved with the data
     */
    googleGet(item, queryArg) {
        return request({
            method: 'GET',
            uri: `https://codein.withgoogle.com/api/program/current/${item}/${queryArg ? "?" : ""}${queryArg}`,
            auth: {
                'bearer': this.googleToken
            },
            json: true

        }).promise();
    }

    /**
     * Makes a PUT request to the google api
     * @param taskId The id of the task to PUT to
     * @param data The data to sent to the task
     * @return {Promise} A promise that is resolved with the data
     */
    googlePut(taskId, data) {
        return request({
            method: 'PUT',
            uri: `https://codein.withgoogle.com/api/program/current/tasks/${taskId}/`,
            auth: {
                'bearer': this.googleToken
            },
            body: data,
            json: true
        }).promise();
    }

    /**
     * Makes a POST request to the google api
     * @param data The data to sent to the task
     * @return {Promise} A promise that is resolved with the data
     */
    googlePost(data) {
        return request({
            method: 'POST',
            uri: `https://codein.withgoogle.com/api/program/current/tasks/`,
            auth: {
                'bearer': this.googleToken
            },
            body: data,
            json: true
        }).promise();
    }
}

/**
 * Returns a promise that resolves after the specified time.
 * To be used with `await sleep(<time>)` to pause
 *
 * @param ms The number of milliseconds to wait for
 * @return {Promise<any>}
 */
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}

module.exports = new ApiRequester(tokens.googleToken,
    tokens.trelloKey,
    tokens.trelloToken);