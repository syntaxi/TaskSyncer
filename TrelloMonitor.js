const trelloInterface = require("./TrelloInterface");
const {fields, categories} = require("./Globals");
const {categoryLists, callbackUrl, boardId, botMemberId} = require("./config.json");
const catLookup = Object.entries(categoryLists).reduce((ret, entry) => {
    const [key, value] = entry;
    ret[value] = key;
    return ret;
}, {});

const express = require('express');
const bodyParser = require('body-parser');
const requester = require("./TrelloApiRequester.js");
/**
 *
 * @typedef {{
 *     active: boolean
 *     callbackURL: string
 *     consecutiveFailures: number
 *     description: string
 *     firstConsecutiveFailDate: string
 *     id: string
 *     idModel: string
 * }} RawTrelloWebhook
 *
 *
 * @typedef {{
 *      date: string
 *      id: string
 *      idMemberCreator: string
 *      type: string
 *      display: {
 *          translationKey: string
 *      }
 *      data: {
 *          card: {idList: string,id: string,name: string, [desc]:string}
 *          [listAfter]: IdNameTuple
 *          [listBefore]: IdNameTuple
 *          [customField]: IdNameTuple
 *          [customFieldItem]: RawCustomField
 *      }
 * }} WebhookAction
 *
 * @typedef {{id: string, name: string}} IdNameTuple
 *
 */
class TrelloMonitor {
    /**
     * @inheritDoc
     */
    setupMonitoring(taskList) {
        this._createExpressApp();
        requester.getTrelloWebhooks().then(this._refreshWebhooks);
        this.monitoredList = taskList;
    }


    /**
     *
     * @param body {WebhookAction}
     */
    onWebhookActivate(body) {
        let actionType = body.display.translationKey;

        switch (actionType) {
            case "action_renamed_card":
            case "action_changed_description_of_card":
                return this.onMainChanged(body.data.card);
            case "action_update_custom_field_item":
                return this.onCustomChanged(body.data.customField, body.data.customFieldItem, body.data.card);
            case "action_create_card":
                return this.onCardCreated(body.data.card);
            case "action_archived_card":
                return this.onCardDeleted(body.data.card);
            case "action_move_card_from_list_to_list":
                let movedInto = !!catLookup[body.data.listAfter.id];
                let movedOut = !!catLookup[body.data.listBefore.id];

                if (movedInto && movedOut) { // Moved card
                    return this.onCardMoved(body.data.listBefore, body.data.listAfter, body.data.card);
                } else if (movedInto && !movedOut) { // New card
                    return this.onCardCreated(body.data.card);
                } else if (!movedInto && movedOut) { //Delete card
                    return this.onCardDeleted(body.data.card);
                } else {
                    //fallthrough to print
                }
            // fallthrough when else is hit
            default:
                console.error("Irrelevant webhook trigger")
        }
    }


    /**
     * Updates all trello webhooks.
     *
     * This will update any existing ones to point to the correct callback,
     * delete any no longer valid/relevant ones,
     * and create a new webhook for each element lacking one
     *
     * At present only the board requires a webhook
     *
     * @param webhooks The webhooks to refresh
     * @return {Promise<void>}
     * @private
     */
    async _refreshWebhooks(webhooks) {
        console.log("Processing trello webhooks");
        let elements = new Set();
        elements.add(boardId);
        for (let webhook of webhooks) {
            if (elements.has(webhook.idModel)) {
                if (webhook.callbackURL !== callbackUrl) {
                    await requester.updateTrelloWebhook(webhook.id, webhook.idModel);
                    console.log(`Webhook for '${webhook.idModel}' updated`);
                } else {
                    console.log(`Webhook for '${webhook.idModel}' unchanged`);
                }
                elements.delete(webhook.idModel);
            } else {
                await requester.deleteTrelloWebhook(webhook.id);
                console.log(`Webhook for '${webhook.idModel}' deleted`);
            }
        }
        for (let category of elements) {
            await requester.createTrelloWebhook(category);
            console.log(`Webhook for '${category}' created`);
        }
    }



    /**
     * Starts an express server to listen for webhooks on port 3000
     *
     * @private
     */
    _createExpressApp() {
        /* Create the app to listen with */
        const app = express();
        app.use(bodyParser.json());

        /* Listen and respond to webhooks */
        app.post('/trelloWebhook/', (req, res) => {
            res.set('Content-Type', 'text/plain');
            res.send("Webhook received");
            if (req.body.action.idMemberCreator !== botMemberId) {
                this.onWebhookActivate(req.body.action);
            }
        });

        /* Listen and respond to get requests so we can create webhooks */
        app.get("/trelloWebhook/", (req, res) => {
            console.log("Web server received a GET request");
            res.set('Content-Type', 'text/plain');
            res.send("Get received.");
        });

        /* Start the app */
        app.listen(3000, err => {
            if (err) {
                throw err;
            } else {
                console.log("Server started on port 3000");
            }
        });
    }


}

module.exports = new TrelloMonitor();