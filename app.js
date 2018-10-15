"use strict";
const request = require('request-promise');
const Promise = require('bluebird');
const tokens = require('./tokens.json');

const categories = {
    CODING: 1,
    DESIGN: 2,
    DOCS_TRAINING: 3,
    QA: 4,
    OUTRESEARCH: 5
};

class Task {
    constructor() {
        /* Ids */
        this.googleId = null;
        this.trelloId = null;

        /* Core data */
        this.name = "";
        this.description = "";
        this.status = 1;
        this.maxInstances = 1;
        this.mentors = [];
        this.tags = [];
        this.isBeginner = false;
        this.categories = {};
        this.days = 0;
        this.externalUrl = "";
        this.privateMetadata = "";

        /* Extraneous data */
        this.lastModified = "";
        this.claimedCount = 0;
        this.availableCount = 0;
        this.completedCount = 0;

        /* Trello Constants */
        this.customFields = {
            isBeginner: "5bb13d35adbb5244eb5b749d",
            days: "5bb13de3b6a0c658dce16fd5",
            tags: "5bb13e3b05e0cc6f01a9b76f",
            instances: "5bb13e67765a792d213d290b",
            googleId: "5bc2c3822a3cad2dc77409f5",

            isCode: "5bb13d86d728442f22e898e0",
            isDesign: "5bb13d8fc802625a6c30ee61",
            isDocs: "5bb13da34edf5926c83f294a",
            isQa: "5bb13da9f285397f1a80dddc",
            isOutResearch: "5bb13dbc351a9c4e5c93cd1f"
        }
    }

    crosslinkIds() {
        /**
         * Syncs the data between both google and trello.
         *
         * Will only run if there is both a google & trello id.
         */
        if (this.googleId && this.trelloId) {
            this.writeToGoogle()
        }
    }

    loadFromGoogle(data) {
        /***
         * Loads data from a google data payload.
         * This is a json object with fields described by the google api reference.
         */
        this.name = data.name;
        this.googleId = data.id;
        this.description = data.description;
        this.status = data.status;
        this.maxInstances = data.max_instances;
        this.mentors = data.mentors;
        this.tags = data.tags;
        this.isBeginner = data.is_beginner;
        this.days = data.time_to_complete_in_days;
        this.externalUrl = data.external_url;

        data.categories.forEach((item) => this.categories[item] = true);

        /* Extraneous data */
        this.lastModified = data.last_modified;
        this.claimedCount = data.claimed_count;
        this.availableCount = data.available_count;
        this.completedCount = data.completed_count;

        /* Update trello id if we have one. */
        this.trelloId = data.private_metadata || this.trelloId;
    }

    loadFromTrello(data) {
        /**
         * Loads the data from a trello payload.
         * This is the result from querying the card.
         *
         * Makes further calls to the api in order to get the data for each of the custom fields
         *
         * Returns a promise that only activates when all fields have been requested
         */
        this.trelloId = data.id;
        this.description = data.desc;
        this.name = data.name;

        return requester.getCustomFields(this.trelloId).then(body => {
            body.customFieldItems.forEach(this.handleField, this);
        });
    }

    handleField(field) {
        /**
         * Updates this task with the data from the given custom field.
         * Handles all the current types.
         */
        switch (field.idCustomField) {
            case this.customFields.isBeginner:
                this.isBeginner = field.value.checked === "true";
                break;
            case this.customFields.days:
                this.days = parseInt(field.value.number);
                break;
            case this.customFields.tags:
                this.tags = field.value.text.split(/\s*,\s*/i);
                break;
            case this.customFields.instances:
                this.maxInstances = parseInt(field.value.number);
                break;
            case this.customFields.googleId:
                this.googleId = field.value.number;
                break;
            case this.customFields.isCode:
                if (field.value.checked === "true") {
                    this.categories[categories.CODING] = true
                }
                break;
            case this.customFields.isDesign:
                if (field.value.checked === "true") {
                    this.categories[categories.DESIGN] = true
                }
                break;
            case this.customFields.isDocs:
                if (field.value.checked === "true") {
                    this.categories[categories.DOCS_TRAINING] = true
                }
                break;
            case this.customFields.isOutResearch:
                if (field.value.checked === "true") {
                    this.categories[categories.OUTRESEARCH] = true
                }
                break;
            case this.customFields.isQa:
                if (field.value.checked === "true") {
                    this.categories[categories.QA] = true
                }
                break;
            default:
                console.error(`Unknown field type '${field.id}' on card ${this.name}`);
        }
    }

