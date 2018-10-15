const tokens = require('./tokens.json');
const request = require('request-promise');

class ApiRequester {
    constructor(googleToken, trelloKey, trelloToken) {
        this.googleToken = googleToken;
        this.trelloKey = trelloKey;
        this.trelloToken = trelloToken;
        this.rateLimit = 200;
    }

    getListCards(id) {
        return this.trelloGet(`lists/${id}/cards`);
    }

    getCustomFields(card) {
        return this.trelloGet(`cards/${card}`, "&customFieldItems=true");
    }

    trelloGet(path, queryArg) {
        return request({
            method: `GET`,
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${queryArg || ""}`,
            json: true
        }).promise();
    }

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

    setCustomField(card, field, type, value) {
        let data = {value: {}};
        data.value[type] =  value.toString();
        return this.trelloPut(`/card/${card}/customField/${field}/item`, data)
            .catch(error => console.log(`Could not write to card ${card}.\n\tGot '${error}'`));
    }

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

    updateGoogle(task, data) {
        return this.googlePut(task, data)
            .catch(error => console.log(`Could not write to card ${task}.\n\tGot '${error}'`));
    }

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

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}
module.exports = new ApiRequester(tokens.googleToken,
    tokens.trelloKey,
    tokens.trelloToken);