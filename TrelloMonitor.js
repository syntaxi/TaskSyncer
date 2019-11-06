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
     * Handles a new card being added to the published lists on trello.
     *
     * @param card {IdNameTuple} The card that was created.
     */
    onCardCreated(card) {
        //TODO propagate this change to google
        requester.getCard(card.id).then(rawCard => {
            let task = this.monitoredList.getOrMakeTask(task => trelloInterface.doesTaskMatchData(task, rawCard));
            task.listCategoryAdded = false;
            trelloInterface.loadIntoTask(rawCard, task);
            if (task.listCategoryAdded) {
                return trelloInterface.propagateCategoryChange(task);
            }
            console.log(`Card '${card.name}' (${card.id}) created locally`);
        });
    }

    onCardDeleted(card) {
        //TODO propagate this change to google
        //TODO implement
        console.log(`Card '${card.name}' (${card.id}) deleted locally`);
    }

    /**
     *
     * @param card {{name: string, desc: string, id:string}}
     */
    onMainChanged(card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            //TODO propagate this change to google
            task.setField(fields.NAME, card.name);
            task.setField(fields.DESCRIPTION, card.desc);
            console.log(`Card '${card.name}' (${card.id}) update handled.`)
        } else {
            console.error(`Could not match card in webhook '${card.id}' (${card.name}) with any known task`);
        }
    }

    /**
     * Note value == NULL when unchecked
     * @param customFieldId {IdNameTuple}
     * @param customFieldVal {RawCustomField}
     * @param card {IdNameTuple}
     */
    onCustomChanged(customFieldId, customFieldVal, card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            //TODO propagate this change to google
            let category = -1;
            let fieldVal = trelloInterface.customFieldToValue(customFieldVal);
            switch (customFieldId.id) {
                //TODO: make custom field handling globally "better"
                case "5da6fbfff25f736fcdec8cfb":
                    task.setField(fields.IS_BEGINNER, customFieldVal);
                    break;
                case "5da6fbfff25f736fcdec8cef":
                    task.setField(fields.DAYS, fieldVal);
                    break;
                case "5da6fbfff25f736fcdec8ced":
                    task.setField(fields.TAGS, fieldVal);
                    break;
                case "5da6fbfff25f736fcdec8ceb":
                    task.setField(fields.MAX_INSTANCES, fieldVal);
                    break;
                case "5da6fbfff25f736fcdec8ce8":
                    task.setField(fields.GOOGLE_ID, fieldVal);
                    break;
                case "5da6fbfff25f736fcdec8cf9":
                    category = categories.CODING;
                    break;
                case "5da6fbfff25f736fcdec8cf7":
                    category = categories.DESIGN;
                    break;
                case "5da6fbfff25f736fcdec8cf5":
                    category = categories.DOCS_TRAINING;
                    break;
                case "5da6fbfff25f736fcdec8cf3":
                    category = categories.QA;
                    break;
                case "5da6fbfff25f736fcdec8cf1":
                    category = categories.OUTRESEARCH;
                    break;
                default:
                    console.error(`Unknown custom field '${customFieldId.name}' (${customFieldId.id}) in webhook`)
            }

            if (category >= 0) {
                if (fieldVal) {
                    // Gaining a new category
                    task.addCategory(category);
                } else {
                    //TODO Stop removing the category for the list the card is in
                    task.removeCategory(category);
                }
            }
            console.log(`Card '${card.name}' (${card.id}) custom field handled.`)
        } else {
            console.error(`Could not match card '${card.id}' (${card.name}) in webhook with any known task`);
        }
    }

    /**
     *
     * @param oldList {IdNameTuple} The list the card was moved from
     * @param newList {IdNameTuple} The list the card was moved to
     * @param card {IdNameTuple} The card that was moved
     */
    onCardMoved(oldList, newList, card) {
        let task = this.monitoredList.getTask(task => task.getField(fields.TRELLO_ID) === card.id);
        if (task) {
            //TODO propagate this change to google
            task.removeCategory(parseInt(catLookup[oldList.id]));
            task.addCategory(parseInt(catLookup[newList.id]));

            // Replicate this category change
            trelloInterface.propagateCategoryChange(task);

            console.log(`Card '${card.name}' (${card.id}) moved from list '${oldList.name}' to list '${newList.name}'`)
        } else {
            console.error(`Could not match card '${card.id}' (${card.name}) in webhook with any known task`);
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