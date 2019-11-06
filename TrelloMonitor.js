const {categoryLists, callbackUrl, boardId, botMemberId} = require("./config.json");

const express = require('express');
const bodyParser = require('body-parser');
class TrelloMonitor {
    /**
     * @inheritDoc
     */
    setupMonitoring(taskList) {
        this._createExpressApp();
        this.monitoredList = taskList;
    }


    /**
     *
     * @param body {WebhookAction}
     */
    onWebhookActivate(body) {
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