    writeToGoogle() {
        /**
         * Updates the task on GCI to the data in the current task
         *
         * _This will overwrite the current task information_
         */
        if (this.googleId) {
            const data = {
                id: this.googleId,
                name: this.name,
                description: this.description,
                status: this.status,
                max_instances: this.maxInstances,
                is_beginner: this.isBeginner,
                time_to_complete_in_days: this.days,
                external_url: this.externalUrl,
                last_modified: this.lastModified,
                claimed_count: this.claimedCount,
                available_count: this.availableCount,
                completed_count: this.completedCount,
                private_metadata: this.trelloId,

                mentors: this.mentors,
                tags: this.tags,
                categories: []
            };
            for (let category in this.categories) {
                if (this.categories[category]) {
                    data.categories.push(category)
                }
            }
            requester.updateGoogle(this.googleId, data);
        } else {
            console.error("Cannot write. Have no google id")
        }
    }
}

class TaskList {
    constructor() {
        this.tasks = [];
        this.boardId = "5b9b100cca1728134ee88b15";
        this.categoryLists = {
            1: '5bb10eaaa163492c93420393',
            2: '5bb13fe396623c2292321640',
            3: '5bb13feff9698564f44ccc4b',
            4: '5bb13ffda245836ef12b392c',
            5: '5bb1400605e0cc6f01a9e124',
        };
    }

    getTaskFromGoogle(id) {
        /* Find index */
        let index = this.tasks.findIndex((data) => {
            return data.googleId === id
        });
        /* Make new task if one doesn't exist */
        if (index === -1) {
            this.tasks.push(new Task());
            index = this.tasks.length - 1;
        }
        return this.tasks[index];
    }

    getTaskFromTrello(id) {
        /* Find index */
        let index = this.tasks.findIndex((data) => {
            return data.trelloId === id
        });
        /* Make new task if one doesn't exist */
        if (index === -1) {
            this.tasks.push(new Task());
            index = this.tasks.length - 1;
        }
        return this.tasks[index];
    }

    loadFromGoogle() {
        const outerList = this;
        /* Make a new promise */
        return new Promise(resolve => {

            /* This needs to be a nested function to have access to the resolve
             * And to be able to not make a new promise each recusion*/
            function innerRecurse(page) {
                console.log(`Requesting page ${page} from google`);
                /* Request the tasks */
                requester.googleGet('tasks', 'page=' + page)
                    .then(body => {
                        outerList._loadFromGoogle(body);
                        if (body.next != null) {
                            /* Recurse again if there are more pages */
                            innerRecurse(body.next);
                        } else {
                            /* Resolve the promise and stop if there are no more pages */
                            resolve();
                        }
                    });
            }

            innerRecurse(1);
        });
    }

    _loadFromGoogle(data) {
        data.results.forEach((taskData) => this.getTaskFromGoogle(taskData.id).loadFromGoogle(taskData))
    }

    loadFromTrello() {
        /**
         * Loads the data from all the trello lists
         *
         * Returns a promise that triggers when all the tasks are fully updated
         */

        const categoryPromises = [];
        for (let category in categories) {
            console.log(`Requesting ${category.toLowerCase()} list from Trello`);

            /* Make a call for the category, making a new promise to finish when all are done */
            categoryPromises.push(new Promise(resolve => {
                requester.getListCards(this.categoryLists[categories[category]])
                    .then((body) => {

                        /* Make calls for each field, storing the promises */
                        console.log(`Processing ${category.toLowerCase()}'s cards`);
                        const fieldPromises = [];
                        body.forEach((item) => fieldPromises.push(
                            this.getTaskFromTrello(item.id).loadFromTrello(item)));

                        /* Resolve the category promise when the fields are all done */
                        Promise.all(fieldPromises).then(() => resolve());
                    });
            }));
        }
        /* Return a promise that will finish when all the categories are done */
        return Promise.all(categoryPromises);
    }

    writeToGoogle() {
        console.log("Writing to Google");
        this.tasks.forEach(task => task.writeToGoogle());
    }

    writeToTrello() {
        console.log("Writing to Trello");
        this.tasks.forEach(task => task.writeToTrello());
    }
}

class ApiRequester {
    constructor(googleToken, trelloKey, trelloToken) {
        this.googleToken = googleToken;
        this.trelloKey = trelloKey;
        this.trelloToken = trelloToken;
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
        data.value[type] = value;
        return this.trelloPut(`/card/${card}/customField/${field}/item`, data)
    }

    trelloPut(path, data) {
        return request({
            method: 'PUT',
            uri: `https://api.trello.com/1/${path}`
            + `?key=${this.trelloKey}&token=${this.trelloToken}${data || ""}`
        }).promise();
    }

    updateGoogle(task, data) {
        return this.googlePut(task, JSON.stringify(data))
    }

    googlePut(taskId, data) {
        return request({
            method: 'PUT',
            uri: `https://codein.withgoogle.com/api/program/current/tasks/${taskId}/`,
            auth: {
                'bearer': this.googleToken
            },
            body: data
        }).promise();
    }
}


const requester = new ApiRequester(tokens.googleToken,
    tokens.trelloKey,
    tokens.trelloToken);
const taskList = new TaskList(requester);

taskList.loadFromTrello()
    .then(() => taskList.loadFromGoogle()
        .then(() => {
            console.log("donezo");
        }));
