const trelloInterface = require("./TrelloInterface");
const SiteMonitor = require("./SiteMonitor");

const {fields, categories} = require("./Globals");
const {categoryLists, callbackUrl, boardId, botMemberId} = require("./config.json");
const {trelloSecret} = require("./tokens.json");
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
 * @typedef {undefined | [Task, int, String[]]} WebhookReturn
 *
 * @typedef {{id: string, name: string}} IdNameTuple
 *
 *
 */
class TrelloMonitor extends SiteMonitor {


    /**
     * Handles a new card being added to the published lists on trello.
     *
     * @param card {IdNameTuple} The card that was created.
     * @return {WebhookReturn} The task and fields updated
     */
    async onCardCreated(card) {
        let rawCard = await requester.getCard(card.id);
        let task = this.monitoredList.getOrMakeTask(task => trelloInterface.doesTaskMatchData(task, rawCard));
        task.listCategoryAdded = false;
        trelloInterface.loadIntoTask(rawCard, task);
        if (task.listCategoryAdded) {
            await trelloInterface.propagateCategoryChange(task);
        }
        console.log(`Card '${card.name}' (${card.id}) created locally`);

        return [task, 1, []];
    }

    /**
     *
     * @param card {IdNameTuple} The card to delete
     * @return {WebhookReturn} The task and fields updated
     */
    onCardDeleted(card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        this.monitoredList.deleteThisTask(task);

        console.log(`Card '${card.name}' (${card.id}) deleted locally`);
        return [task, 2, []];
    }

    /**
     *
     * @param card {{name: string, desc: string, id:string}}
     *
     * @return {WebhookReturn} The task and fields updated
     */
    onMainChanged(card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            task.setField(fields.NAME, card.name);
            task.setField(fields.DESCRIPTION, card.desc);

            console.log(`Card '${card.name}' (${card.id}) update handled.`);
            return [task, 3, [fields.NAME, fields.DESCRIPTION]]
        } else {
            console.error(`Could not match card in webhook '${card.id}' (${card.name}) with any known task`);
            return null;
        }
    }

    /**
     * Note value == NULL when unchecked
     * @param customFieldId {IdNameTuple}
     * @param customFieldVal {RawCustomField}
     * @param card {IdNameTuple}
     * @return {WebhookReturn} The task and fields updated
     */
    onCustomChanged(customFieldId, customFieldVal, card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            let category = -1;
            let fieldVal = trelloInterface.customFieldToValue(customFieldVal);
            let fieldToUpdate;
            switch (customFieldId.id) {
                //TODO: make custom field handling globally "better"
                case "5da6fbfff25f736fcdec8cfb":
                    fieldToUpdate = fields.IS_BEGINNER;
                    break;
                case "5da6fbfff25f736fcdec8cef":
                    fieldToUpdate = fields.DAYS;
                    break;
                case "5da6fbfff25f736fcdec8ced":
                    fieldToUpdate = fields.TAGS;
                    break;
                case "5da6fbfff25f736fcdec8ceb":
                    fieldToUpdate = fields.MAX_INSTANCES;
                    break;
                case "5da6fbfff25f736fcdec8ce8":
                    fieldToUpdate = fields.GOOGLE_ID;
                    break;

                case "5da6fbfff25f736fcdec8cf9":
                    fieldToUpdate = fields.CATEGORIES;
                    category = categories.CODING;
                    break;
                case "5da6fbfff25f736fcdec8cf7":
                    fieldToUpdate = fields.CATEGORIES;
                    category = categories.DESIGN;
                    break;
                case "5da6fbfff25f736fcdec8cf5":
                    fieldToUpdate = fields.CATEGORIES;
                    category = categories.DOCS_TRAINING;
                    break;
                case "5da6fbfff25f736fcdec8cf3":
                    fieldToUpdate = fields.CATEGORIES;
                    category = categories.QA;
                    break;
                case "5da6fbfff25f736fcdec8cf1":
                    fieldToUpdate = fields.CATEGORIES;
                    category = categories.OUTRESEARCH;
                    break;
                default:
                    console.error(`Unknown custom field '${customFieldId.name}' (${customFieldId.id}) in webhook`);
                    return null;
            }

            if (fieldToUpdate === fields.CATEGORIES) {
                if (fieldVal) {
                    // Gaining a new category
                    task.addCategory(category);
                } else {
                    //TODO Stop removing the category for the list the card is in
                    task.removeCategory(category);
                }
            } else {
                task.setField(fieldToUpdate, fieldVal);
            }

            console.log(`Card '${card.name}' (${card.id}) custom field handled.`);
            return [task, 3, [fieldToUpdate]];
        } else {
            console.error(`Could not match card '${card.id}' (${card.name}) in webhook with any known task`);
            return null;
        }
    }

    /**
     *
     * @param oldList {IdNameTuple} The list the card was moved from
     * @param newList {IdNameTuple} The list the card was moved to
     * @param card {IdNameTuple} The card that was moved
     * @return {WebhookReturn} The task and fields updated
     */
    async onCardMoved(oldList, newList, card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            task.removeCategory(parseInt(catLookup[oldList.id]));
            task.addCategory(parseInt(catLookup[newList.id]));

            // Replicate this category change
            await trelloInterface.propagateCategoryChange(task);

            console.log(`Card '${card.name}' (${card.id}) moved from list '${oldList.name}' to list '${newList.name}'`);
            return [task, 3, [fields.CATEGORIES]];
        } else {
            console.error(`Could not match card '${card.id}' (${card.name}) in webhook with any known task`);
            return null;
        }
    }

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
     *
     * @return {WebhookReturn} The task and fields updated
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
                }
            // fallthrough when else is hit
            default:
                console.error("Irrelevant webhook trigger");
                return null;
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
     * Invokes the callbacks and then logs a message
     * @param args {WebhookReturn}
     */
    callCallbacks(args) {
        if (args) {
            let [task, type, alteredFields] = args;
            switch (type) {
                case 1:
                    this.createdCallback(task)
                        .then(() => console.log(`Creation of ${task.getField(fields.NAME)} duplicated to google`));
                    break;
                case 2:
                    this.deletedCallback(task)
                        .then(() => console.log(`Deletion of ${task.getField(fields.NAME)} duplicated to google`));
                    break;
                case 3:
                    this.alteredCallback(task, alteredFields)
                        .then(() => console.log(`Alteration of ${task.getField(fields.NAME)} duplicated to google`));
                    break;
            }
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
            //todo: improve?
            if (verifyTrelloWebhookRequest(req, trelloSecret, callbackUrl)) {
                res.send("Webhook received");
                if (req.body.action.idMemberCreator !== botMemberId) {
                    Promise.resolve(this.onWebhookActivate(req.body.action)) // Handle the webhook
                        .then(args => this.callCallbacks(args));  // Push the updates
                }
            } else {
                res.send("Access Denied");
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

let crypto = require('crypto');

function verifyTrelloWebhookRequest(request, secret, callbackURL) {
    let base64Digest = function (s) {
        return crypto.createHmac('sha1', secret).update(s).digest('base64');
    };
    let content = JSON.stringify(request.body) + callbackURL;
    let doubleHash = base64Digest(content);
    let headerHash = request.headers['x-trello-webhook'];
    return doubleHash === headerHash;
}

module.exports = new TrelloMonitor();