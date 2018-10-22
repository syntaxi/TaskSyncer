const tokens = require('./tokens.json');
const request = require('request-promise');
const Promise = require('bluebird');

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
        this.trelloLimit = 80;
        this.trelloCount = 0;
        this.googleRequests = [];
        this.googleLimit = 95;
        this.googleCount = 0;
        this.start();
    }

    /**
     * Stops the intervals from ticking.
     */
    stop() {
        clearInterval(this.trelloInterval);
        clearInterval(this.googleInterval);
    }

    start() {
        this.trelloInterval = setInterval(() => {
            if (this.trelloCount !== 0) {
                console.log("\tResetting trello count");
            }
            this.trelloCount = 0;
            this.processTrello()
        }, 10000);
        this.googleInterval = setInterval(() => {
            if (this.googleCount !== 0) {
                console.log("\tResetting google count");
            }
            this.googleCount = 0;
            this.processGoogle()
        }, 10000);
    }

    /**
     * Processes as many trello requests as it can.
     * Once it hits the maximum it pauses until the interval function set in the constructor resets the request counter
     */
    processTrello() {
        while (this.trelloCount <= this.trelloLimit && this.trelloRequests.length > 0) {
            let [payload, resolve] = this.trelloRequests.pop();
            request(payload).then(resolve);
            this.trelloCount += 1;
            //console.log("Trello Calls: " + this.trelloCount);
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
                this.buildTrelloGet(`cards/${card}`, {customFieldItems: true}),
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
     * @param value The value to set to the field to
     * @return {Promise} A promise that is fulfilled when the PUT is finished.+
     */
    setCustomField(card, field, value) {
        let data = {value: {}};
        switch (typeof value) {
            case 'boolean':
                data.value.checked = value.toString();
                break;
            case 'string':
                data.value.text = value.toString();
                break;
            case 'number':
                data.value.number = value.toString();
                break;
            default:
                throw  TypeError("Unknown type for trello custom field: " + typeof value);
        }
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloPut(`/card/${card}/customField/${field}/item`, data),
                resolve
            ])
        );
        this.processTrello();
        return promise;
    }

    /**
     * Writes data to the main trello card
     * @param card The id of the card to write to
     * @param data A key-value object of the data to write
     * @return {Promise<any>}
     */
    writeMainTrello(card, data) {
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloPut(`cards/${card}`, data),
                resolve
            ])
        );
        this.processTrello();
        return promise
    }

    createTrelloWebhook(card) {
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloPost("webhooks/", {
                    idModel: card,
                    description: `Update webhook for ${card}`,
                    callbackURL: "http://518344c2.ngrok.io/trelloWebhook/"
                }),
                resolve
            ])
        );
        this.processTrello();
        return promise
    }

    getTrelloWebhooks() {
        const promise = new Promise(resolve =>
            this.trelloRequests.unshift([
                this.buildTrelloGet(`tokens/${this.trelloToken}/webhooks`),
                resolve
            ])
        );
        this.processTrello();
        return promise
    }

    /**
     * Builds the options for a get request to trello
     * @param path
     * @param [querys]
     * @return {{method: string, uri: string, json: boolean}}
     */
    buildTrelloGet(path, querys) {
        querys = querys || {};
        return {
            method: "GET",
            uri: `https://api.trello.com/1/${path}`,
            qs: {
                key: this.trelloKey,
                token: this.trelloToken,
                ...querys //Adds all the entries in queries to the data
            },
            json: true
        };
    }

    /**
     *
     * @param path
     * @param data
     * @param [querys]
     * @return {{method: string, uri: string, qs: {key: string, token: string}, body: string, json: boolean}}
     */
    buildTrelloPut(path, data, querys) {
        querys = querys || {};
        return {
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`,
            qs: {
                key: this.trelloKey,
                token: this.trelloToken,
                ...querys //Adds all the entries in queries to the data
            },
            body: data,
            json: true
        };
    }

    /**
     *
     * @param path
     * @param [querys]
     * @return {{method: string, uri: string, qs: {key: string, token: string}, body: string, json: boolean}}
     */
    buildTrelloPost(path, querys) {
        querys = querys || {};
        return {
            method: 'POST',
            uri: `https://api.trello.com/1/${path}`,
            qs: {
                key: this.trelloKey,
                token: this.trelloToken,
                ...querys //Adds all the entries in queries to the data
            },
            json: true
        };
    }

    /**
     * Processes as many google requests as it can.
     * Once it hits the maximum it pauses until the interval function set in the constructor resets the request counter
     */
    processGoogle() {
        while (this.googleCount <= this.googleLimit && this.googleRequests.length > 0) {
            let [payload, resolve] = this.googleRequests.pop();
            request(payload).then(resolve);
            this.googleCount += 1;
            //console.log("Google Calls: " + this.googleCount);
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
        const promise = new Promise(resolve =>
            this.googleRequests.unshift(
                [this.buildGooglePut(task, data), resolve]
            )
        );
        this.processGoogle();
        return promise;
    }

    createGoogleTask(data) {
        const promise = new Promise(resolve =>
            this.googleRequests.unshift(
                [this.buildGooglePost(data), resolve]
            )
        );
        this.processGoogle();
        return promise;
    }

    getTaskPage(pageNum) {
        pageNum = pageNum.split("?")[1];
        const promise = new Promise(resolve =>
            this.googleRequests.unshift(
                [this.buildGoogleGet('tasks', pageNum), resolve]
            )
        );
        this.processGoogle();
        return promise;
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
                'bearer': this.googleToken
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
                'bearer': this.googleToken
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
                'bearer': this.googleToken
            },
            body: data,
            json: true
        };
    }
}

module.exports = new ApiRequester(tokens.googleToken,
    tokens.trelloKey,
    tokens.trelloToken);


