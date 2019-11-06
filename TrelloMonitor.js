const {categoryLists, callbackUrl, boardId, botMemberId} = require("./config.json");

const express = require('express');
const bodyParser = require('body-parser');
const requester = require("./TrelloApiRequester.js");
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