const tokens = require('./tokens.json');
const {categoryLists, callbackUrl} = require("./config.json");
const BaseApiRequester = require("./BaseApiRequester.js");

/**
 * An API requester that interfaces with the GCI site.
 */
class TrelloApiRequester extends BaseApiRequester {
    constructor(key, token) {
        super(80);
        this.key = key;
        this.token = token;
        this.start();
    }

    getName() {
        return "TrelloRequester"
    }

    async _getAllCards() {
        let rawCards = [];

        for (let list of Object.values(categoryLists)) {
            let cards = await this.getListCards(list);
            rawCards.push(...cards);
        }

        return rawCards;
    }

    getAllCards() {
        return this._getAllCards();
    }

    /**
     *
     * Get all cards from a Trello list. This includes custom fields
     * @param id The id of the trello list
     * @return {Promise} A promise that is resolved with the data
     */
    getListCards(id) {
        return this.queueRequest(this.buildTrelloGet(`lists/${id}/cards`, {customFieldItems: true}));
    }

    createCard(rawMain) {
        return this.queueRequest(this.buildTrelloPost(`cards`, rawMain));
    }

    /**
     * Writes data to the main trello card
     * @param id The id of the card to write to
     * @param data A key-value object of the data to write
     * @return {Promise<any>}
     */
    updateCardMain(id, data) {
        return this.queueRequest(this.buildTrelloPut(`cards/${id}`, data));
    }

    /**
     * Sets the value of a custom field on a Trello card
     *
     * @param card The id of the card to set the field on
     * @param field The id of the field to set
     * @param data The value to set to the field to
     * @return {Promise} A promise that is fulfilled when the PUT is finished.+
     */
    updateCustomField(card, field, data) {
        return this.queueRequest(this.buildTrelloPut(`/card/${card}/customField/${field}/item`, data));

    }

    createTrelloWebhook(card) {
        return this.queueRequest(this.buildTrelloPost("webhooks/", {
            idModel: card,
            description: `Update webhook for ${card}`,
            callbackURL: callbackUrl
        }));
    }

    getTrelloWebhooks() {
        return this.queueRequest(this.buildTrelloGet(`tokens/${this.token}/webhooks`));
    }

    deleteTrelloWebhook(webhookId) {
        return this.queueRequest(this.buildTrelloDelete(`tokens/${this.token}/webhooks/${webhookId}`));
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
                key: this.key,
                token: this.token,
                ...querys //Adds all the entries in queries to the data
            },
            json: true
        };
    }

    /**
     *
     * @param path
     * @param data
     * @param [queries]
     * @return {{method: string, uri: string, qs: {key: string, token: string}, body: string, json: boolean}}
     */
    buildTrelloPut(path, data, queries) {
        queries = queries || {};
        return {
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`,
            qs: {
                key: this.key,
                token: this.token,
                ...queries //Adds all the entries in queries to the data
            },
            body: data,
            json: true
        };
    }

    /**
     *
     * @param path
     * @param [queries]
     * @return {{qs: (*|({}&{key: *, token: *})), method: string, json: boolean, uri: string}}
     */
    buildTrelloPost(path, queries) {
        queries = queries || {};
        return {
            method: 'POST',
            uri: `https://api.trello.com/1/${path}/`,
            qs: {
                key: this.key,
                token: this.token,
                ...queries //Adds all the entries in queries to the data
            },
            json: true
        };
    }

    /**
     *
     * @param path
     * @param [queries]
     * @return {{qs: (*|({}&{key: *, token: *})), method: string, json: boolean, uri: string}}
     */
    buildTrelloDelete(path, queries) {
        queries = queries || {};
        return {
            method: 'DELETE',
            uri: `https://api.trello.com/1/${path}`,
            qs: {
                key: this.key,
                token: this.token,
                ...queries //Adds all the entries in queries to the data
            },
            json: true
        };
    }
}

module.exports = new TrelloApiRequester(tokens.trelloKey, tokens.trelloToken);