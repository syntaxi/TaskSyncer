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
        this.rateLimit = 200;
    }

    /**
     * Get all cards from a Trello list
     * @param id The id of the trello list
     * @return {Promise} A promise that is resolved with the data
     */
    getListCards(id) {
        return this.trelloGet(`lists/${id}/cards`);
    }

    /**
     * Get all the custom fields on a given card
     * @param card The Trello card
     * @return {Promise} A promise that is resolved with the data
     */
    getCustomFields(card) {
        return this.trelloGet(`cards/${card}`, "&customFieldItems=true");
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
        //TODO: Infer the value for `type` from the type of `value`
        let data = {value: {}};
        data.value[type] = value.toString();
        return this.trelloPut(`/card/${card}/customField/${field}/item`, data)
            .catch(error => console.log(`Could not write to card ${card}.\n\tGot '${error}'`));
    }

    /**
     * Performs a GET request to the Trello api
     * @param path The path of the api to call
     * @param queryArg Any query arguments to be passed in
     * @return {Promise} A promise that is resolved with the data
     */
    trelloGet(path, queryArg) {
        return request({
            method: `GET`,
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${queryArg || ""}`,
            json: true
        }).promise();
    }

    /**
     * Performs a PUT request to the Trello API
     *
     * @param path The path of the api to follow
     * @param data The data to set the body to
     * @return {Promise} A promise resolved when the PUT is finished
     */
    async trelloPut(path, data) {
        /* We have to wait because of rate limits */
        await sleep(this.rateLimit);
        return request({
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}`,
            body: data,
            json: true
        }).promise();
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